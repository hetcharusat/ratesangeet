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

let pingCount = 0; // Track total pings (resets on server restart)
const startTime = Date.now(); // Server start timestamp

app.get('/ping', (req, res) => {
  pingCount++;
  const now = new Date().toISOString();
  const uptimeMinutes = Math.floor((Date.now() - startTime) / 60000);
  
  console.log(`[PING] #${pingCount} at ${now} (uptime: ${uptimeMinutes}m)`);
  
  // Simple text response (lightweight, no JSON parsing overhead)
  res.status(200).send('pong');
});

// Root route: helpful message for manual testing
app.get('/', (req, res) => {
  const uptimeMinutes = Math.floor((Date.now() - startTime) / 60000);
  res.send(`
    <html>
      <head><title>Ratesangeet API</title></head>
      <body style="font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px;">
        <h1>🎵 Ratesangeet API Server</h1>
        <p><strong>Status:</strong> Running</p>
        <p><strong>Uptime:</strong> ${uptimeMinutes} minutes</p>
        <p><strong>Total Pings:</strong> ${pingCount}</p>
        <hr>
        <h3>Endpoints:</h3>
        <ul>
          <li><code>GET /ping</code> - UptimeRobot health check</li>
          <li><code>GET /api/health</code> - API health status</li>
          <li><code>GET /api/auth/*</code> - Authentication routes</li>
          <li><code>GET /api/music/*</code> - Music & scrobble routes</li>
          <li><code>GET /api/reviews/*</code> - Review routes</li>
          <li><code>GET /api/users/*</code> - User profile routes</li>
        </ul>
        <hr>
        <p style="color: #666; font-size: 14px;">
          💡 to support this dev , just give a star on <a href="https://github.com/hetcharusat/ratesangeet" target="_blank">GitHub</a>!
        </p>
      </body>
    </html>
  `);
});

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker');
    console.log('✅ MongoDB connected successfully');
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
