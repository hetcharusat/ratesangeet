import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const TEST_USER_ID = '6913a8ead11693d2faa25b01';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ HYBRID NORMALIZATION - ENDPOINT VERIFICATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testHybridEndpoints() {
  let passed = 0;
  let failed = 0;

  // Test 1: v2/scrobbles/recent (HYBRID)
  console.log('TEST 1: GET /v2/scrobbles/recent');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const start = Date.now();
    const response = await axios.get(`${API_URL}/v2/scrobbles/recent`, {
      params: { limit: 20 },
      headers: { 'x-user-id': TEST_USER_ID },
    });
    const time = Date.now() - start;

    console.log(`✅ Status: ${response.status}`);
    console.log(`⚡ Time: ${time}ms`);
    console.log(`📦 Items: ${response.data.items.length}`);

    const sample = response.data.items[0];
    console.log(`\nSample scrobble:`);
    console.log(`  Track: ${sample.trackName}`);
    console.log(`  Album: ${sample.albumName}`);
    console.log(`  Album Art: ${sample.albumArt ? 'Present ✅' : 'Missing ❌'}`);
    console.log(`  albumRefId leaked: ${sample.albumRefId !== undefined ? 'YES ❌' : 'NO ✅'}`);

    if (sample.albumArt && sample.albumRefId === undefined) {
      console.log('\n✅ HYBRID POPULATE WORKING!\n');
      passed++;
    } else {
      console.log('\n❌ HYBRID POPULATE FAILED\n');
      failed++;
    }
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}\n`);
    failed++;
  }

  // Test 2: Test a scrobble to verify hybrid normalization on write
  console.log('\nTEST 2: POST /v2/scrobbles/batch-upsert (Hybrid Write)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const testScrobble = {
      spotifyId: '3neOwym9kfYsM1QWaR77C1',
      trackName: 'Test Track',
      artistName: 'Test Artist',
      albumId: '2guirTSEqLizK7j9i1MTTZ',
      albumName: 'Test Album',
      albumArt: 'https://i.scdn.co/image/test.jpg',
      durationMs: 180000,
      progressMs: 90000, // 50% played
      playedAt: new Date().toISOString(),
      source: 'spotify',
      device: 'test',
      clientVersion: 'test-v1',
    };

    const start = Date.now();
    const response = await axios.post(
      `${API_URL}/v2/scrobbles/batch-upsert`,
      { items: [testScrobble] },
      { headers: { 'x-user-id': TEST_USER_ID } }
    );
    const time = Date.now() - start;

    console.log(`✅ Status: ${response.status}`);
    console.log(`⚡ Time: ${time}ms`);
    console.log(`📦 Processed: ${response.data.processed}`);
    console.log(`📦 Scrobbled: ${response.data.scrobbled}`);

    if (response.data.processed > 0) {
      console.log('\n✅ HYBRID WRITE WORKING!\n');
      passed++;
    } else {
      console.log('\n❌ HYBRID WRITE FAILED\n');
      failed++;
    }
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}\n`);
    failed++;
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Total: ${passed + failed} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}\n`);

  if (failed === 0) {
    console.log('🎉 ALL HYBRID ENDPOINTS WORKING!');
    console.log('✅ PRODUCTION READY FOR HYBRID NORMALIZATION\n');
  } else {
    console.log('❌ SOME TESTS FAILED - FIX BEFORE PRODUCTION\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

testHybridEndpoints().catch(console.error);
