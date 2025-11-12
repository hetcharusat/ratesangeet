/**
 * Test batch-upsert endpoint with V2 scrobbling logic
 * 
 * Tests:
 * 1. 40% threshold detection (isScrobbled)
 * 2. Deduplication by playedAtRounded10s
 * 3. Replay guard (15 min on trackstats)
 * 4. Album completion (4-track min, 70% threshold)
 */

import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Scrobble from './src/models/Scrobble.js';
import TrackStats from './src/models/TrackStats.js';
import AlbumStats from './src/models/AlbumStats.js';
import UserStatsSummary from './src/models/UserStatsSummary.js';

dotenv.config();

const API_URL = 'http://localhost:5000/api/music';
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Dummy ObjectId
const TEST_ACCESS_TOKEN = 'test_token_placeholder'; // Will fail Spotify calls, but won't block

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ratesangeet';
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected');
}

async function cleanup() {
  // Clean test user data
  await Scrobble.deleteMany({ userId: TEST_USER_ID });
  await TrackStats.deleteMany({ userId: TEST_USER_ID });
  await AlbumStats.deleteMany({ userId: TEST_USER_ID });
  await UserStatsSummary.deleteMany({ userId: TEST_USER_ID });
  console.log('🧹 Cleaned test data');
}

async function test1_ScrobbleDetection() {
  console.log('\n🧪 TEST 1: Scrobble Detection (40% threshold)');
  
  const items = [
    {
      spotifyId: 'track1',
      trackName: 'Test Track 1',
      artistName: 'Test Artist',
      albumId: 'album1',
      albumName: 'Test Album',
      durationMs: 180000, // 3 minutes
      progressMs: 60000,  // 1 minute = 33% (should be SKIPPED)
      timestamp: Date.now(),
      device: 'test-device',
      clientVersion: 'v2.0.0',
    },
    {
      spotifyId: 'track2',
      trackName: 'Test Track 2',
      artistName: 'Test Artist',
      albumId: 'album1',
      albumName: 'Test Album',
      durationMs: 180000,
      progressMs: 75000,  // 41.6% (should be SCROBBLED)
      timestamp: Date.now(),
      device: 'test-device',
      clientVersion: 'v2.0.0',
    },
  ];

  const response = await axios.post(`${API_URL}/scrobbles/batch-upsert`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    items,
  });

  console.log('Response:', response.data);
  console.log('✅ Expected: processed=2, scrobbled=1, skipped=1');
  
  const scrobbles = await Scrobble.find({ userId: TEST_USER_ID }).lean();
  console.log(`📊 Scrobbles in DB: ${scrobbles.length}`);
  console.log('   - track1 (33%):', scrobbles.find(s => s.spotifyId === 'track1')?.isScrobbled ? 'SCROBBLED' : 'SKIPPED');
  console.log('   - track2 (41%):', scrobbles.find(s => s.spotifyId === 'track2')?.isScrobbled ? 'SCROBBLED' : 'SKIPPED');
}

async function test2_Deduplication() {
  console.log('\n🧪 TEST 2: Deduplication (playedAtRounded10s)');
  
  const baseTimestamp = Date.now();
  const items = [
    {
      spotifyId: 'track3',
      trackName: 'Test Track 3',
      artistName: 'Test Artist',
      albumId: 'album1',
      albumName: 'Test Album',
      durationMs: 180000,
      progressMs: 90000, // 50%
      timestamp: baseTimestamp,
      device: 'test-device',
      clientVersion: 'v2.0.0',
    },
    {
      spotifyId: 'track3',
      trackName: 'Test Track 3',
      artistName: 'Test Artist',
      albumId: 'album1',
      albumName: 'Test Album',
      durationMs: 180000,
      progressMs: 95000, // 52% (3 seconds later, should dedupe to same 10s window)
      timestamp: baseTimestamp + 3000,
      device: 'test-device',
      clientVersion: 'v2.0.0',
    },
  ];

  const response = await axios.post(`${API_URL}/scrobbles/batch-upsert`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    items,
  });

  console.log('Response:', response.data);
  console.log('✅ Expected: processed=2, scrobbled=1, duplicates=1');
  
  const count = await Scrobble.countDocuments({ userId: TEST_USER_ID, spotifyId: 'track3' });
  console.log(`📊 Track3 count in DB: ${count} (should be 1)`);
}

async function test3_ReplayGuard() {
  console.log('\n🧪 TEST 3: Replay Guard (15 min on trackstats)');
  
  // First play
  await axios.post(`${API_URL}/scrobbles/batch-upsert`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    items: [{
      spotifyId: 'track4',
      trackName: 'Test Track 4',
      artistName: 'Test Artist',
      durationMs: 180000,
      progressMs: 90000,
      timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
    }],
  });

  const beforeStats = await TrackStats.findOne({ userId: TEST_USER_ID, trackKey: 'track4' }).lean();
  console.log('📊 TrackStats after first play:', { playCount: beforeStats?.playCount, replayGuardAt: beforeStats?.replayGuardAt });

  // Second play (should increment playCount because >15 min)
  await axios.post(`${API_URL}/scrobbles/batch-upsert`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    items: [{
      spotifyId: 'track4',
      trackName: 'Test Track 4',
      artistName: 'Test Artist',
      durationMs: 180000,
      progressMs: 90000,
      timestamp: Date.now(),
    }],
  });

  const afterStats = await TrackStats.findOne({ userId: TEST_USER_ID, trackKey: 'track4' }).lean();
  console.log('📊 TrackStats after second play:', { playCount: afterStats?.playCount });
  console.log('✅ Expected: playCount=2 (replay guard passed)');
}

async function test4_AlbumCompletion() {
  console.log('\n🧪 TEST 4: Album Completion (4-track min, 70% threshold)');
  console.log('⚠️  NOTE: Will fail if album1 has <4 tracks (need real Spotify album)');
  
  // Play 3 unique tracks from a 4-track album = 75% (should complete)
  const items = ['track5', 'track6', 'track7'].map((id, i) => ({
    spotifyId: id,
    trackName: `Test Track ${i + 5}`,
    artistName: 'Test Artist',
    albumId: 'album1',
    albumName: 'Test Album',
    durationMs: 180000,
    progressMs: 90000,
    timestamp: Date.now() + i * 1000,
  }));

  await axios.post(`${API_URL}/scrobbles/batch-upsert`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    items,
  });

  const albumStats = await AlbumStats.findOne({ userId: TEST_USER_ID, albumKey: 'album1' }).lean();
  console.log('📊 AlbumStats:', {
    playCount: albumStats?.playCount,
    albumPlayCount: albumStats?.albumPlayCount,
    uniqueTracksPlayed: albumStats?.uniqueTracksPlayed?.length,
    totalTracks: albumStats?.totalTracks,
  });
  console.log('✅ Expected: albumPlayCount=1 IF totalTracks=4 AND 3/4 >= 70%');
}

async function runTests() {
  try {
    await connectDB();
    await cleanup();
    
    await test1_ScrobbleDetection();
    await cleanup();
    
    await test2_Deduplication();
    await cleanup();
    
    await test3_ReplayGuard();
    await cleanup();
    
    await test4_AlbumCompletion();
    
    console.log('\n✅ All tests completed!');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
