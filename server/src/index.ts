import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import os from 'os';
import http from 'http';
import fs from 'fs';
import path from 'path';
// Unified router loader (provides grouped + legacy mounts)
import apiRouter from './routes/index.js';
// API docs (Swagger/OpenAPI)
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import ServerStats from './models/ServerStats.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { startBackgroundScrobbler, runBackgroundScrobbler } from './jobs/backgroundScrobbler.js';
import { runArchiveJob } from './jobs/archiveScrobbles.js';
import { ensureMongoConnected } from './middleware/mongoConnection.js';
import { errorHandler } from './middleware/errorHandler.js';
import { compressionMiddleware, conditionalGet } from './middleware/optimization.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server root (only in development; Render uses dashboard env vars)
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.join(__dirname, '../.env');
  try {
    dotenv.config({ path: envPath });
  } catch (e) {
    console.warn('⚠️  Local .env not found (OK in production):', (e as any)?.message);
  }
}

// Verify critical env vars are loaded (from .env in dev, or Render dashboard in prod)
if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error('❌ CRITICAL: Spotify credentials not loaded!');
  console.error('   SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? 'SET' : 'MISSING');
  console.error('   SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? 'SET' : 'MISSING');
  console.error('   NODE_ENV:', process.env.NODE_ENV || 'undefined');
  console.error('   Ensure environment variables are set in Render dashboard or .env file');
  process.exit(1);
}

console.log('✅ Spotify credentials loaded successfully');
console.log('   Environment: NODE_ENV =', process.env.NODE_ENV || 'development');

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 5000;

console.log('🚀 Server starting...');
console.log('   PORT:', DEFAULT_PORT);
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');

// Load OpenAPI document (fail-safe: continue if load fails)
let openapiDoc: any = null;
try {
  // Prefer docs/openapi.yaml; fallback to project root's openapi.yaml
  const primary = path.join(__dirname, '../docs/openapi.yaml');
  const fallback = path.join(__dirname, '../openapi.yaml');
  try { openapiDoc = YAML.load(primary); } catch { openapiDoc = YAML.load(fallback); }
  // Minimal augmentation: add dynamic server URL if running locally
  if (openapiDoc && openapiDoc.servers && Array.isArray(openapiDoc.servers)) {
    const hasLocal = openapiDoc.servers.some((s: any) => /localhost/.test(s.url));
    if (!hasLocal) openapiDoc.servers.unshift({ url: `http://localhost:${DEFAULT_PORT}` });
  }
} catch (e) {
  console.warn('⚠️  OpenAPI document load failed:', (e as any)?.message);
}

// Middleware
app.use(cors({
  origin: true, // Allow all origins for mobile app compatibility
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Global error handlers (prevent silent crashes)
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});

// V2 Optimization: Compression (gzip) for all responses
app.use(compressionMiddleware);

// V2 Optimization: Conditional GET (ETag) for cacheable responses
app.use(conditionalGet);

// Advertise envelope version for clients during migration
app.use((req, res, next) => {
  res.setHeader('X-API-Envelope', 'transitional-v1');
  next();
});

// Lightweight request logger (ONLY in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    // Sanitize query string to avoid leaking tokens/noise in logs
    try {
      const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
      // Mask sensitive params
      const sensitive = new Set(['accessToken', 'token', 'refreshToken', 'code', 'code_verifier']);
      for (const key of Array.from(url.searchParams.keys())) {
        if (sensitive.has(key)) {
          url.searchParams.set(key, '***');
        }
      }
      // Optionally skip very chatty endpoints
      const pathname = url.pathname || '';
      const noisy = ['/api/music/album'];
      if (noisy.includes(pathname)) {
        // Log a compact line without query details
        console.log(`[REQ] ${req.method} ${pathname}`);
      } else {
        console.log(`[REQ] ${req.method} ${url.pathname}${url.search ? '?' + url.searchParams.toString() : ''}`);
      }
    } catch {
      // Fallback
      console.log(`[REQ] ${req.method} ${req.originalUrl}`);
    }
    next();
  });
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Serve static web app files (built by Vite in ../web/dist)
const webDistPath = path.join(__dirname, '../../web/dist');
app.use(express.static(webDistPath));

// SPA fallback: serve index.html for non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes and swagger docs
  if (req.path.startsWith('/api') || req.path.startsWith('/swagger')) {
    return next();
  }
  // Serve index.html for all other routes (SPA support)
  const indexPath = path.join(webDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

// Routes (protected by MongoDB connection check)
app.use('/api', ensureMongoConnected, apiRouter);

// Serve interactive API docs
if (openapiDoc) {
  // Serve light theme CSS as a separate file for higher priority loading
  app.get('/swagger-light.css', (_req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.send(`
      @media (prefers-color-scheme: dark) {
        :root { color-scheme: light !important; }
      }
      :root { color-scheme: light !important; }
      html, body, #swagger-ui, .swagger-ui {
        background: #ffffff !important;
        color: #111111 !important;
        background-color: #ffffff !important;
      }
      * { color: inherit !important; }
      .swagger-ui .wrapper { background: #ffffff !important; }
      .swagger-ui .information-container { background: #ffffff !important; }
      .swagger-ui .scheme-container { background: #fafafa !important; }
      .swagger-ui .opblock { background: #ffffff !important; border: 1px solid #eaecef !important; }
      .swagger-ui .opblock-summary { background: #f7f7f9 !important; }
      .swagger-ui .model-box { background: #fafafa !important; }
      .swagger-ui .topbar { background: #f7f7f9 !important; border-bottom: 1px solid #e5e5e5 !important; }
      .swagger-ui .info .title { color: #111 !important; font-weight: 700; }
      .swagger-ui .markdown p, .swagger-ui .renderedMarkdown p { color: #222 !important; }
      .swagger-ui .btn { color: #111 !important; background: #ffffff !important; border: 1px solid #ccc !important; }
      .swagger-ui select, .swagger-ui input, .swagger-ui textarea { 
        color: #111 !important; 
        background: #ffffff !important; 
        border: 1px solid #ccc !important; 
      }
      .swagger-ui .model, .swagger-ui .model-box { color: #111 !important; }
      .swagger-ui table thead tr th, .swagger-ui table thead tr td { 
        color: #111 !important; 
        background: #f7f7f9 !important; 
      }
    `);
  });

  // JS shim to hard-force light theme even if extensions inject dark mode
  app.get('/api-docs-light.js', (_req, res) => {
    const js = `(() => {
      const apply = () => {
        try {
          const html = document.documentElement;
          const body = document.body;
          if (!html || !body) return;
          // Remove/disable common dark-mode extension artifacts (e.g., Dark Reader)
          try {
            document.querySelectorAll("style[class^='darkreader']").forEach((el) => el.parentNode && el.parentNode.removeChild(el));
            document.querySelectorAll("link[class^='darkreader']").forEach((el) => el.parentNode && el.parentNode.removeChild(el));
            html.classList.remove('darkreader');
            html.removeAttribute('data-darkreader-mode');
            html.removeAttribute('data-darkreader-scheme');
          } catch {}

          html.setAttribute('data-theme', 'light');
          const root = document.querySelector('.swagger-ui');
          if (root) root.setAttribute('data-theme', 'light');
          // Inline styles with !important trump extension stylesheets
          html.style.setProperty('background', '#ffffff', 'important');
          html.style.setProperty('color-scheme', 'light', 'important');
          html.style.setProperty('filter', 'none', 'important');
          body.style.setProperty('background', '#ffffff', 'important');
          body.style.setProperty('color', '#111111', 'important');
          body.style.setProperty('filter', 'none', 'important');

          // Ensure swagger root containers are light
          const roots = document.querySelectorAll('#swagger-ui, .swagger-ui');
          roots.forEach((r) => {
            (r as HTMLElement).style.setProperty('background', '#ffffff', 'important');
            (r as HTMLElement).style.setProperty('color', '#111111', 'important');
          });

          // Add explicit meta for color-scheme
          let meta = document.querySelector("meta[name='color-scheme']");
          if (!meta) {
            meta = document.createElement('meta');
            (meta as HTMLMetaElement).name = 'color-scheme';
            (meta as HTMLMetaElement).content = 'light';
            document.head.appendChild(meta);
          } else {
            (meta as HTMLMetaElement).content = 'light';
          }
        } catch {}
      };
      apply();
      // Re-apply if extensions mutate attributes/styles
      const obs = new MutationObserver(() => apply());
      obs.observe(document.documentElement, { attributes: true, subtree: true, childList: true });
      window.addEventListener('load', apply);
      document.addEventListener('readystatechange', apply);
    })();`;
    res.setHeader('Content-Type', 'application/javascript');
    res.send(js);
  });

  const swaggerOptions = {
    customSiteTitle: 'Ratesangeet API Docs',
    customCss: `
      /* Force light theme regardless of system preference */
      @media (prefers-color-scheme: dark) {
        :root { color-scheme: light !important; }
        html, body { background: #ffffff !important; color: #111111 !important; }
      }
      
      /* Nuclear option: force every element to light */
      :root { color-scheme: light !important; }
      html { background: #ffffff !important; }
      body { background: #ffffff !important; color: #111111 !important; }
      
      /* Swagger UI containers */
      #swagger-ui { background: #ffffff !important; }
      .swagger-ui { background: #ffffff !important; color: #111111 !important; }
      .swagger-ui * { color: #111111 !important; }
      
      /* Main content areas */
      .swagger-ui .wrapper { background: #ffffff !important; }
      .swagger-ui .information-container { background: #ffffff !important; }
      .swagger-ui .info { background: #ffffff !important; color: #111 !important; }
      .swagger-ui .info .title { color: #111 !important; font-weight: 700; }
      .swagger-ui .info .description { color: #333 !important; }
      
      /* Scheme/server selector */
      .swagger-ui .scheme-container { background: #fafafa !important; }
      
      /* Operation blocks */
      .swagger-ui .opblock-tag-section { background: #ffffff !important; }
      .swagger-ui .opblock-tag { background: #fafafa !important; color: #111 !important; border-bottom: 1px solid #e5e5e5 !important; }
      .swagger-ui .opblock { background: #ffffff !important; border: 1px solid #e5e5e5 !important; }
      .swagger-ui .opblock-summary { background: #f7f7f9 !important; color: #111 !important; }
      .swagger-ui .opblock-summary-method { color: #ffffff !important; }
      .swagger-ui .opblock-description { color: #333 !important; }
      .swagger-ui .opblock-body { background: #fafafa !important; }
      
      /* Parameters & models */
      .swagger-ui .parameters { background: #ffffff !important; }
      .swagger-ui .model-box { background: #fafafa !important; color: #111 !important; }
      .swagger-ui .model { color: #111 !important; }
      .swagger-ui .property { color: #111 !important; }
      
      /* Tables */
      .swagger-ui table { background: #ffffff !important; }
      .swagger-ui table thead tr th, 
      .swagger-ui table thead tr td { 
        color: #111 !important; 
        background: #f7f7f9 !important; 
      }
      .swagger-ui table tbody tr td { color: #111 !important; background: #ffffff !important; }
      
      /* Form controls */
      .swagger-ui .btn { color: #111 !important; background: #ffffff !important; border: 1px solid #ccc !important; }
      .swagger-ui select, 
      .swagger-ui input, 
      .swagger-ui textarea { 
        color: #111 !important; 
        background: #ffffff !important; 
        border: 1px solid #ccc !important; 
      }
      
      /* Responses */
      .swagger-ui .responses-inner { background: #ffffff !important; }
      .swagger-ui .response { background: #fafafa !important; }
      .swagger-ui .response-col_status { color: #111 !important; }
      .swagger-ui .response-col_description { color: #111 !important; }
      
      /* Code examples & JSON (the dark boxes) */
      .swagger-ui .highlight-code { background: #f6f8fa !important; }
      .swagger-ui .microlight { background: #f6f8fa !important; color: #111 !important; }
      .swagger-ui pre { background: #f6f8fa !important; color: #111 !important; border: 1px solid #e1e4e8 !important; }
      .swagger-ui code { background: #f6f8fa !important; color: #111 !important; }
      .swagger-ui .example, .swagger-ui .examples { background: #f6f8fa !important; }
      .swagger-ui .model-example { background: #f6f8fa !important; }
      
      /* Tab controls for examples */
      .swagger-ui .tab { background: #ffffff !important; color: #111 !important; }
      .swagger-ui .tab.active { background: #f6f8fa !important; }
      
      /* Markdown content */
      .swagger-ui .markdown p, 
      .swagger-ui .renderedMarkdown p { color: #222 !important; }
      .swagger-ui .markdown code { background: #f6f8fa !important; color: #d73a49 !important; padding: 2px 4px !important; }
      
      /* Topbar */
      .swagger-ui .topbar { background: #f7f7f9 !important; border-bottom: 1px solid #e5e5e5 !important; }
    `,
    swaggerOptions: {
      docExpansion: 'list',
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
    customJs: '/api-docs-light.js',
  } as any;

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDoc, swaggerOptions));
  console.log('📘 API docs available at /api-docs');
} else {
  console.log('📘 API docs not loaded (openapi.yaml missing or invalid)');
}

// Global error handler (must be after routes)
app.use(errorHandler);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Manual trigger for background scrobbler (for testing/debugging)
app.post('/api/admin/trigger-scrobbler', ensureMongoConnected, async (req, res) => {
  const { adminKey } = req.body;
  
  // Simple admin key check (set ADMIN_KEY in env)
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    console.log('🎵 Manual trigger: Starting background scrobbler...');
    // Run async (don't wait for completion)
    runBackgroundScrobbler().catch(err => {
      console.error('Manual scrobbler trigger failed:', err);
    });
    
    res.json({ 
      success: true, 
      message: 'Background scrobbler triggered successfully',
      note: 'Job is running in background. Check server logs for progress.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger for archive job (for testing/debugging)
app.post('/api/admin/trigger-archive', ensureMongoConnected, async (req, res) => {
  const { adminKey } = req.body;
  
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    console.log('🗄️  Manual trigger: Starting archive job...');
    runArchiveJob();
    
    res.json({ 
      success: true, 
      message: 'Archive job triggered successfully',
      note: 'Job is running in background. Check server logs for progress.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// UPTIME MONITORING: /ping endpoint for UptimeRobot
// ============================================================================
// This lightweight route keeps the Render free tier alive by responding to
// periodic pings from UptimeRobot (or similar monitoring services).
//
// PERSISTENCE:
// - All uptime data is persisted to MongoDB (survives server restarts)
// - totalPings: Cumulative count across all restarts
// - firstStartTime: Very first time the server was ever started
// - lastRestartTime: Most recent server restart
// - totalRestarts: How many times server has been restarted
//
// HOW IT WORKS:
// 1. Deploy this server to Render (https://ratesangeet.onrender.com)
// 2. Add a monitor in UptimeRobot:
//    - Type: HTTP(S)
//    - URL: https://ratesangeet.onrender.com/ping
//    - Interval: Every 5 minutes (free tier allows 5-min checks)
// 3. UptimeRobot pings this endpoint every 5 minutes
// 4. Render keeps the container awake (avoids 15-minute idle timeout)
//
// WHY THIS MATTERS:
// - Render free tier spins down after 15 minutes of inactivity
// - Cold starts take 30-60 seconds (bad UX for users)
// - UptimeRobot pings prevent the container from sleeping
// - Bonus: You get uptime monitoring alerts if the server actually goes down
//
// SETUP STEPS:
// 1. Sign up at https://uptimerobot.com (free tier = 50 monitors)
// 2. Add Monitor → HTTP(S) Monitor
// 3. URL: https://ratesangeet.onrender.com/ping
// 4. Monitoring Interval: 5 minutes
// 5. Alert Contacts: Add your email
// 6. Save and monitor
//
// LOGS:
// Every ping is logged with timestamp to help debug cold starts or downtime.
// ============================================================================

const currentSessionStart = Date.now(); // This session's start time (resets on restart)

// Initialize/increment server stats on startup
let serverStats: any = null;

const initializeServerStats = async () => {
  try {
    serverStats = await ServerStats.findById('singleton');
    
    if (!serverStats) {
      // First time ever starting the server
      serverStats = await ServerStats.create({
        _id: 'singleton',
        totalPings: 0,
        firstStartTime: new Date(),
        lastRestartTime: new Date(),
        totalRestarts: 1,
      });
      console.log('📊 Initialized server stats (first boot)');
    } else {
      // Server restarted - increment restart counter
      serverStats.totalRestarts += 1;
      serverStats.lastRestartTime = new Date();
      await serverStats.save();
      console.log(`📊 Server restart #${serverStats.totalRestarts}`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize server stats:', error);
  }
};

app.get('/ping', async (req, res) => {
  try {
    // Increment ping count in database
    const stats = await ServerStats.findByIdAndUpdate(
      'singleton',
      { 
        $inc: { totalPings: 1 },
        $set: { lastPingTime: new Date() }
      },
      { new: true, upsert: true }
    );
    
    const now = new Date().toISOString();
    const currentSessionMinutes = Math.floor((Date.now() - currentSessionStart) / 60000);
    
    console.log(`[PING] #${stats?.totalPings || 0} at ${now} (session: ${currentSessionMinutes}m)`);
    
    // Simple text response (lightweight, no JSON parsing overhead)
    res.status(200).send('pong');
  } catch (error) {
    console.error('[PING] Error updating stats:', error);
    // Still respond with pong even if DB update fails (keep-alive priority)
    res.status(200).send('pong');
  }
});

// Root route: helpful message for manual testing
app.get('/', async (req, res) => {
  try {
    const stats = await ServerStats.findById('singleton');
    const currentSessionMinutes = Math.floor((Date.now() - currentSessionStart) / 60000);
    const totalUptimeMinutes = stats?.firstStartTime 
      ? Math.floor((Date.now() - new Date(stats.firstStartTime).getTime()) / 60000)
      : 0;
    
    res.send(`
      <html>
        <head>
          <title>Ratesangeet API</title>
          <meta http-equiv="refresh" content="60"> <!-- Auto-refresh every 60s -->
        </head>
        <body style="font-family: system-ui; max-width: 700px; margin: 50px auto; padding: 20px; background: #0a0a0a; color: #fff;">
          <h1>🎵 Ratesangeet API Server</h1>
          <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📊 Current Session</h3>
            <p><strong>Status:</strong> <span style="color: #1DB954;">● Running</span></p>
            <p><strong>Session Uptime:</strong> ${currentSessionMinutes} minutes</p>
            <p><strong>Session Started:</strong> ${new Date(currentSessionStart).toLocaleString()}</p>
          </div>
          
          <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📈 Lifetime Stats</h3>
            <p><strong>Total Pings:</strong> ${stats?.totalPings || 0}</p>
            <p><strong>Total Restarts:</strong> ${stats?.totalRestarts || 0}</p>
            <p><strong>First Started:</strong> ${stats?.firstStartTime ? new Date(stats.firstStartTime).toLocaleString() : 'Unknown'}</p>
            <p><strong>Last Restart:</strong> ${stats?.lastRestartTime ? new Date(stats.lastRestartTime).toLocaleString() : 'Unknown'}</p>
            <p><strong>Last Ping:</strong> ${stats?.lastPingTime ? new Date(stats.lastPingTime).toLocaleString() : 'Never'}</p>
            <p><strong>Total Uptime:</strong> ${totalUptimeMinutes} minutes (${Math.floor(totalUptimeMinutes / 60)} hours)</p>
          </div>
          
          <hr style="border-color: #333;">
          <h3>🔌 API Endpoints</h3>
          <ul style="line-height: 1.8;">
            <li><code>GET /ping</code> - UptimeRobot health check</li>
            <li><code>GET /api/health</code> - API health status</li>
            <li><code>GET /api/auth/*</code> - Authentication routes</li>
            <li><code>GET /api/music/*</code> - Music & scrobble routes</li>
            <li><code>GET /api/reviews/*</code> - Review routes</li>
            <li><code>GET /api/users/*</code> - User profile routes</li>
          </ul>
          <hr style="border-color: #333;">
          <p style="color: #888; font-size: 14px; text-align: center;">
            💡 Support this dev by giving a star on <a href="https://github.com/hetcharusat/ratesangeet" target="_blank" style="color: #1DB954;">GitHub</a>!
          </p>
          <p style="color: #666; font-size: 12px; text-align: center;">
            Page auto-refreshes every 60 seconds
          </p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).send('Error loading server stats');
  }
});

// MongoDB Connection with monitoring and auto-reconnect
// Connect to MongoDB FIRST, then start server
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker', {
      // Connection pool settings for stability
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      // Disable auto-reconnect (we'll handle it manually)
      autoIndex: false,
    });
    console.log('✅ MongoDB connected successfully');
    
    // Monitor connection events
    mongoose.connection.on('disconnected', () => {
      console.error('⚠️  MongoDB disconnected! Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      // Don't exit - let mongoose handle reconnection
    });

    mongoose.connection.on('close', () => {
      console.error('⚠️  MongoDB connection closed');
    });
    
    // Initialize server stats after DB connection
    await initializeServerStats();
    
    // Start server ONLY after MongoDB is connected
    startWithFallback(DEFAULT_PORT);
    
    // Start background jobs after server is up
    setTimeout(() => {
      console.log('🗄️  Starting archive job...');
      runArchiveJob();
    }, 30000);
    
    setTimeout(() => {
      console.log('🎵 Starting background scrobbler...');
      startBackgroundScrobbler();
    }, 60000);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start the connection process
connectDB();

const logAddresses = (port: number) => {
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
  try {
    const ifaces = os.networkInterfaces();
    const addrs = Object.entries(ifaces)
      .flatMap(([name, infos]) => (infos || []).map((i) => ({ name, info: i })))
      .filter((x) => x.info && !x.info.internal && x.info.family === 'IPv4');
    if (addrs.length) {
      console.log('🌐 Candidate LAN URLs (pick your active Wi‑Fi/Ethernet):');
      for (const a of addrs) {
        console.log(`   - ${a.name}: http://${a.info.address}:${port}`);
      }
    }
  } catch {}
};

// Archive job removed - now using imported function
// (No more spawn, no more mongoose.disconnect)

const startWithFallback = (port: number, attempts = 5) => {
  const server = app.listen(port, '0.0.0.0');
  server.on('listening', () => {
    logAddresses(port);
    
    // Start periodic jobs AFTER server is listening
    // Archive job runs every 24 hours
    setInterval(runArchiveJob, 24 * 60 * 60 * 1000);
  });
  server.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE' && attempts > 0) {
      const next = port + 1;
      console.warn(`⚠️  Port ${port} in use, trying ${next}...`);
      setTimeout(() => startWithFallback(next, attempts - 1), 250);
    } else {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    }
  });
};
