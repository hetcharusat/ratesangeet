import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Scrobble from '../models/Scrobble.js';
import AlbumStats from '../models/AlbumStats.js';
import TrackStats from '../models/TrackStats.js';
import UserStatsSummary from '../models/UserStatsSummary.js';
import CompletionEvent from '../models/CompletionEvent.js';
import User from '../models/User.js';
import path from 'path';
import fs from 'fs';

dotenv.config();

/**
 * RESET & SEED SCRIPT (Phase 5)
 * --------------------------------------
 * Safe reset of development data sets + canonical seed.
 * Guards:
 *  - Requires process.env.NODE_ENV !== 'production'
 *  - Requires RESET_CONFIRM=1 environment variable
 *  - Only truncates (deleteMany) instead of dropping collections to preserve indexes
 *  - Skips if database appears to have > 50 users unless FORCE_ALL=1
 */

const CANONICAL_ALBUMS = [
  { id: '2guirTSEqLizK7j9i1MTTZ', name: 'Rumours', artist: 'Fleetwood Mac' },
  { id: '1Rv9WRKyYhFaGbuYDaQunN', name: 'Hotel California', artist: 'Eagles' },
  { id: '3pLdWdkj83EYfDN6H2N8MR', name: 'Thriller', artist: 'Michael Jackson' }
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run in production');
    process.exit(1);
  }
  if (process.env.RESET_CONFIRM !== '1') {
    console.error('❌ Set RESET_CONFIRM=1 to execute reset');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/ratesangeet';
  console.log('Connecting to', mongoUri);
  await mongoose.connect(mongoUri);

  const userCount = await User.countDocuments();
  if (userCount > 50 && process.env.FORCE_ALL !== '1') {
    console.error(`❌ Refusing reset: userCount=${userCount} (>50). Set FORCE_ALL=1 to override.`);
    process.exit(1);
  }

  console.log('⚠️  Truncating collections (preserving indexes)...');
  await Promise.all([
    Scrobble.deleteMany({}),
    AlbumStats.deleteMany({}),
    TrackStats.deleteMany({}),
    UserStatsSummary.deleteMany({}),
    CompletionEvent.deleteMany({})
  ]);

  console.log('✅ Core collections truncated. Seeding canonical data...');

  const demoUser = await User.findOne() || await User.create({
    spotifyId: 'demo-user-spotify',
    displayName: 'Demo User',
    email: 'demo@example.com',
    accessToken: 'demo',
    refreshToken: 'demo',
    profileImage: '',
    username: 'demo'
  });

  const now = Date.now();
  let scrobbleInserts: any[] = [];
  let totalScrobbles = 0;

  for (const album of CANONICAL_ALBUMS) {
    // Simulate 4 unique tracks per album listened ~40% threshold satisfied
    for (let i = 0; i < 4; i++) {
      const playedAt = new Date(now - (Math.random() * 7 * 24 * 60 * 60 * 1000) - i * 60000);
      scrobbleInserts.push({
        userId: demoUser._id,
        spotifyId: `${album.id}-track-${i}`,
        trackName: `${album.name} Track ${i + 1}`,
        artistName: album.artist,
        albumId: album.id,
        albumName: album.name,
        albumArt: undefined,
        durationMs: 180000,
        playedAt,
        source: 'spotify'
      });
      totalScrobbles++;
    }
  }

  if (scrobbleInserts.length) await Scrobble.insertMany(scrobbleInserts, { ordered: false });

  // Derive AlbumStats + TrackStats from scrobbles (simple aggregation in-memory for seed size)
  const byAlbum = new Map<string, { playCount: number; lastPlayedAt?: Date; artistName: string; albumName: string; albumId: string }>();
  const byTrack = new Map<string, { playCount: number; lastPlayedAt?: Date; trackName: string; artistName: string; albumName: string; trackId: string }>();

  for (const s of scrobbleInserts) {
    const albumKey = s.albumId || s.albumName;
    const a = byAlbum.get(albumKey) || { playCount: 0, artistName: s.artistName, albumName: s.albumName, albumId: s.albumId, lastPlayedAt: s.playedAt };
    a.playCount += 1; if (!a.lastPlayedAt || s.playedAt > a.lastPlayedAt) a.lastPlayedAt = s.playedAt;
    byAlbum.set(albumKey, a);

    const trackKey = s.spotifyId;
    const t = byTrack.get(trackKey) || { playCount: 0, trackName: s.trackName, artistName: s.artistName, albumName: s.albumName, trackId: s.spotifyId, lastPlayedAt: s.playedAt };
    t.playCount += 1; if (!t.lastPlayedAt || s.playedAt > t.lastPlayedAt) t.lastPlayedAt = s.playedAt;
    byTrack.set(trackKey, t);
  }

  for (const [albumKey, a] of byAlbum) {
    await AlbumStats.create({
      userId: demoUser.spotifyId,
      albumId: a.albumId,
      albumKey,
      albumName: a.albumName,
      artistName: a.artistName,
      playCount: a.playCount,
      lastPlayedAt: a.lastPlayedAt,
    });
  }
  for (const [trackKey, t] of byTrack) {
    await TrackStats.create({
      userId: demoUser.spotifyId,
      trackId: t.trackId,
      trackKey,
      trackName: t.trackName,
      artistName: t.artistName,
      albumName: t.albumName,
      playCount: t.playCount,
      lastPlayedAt: t.lastPlayedAt,
    });
  }

  await UserStatsSummary.create({
    userId: demoUser.spotifyId,
    totalScrobbles,
    lastScrobbled: {
      spotifyId: scrobbleInserts[0]?.spotifyId,
      trackName: scrobbleInserts[0]?.trackName,
      artistName: scrobbleInserts[0]?.artistName,
      albumName: scrobbleInserts[0]?.albumName,
      playedAt: scrobbleInserts[0]?.playedAt,
    }
  });

  console.log('✅ Seed complete', { totalScrobbles, albums: byAlbum.size, tracks: byTrack.size });
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
