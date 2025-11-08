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

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
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
