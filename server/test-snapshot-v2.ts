/**
 * Test V2 server-assisted scrobbling (snapshot endpoint)
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000/api/scrobble';
const TEST_USER_ID = '507f1f77bcf86cd799439011';
const TEST_ACCESS_TOKEN = 'test_token';

async function testSnapshot() {
  console.log('\n🧪 Testing V2 Snapshot Endpoint');
  
  const snapshot = {
    spotifyId: 'track_test_1',
    trackName: 'Test Song',
    artistName: 'Test Artist',
    albumId: 'album_test',
    albumName: 'Test Album',
    albumArt: 'https://example.com/art.jpg',
    durationMs: 180000, // 3 minutes
    progressMs: 80000,  // 44% (should scrobble)
    timestamp: Date.now(),
    isPlaying: true,
    device: 'test-device',
  };

  try {
    const response = await axios.post(`${API_URL}/v2/snapshot`, {
      userId: TEST_USER_ID,
      accessToken: TEST_ACCESS_TOKEN,
      snapshot,
    });

    console.log('✅ Response:', response.data);
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function testTooEarly() {
  console.log('\n🧪 Testing Too Early (33%)');
  
  const snapshot = {
    spotifyId: 'track_test_2',
    trackName: 'Test Song 2',
    artistName: 'Test Artist',
    durationMs: 180000,
    progressMs: 60000, // 33% (should skip)
    timestamp: Date.now(),
    isPlaying: true,
  };

  try {
    const response = await axios.post(`${API_URL}/v2/snapshot`, {
      userId: TEST_USER_ID,
      accessToken: TEST_ACCESS_TOKEN,
      snapshot,
    });

    console.log('✅ Response:', response.data);
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function testDuplicate() {
  console.log('\n🧪 Testing Duplicate Detection');
  
  // Use progressMs from same timestamp window as first test
  // If first test had progressMs=80000, timestamp=T
  // Then playedAt = T - 80000, rounded to 10s
  // To hit same window, we need: (T2 - progressMs2) rounds to same 10s
  // Simplest: Use exact same timestamp and progressMs +5s (within 10s window)
  const baseTimestamp = Date.now() - 5000; // 5 seconds ago
  
  const snapshot = {
    spotifyId: 'track_test_1', // Same as first test
    trackName: 'Test Song',
    artistName: 'Test Artist',
    durationMs: 180000,
    progressMs: 85000, // 5 seconds more progress
    timestamp: baseTimestamp + 5000, // Same track session, 5s later
    isPlaying: true,
  };

  try {
    const response = await axios.post(`${API_URL}/v2/snapshot`, {
      userId: TEST_USER_ID,
      accessToken: TEST_ACCESS_TOKEN,
      snapshot,
    });

    console.log('✅ Response:', response.data);
    if (response.data.action === 'duplicate') {
      console.log('   🎉 Duplicate detection working!');
    } else {
      console.log('   ⚠️  Expected duplicate, got:', response.data.action);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function runTests() {
  await testSnapshot();
  await testTooEarly();
  await testDuplicate();
  console.log('\n✅ All V2 snapshot tests complete!');
}

runTests();
