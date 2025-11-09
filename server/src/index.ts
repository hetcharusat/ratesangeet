import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import os from 'os';
import http from 'http';
import authRoutes from './routes/auth.js';
import musicRoutes from './routes/music.js';
import reviewRoutes from './routes/reviews.js';
import statsRoutes from './routes/stats.js';
import usersRoutes from './routes/users.js';
import discoverRoutes from './routes/discover.js';
import commentsRoutes from './routes/comments.js';
import ServerStats from './models/ServerStats.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for mobile app compatibility
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
// Lightweight request logger for debugging
app.use((req, _res, next) => {
  try {
    console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  } catch {}
  next();
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/comments', commentsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
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

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker');
    console.log('✅ MongoDB connected successfully');
    
    // Initialize server stats after DB connection
    await initializeServerStats();
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

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

const startWithFallback = (port: number, attempts = 5) => {
  const server = app.listen(port, '0.0.0.0');
  server.on('listening', () => logAddresses(port));
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

startWithFallback(DEFAULT_PORT);

// Archive job: Run daily to clean up old scrobbles (keeps last 30 days in cloud)
// Full history stays in local SQLite on each device
const ARCHIVE_INTERVAL_HOURS = 24; // Run once per day
const runArchiveJob = () => {
  console.log('🗄️  Running archive job to clean old scrobbles from cloud...');
  const isWindows = process.platform === 'win32';
  const job = spawn(isWindows ? 'npx.cmd' : 'npx', ['tsx', 'src/jobs/archiveScrobbles.ts'], {
    cwd: __dirname + '/..',
    stdio: 'inherit',
    shell: true, // Use shell to resolve npx on Windows
  });
  job.on('error', (err) => {
    console.error('❌ Archive job spawn error:', err.message);
  });
  job.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Archive job completed successfully');
    } else {
      console.error(`❌ Archive job failed with code ${code}`);
    }
  });
};

// Run archive job on startup (after 30 seconds to let DB connect)
setTimeout(runArchiveJob, 30000);

// Then run every 24 hours
setInterval(runArchiveJob, ARCHIVE_INTERVAL_HOURS * 60 * 60 * 1000);
