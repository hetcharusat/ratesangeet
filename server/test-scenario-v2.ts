/**
 * Complete V2 Scrobbling Scenario Test
 * Simulates mobile app polling every 30 seconds
 */

import axios from 'axios';
import Scrobble from './src/models/Scrobble.js';
import TrackStats from './src/models/TrackStats.js';
import AlbumStats from './src/models/AlbumStats.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:5000/api/scrobble';
const TEST_USER_ID = '507f1f77bcf86cd799439012'; // Different user for clean test
const TEST_ACCESS_TOKEN = 'test_token';

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ratesangeet';
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected');
}

async function cleanup() {
  await Scrobble.deleteMany({ userId: TEST_USER_ID });
  await TrackStats.deleteMany({ userId: TEST_USER_ID });
  await AlbumStats.deleteMany({ userId: TEST_USER_ID });
  console.log('🧹 Cleaned test data');
}

async function scenario1_SingleTrackSession() {
  console.log('\n📱 SCENARIO 1: User plays single track, mobile polls 3 times');
  
  // Track starts playing at T=0
  const trackStartTime = Date.now() - 90000; // Started 90 seconds ago
  
  // Snapshot 1: Mobile polls at 30s into track
  console.log('\n⏰ Poll 1: 30 seconds in (16%)');
  const poll1 = await axios.post(`${API_URL}/v2/snapshot`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    snapshot: {
      spotifyId: 'track_scenario1',
      trackName: 'Test Track',
      artistName: 'Test Artist',
      durationMs: 180000, // 3 minutes
      progressMs: 30000,  // 30s = 16%
      timestamp: trackStartTime + 30000,
      isPlaying: true,
    },
  });
  console.log('   Action:', poll1.data.action, poll1.data.message);
  
  // Snapshot 2: Mobile polls at 60s into track (after 30s)
  console.log('\n⏰ Poll 2: 60 seconds in (33%)');
  const poll2 = await axios.post(`${API_URL}/v2/snapshot`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    snapshot: {
      spotifyId: 'track_scenario1',
      trackName: 'Test Track',
      artistName: 'Test Artist',
      durationMs: 180000,
      progressMs: 60000,  // 60s = 33%
      timestamp: trackStartTime + 60000,
      isPlaying: true,
    },
  });
  console.log('   Action:', poll2.data.action, poll2.data.message);
  
  // Snapshot 3: Mobile polls at 90s into track (after another 30s)
  console.log('\n⏰ Poll 3: 90 seconds in (50%) - SHOULD SCROBBLE NOW!');
  const poll3 = await axios.post(`${API_URL}/v2/snapshot`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    snapshot: {
      spotifyId: 'track_scenario1',
      trackName: 'Test Track',
      artistName: 'Test Artist',
      durationMs: 180000,
      progressMs: 90000,  // 90s = 50%
      timestamp: trackStartTime + 90000,
      isPlaying: true,
    },
  });
  console.log('   Action:', poll3.data.action, poll3.data.message);
  console.log('   Stats:', poll3.data.stats);
  
  // Verify DB state
  const scrobbles = await Scrobble.find({ userId: TEST_USER_ID, spotifyId: 'track_scenario1' }).lean();
  const trackStats = await TrackStats.findOne({ userId: TEST_USER_ID, trackKey: 'track_scenario1' }).lean();
  
  console.log('\n📊 Final State:');
  console.log('   Scrobbles in DB:', scrobbles.length, '(should be 3 - one per poll)');
  console.log('   isScrobbled=true count:', scrobbles.filter(s => s.isScrobbled).length, '(should be 1 - only poll 3)');
  console.log('   TrackStats playCount:', trackStats?.playCount, '(should be 1)');
}

async function scenario2_TrackSkip() {
  console.log('\n\n📱 SCENARIO 2: User skips track after 10 seconds');
  
  const trackStartTime = Date.now() - 10000; // Started 10 seconds ago
  
  console.log('\n⏰ Poll: 10 seconds in (5%) - user skips');
  const poll = await axios.post(`${API_URL}/v2/snapshot`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    snapshot: {
      spotifyId: 'track_scenario2',
      trackName: 'Skipped Track',
      artistName: 'Test Artist',
      durationMs: 180000,
      progressMs: 10000,  // 10s = 5%
      timestamp: trackStartTime + 10000,
      isPlaying: true,
    },
  });
  console.log('   Action:', poll.data.action, poll.data.message);
  
  const scrobbles = await Scrobble.find({ userId: TEST_USER_ID, spotifyId: 'track_scenario2' }).lean();
  const trackStats = await TrackStats.findOne({ userId: TEST_USER_ID, trackKey: 'track_scenario2' }).lean();
  
  console.log('\n📊 Final State:');
  console.log('   Scrobbles in DB:', scrobbles.length, '(should be 1)');
  console.log('   isScrobbled:', scrobbles[0]?.isScrobbled, '(should be false)');
  console.log('   TrackStats exists:', !!trackStats, '(should be false - not scrobbled)');
}

async function scenario3_DuplicatePrevention() {
  console.log('\n\n📱 SCENARIO 3: Mobile sends duplicate snapshots (same playback session)');
  
  const trackStartTime = Date.now() - 90000; // Started 90 seconds ago
  
  // Send same snapshot twice (simulating accidental double-send)
  console.log('\n⏰ First send: 90s in (50%)');
  const send1 = await axios.post(`${API_URL}/v2/snapshot`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    snapshot: {
      spotifyId: 'track_scenario3',
      trackName: 'Duplicate Test',
      artistName: 'Test Artist',
      durationMs: 180000,
      progressMs: 90000,
      timestamp: trackStartTime + 90000,
      isPlaying: true,
    },
  });
  console.log('   Action:', send1.data.action);
  
  // Send again with +2s progress (still within same 10s window)
  console.log('\n⏰ Second send: 92s in (51%) - within same 10s window');
  const send2 = await axios.post(`${API_URL}/v2/snapshot`, {
    userId: TEST_USER_ID,
    accessToken: TEST_ACCESS_TOKEN,
    snapshot: {
      spotifyId: 'track_scenario3',
      trackName: 'Duplicate Test',
      artistName: 'Test Artist',
      durationMs: 180000,
      progressMs: 92000,
      timestamp: trackStartTime + 92000,
      isPlaying: true,
    },
  });
  console.log('   Action:', send2.data.action, '(should be duplicate)');
  
  const scrobbles = await Scrobble.find({ userId: TEST_USER_ID, spotifyId: 'track_scenario3' }).lean();
  const trackStats = await TrackStats.findOne({ userId: TEST_USER_ID, trackKey: 'track_scenario3' }).lean();
  
  console.log('\n📊 Final State:');
  console.log('   Scrobbles in DB:', scrobbles.length, '(should be 1 - deduplicated)');
  console.log('   TrackStats playCount:', trackStats?.playCount, '(should be 1)');
}

async function runScenarios() {
  try {
    await connectDB();
    await cleanup();
    
    await scenario1_SingleTrackSession();
    await scenario2_TrackSkip();
    await scenario3_DuplicatePrevention();
    
    console.log('\n\n✅ All scenarios complete!');
    console.log('\n📝 Summary:');
    console.log('   - Mobile just polls every 30s and sends raw snapshots');
    console.log('   - Server calculates 40% threshold, dedup, replay guard');
    console.log('   - Zero complexity on mobile side!');
  } catch (error: any) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  } finally {
    await mongoose.disconnect();
  }
}

runScenarios();
