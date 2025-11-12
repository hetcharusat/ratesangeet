import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const TEST_USER_ID = '6913a8ead11693d2faa25b01'; // Replace with your actual user ID

interface TestResult {
  endpoint: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  time: number;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function runAllTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 PRODUCTION READINESS - COMPREHENSIVE ENDPOINT TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ============================================================
  // TEST 1: v2/scrobbles/recent (HYBRID)
  // ============================================================
  await testEndpoint({
    name: 'GET /v2/scrobbles/recent',
    url: `${API_URL}/v2/scrobbles/recent?limit=20`,
    headers: { 'x-user-id': TEST_USER_ID },
    validate: (data) => {
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('items array missing');
      }
      const sample = data.items[0];
      if (!sample.albumArt && sample.albumName !== 'Unknown Album') {
        throw new Error('albumArt missing (hybrid populate failed)');
      }
      if (sample.albumRefId !== undefined) {
        throw new Error('albumRefId leaked into response');
      }
      return `${data.items.length} scrobbles, albumArt: ${sample?.albumArt ? 'Present ✅' : 'Missing ❌'}`;
    },
  });

  // ============================================================
  // TEST 2: home/snapshot (HYBRID recent scrobbles)
  // ============================================================
  await testEndpoint({
    name: 'GET /home/snapshot',
    url: `${API_URL}/home/snapshot?userId=${TEST_USER_ID}`,
    validate: (data) => {
      if (!data.recentActivity?.scrobbles) {
        throw new Error('recentActivity.scrobbles missing');
      }
      const sample = data.recentActivity.scrobbles[0];
      if (!sample) {
        return 'No recent scrobbles';
      }
      if (!sample.albumArt && sample.albumName !== 'Unknown Album') {
        throw new Error('albumArt missing in home snapshot (hybrid populate failed)');
      }
      if (sample.albumRefId !== undefined) {
        throw new Error('albumRefId leaked into home response');
      }
      return `${data.recentActivity.scrobbles.length} scrobbles, albumArt: ${sample.albumArt ? 'Present ✅' : 'Missing ❌'}`;
    },
  });

  // ============================================================
  // TEST 3: stats/album (AlbumStats with albumArt)
  // ============================================================
  await testEndpoint({
    name: 'GET /stats/album/:userId',
    url: `${API_URL}/stats/album/${TEST_USER_ID}?limit=10`,
    validate: (data) => {
      if (!Array.isArray(data)) {
        throw new Error('Expected array of albums');
      }
      if (data.length === 0) {
        return 'No albums found';
      }
      const sample = data[0];
      if (!sample.albumArt) {
        throw new Error('albumArt missing from AlbumStats');
      }
      return `${data.length} albums, sample: ${sample.albumName} (art: ${sample.albumArt ? 'Present ✅' : 'Missing ❌'})`;
    },
  });

  // ============================================================
  // TEST 4: Server Health Check
  // ============================================================
  await testEndpoint({
    name: 'GET /health (server alive)',
    url: `${API_URL}/../health`,
    validate: (data) => {
      return `Server: ${data.status || 'OK'}`;
    },
  });

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log(`Total tests:  ${results.length}`);
  console.log(`✅ Passed:    ${passed}`);
  console.log(`⚠️  Warnings:  ${warned}`);
  console.log(`❌ Failed:    ${failed}\n`);

  // Performance summary
  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
  const maxTime = Math.max(...results.map(r => r.time));
  console.log(`Average response time: ${avgTime.toFixed(0)}ms`);
  console.log(`Max response time:     ${maxTime}ms\n`);

  // Detailed results
  console.log('Detailed Results:');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️ ' : '❌';
    console.log(`  ${icon} ${r.endpoint} (${r.time}ms)`);
    console.log(`     ${r.message}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - PRODUCTION READY! 🎉');
  } else {
    console.log('❌ SOME TESTS FAILED - FIX BEFORE PRODUCTION');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function testEndpoint(config: {
  name: string;
  url: string;
  headers?: any;
  validate: (data: any) => string;
}) {
  const start = Date.now();
  try {
    const response = await axios.get(config.url, {
      headers: config.headers || {},
      timeout: 5000,
    });

    const time = Date.now() - start;

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    const message = config.validate(response.data);

    const status = time > 200 ? 'WARN' : 'PASS';
    results.push({ endpoint: config.name, status, time, message });

    console.log(`${status === 'PASS' ? '✅' : '⚠️ '} ${config.name}`);
    console.log(`   Time: ${time}ms ${time > 200 ? '(SLOW)' : ''}`);
    console.log(`   ${message}\n`);
  } catch (error: any) {
    const time = Date.now() - start;
    const message = error.response?.data?.error || error.message;

    results.push({
      endpoint: config.name,
      status: 'FAIL',
      time,
      message,
      details: error.response?.data,
    });

    console.log(`❌ ${config.name}`);
    console.log(`   Time: ${time}ms`);
    console.log(`   Error: ${message}\n`);
  }
}

runAllTests().catch(console.error);
