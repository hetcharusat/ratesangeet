// Simple smoke tests to verify envelope header and shapes
const BASE = process.env.API_BASE || 'http://localhost:5000';

function assert(cond, msg) {
  if (!cond) {
    console.error('ASSERTION FAILED:', msg);
    process.exit(1);
  }
}

async function checkHealthHeader() {
  const resp = await fetch(`${BASE}/api/health`);
  const hdr = resp.headers.get('x-api-envelope');
  const body = await resp.json();
  console.log('Health:', resp.status, hdr, body);
  assert(resp.status === 200, 'Health should be 200');
  assert(hdr === 'transitional-v1', 'X-API-Envelope header should be transitional-v1');
}

async function checkCurrentlyPlayingOptionalAuth() {
  const token = process.env.SPOTIFY_ACCESS_TOKEN;
  if (!token) {
    console.log('Skipping authenticated check: SPOTIFY_ACCESS_TOKEN not set');
    return;
  }
  const url = new URL(`${BASE}/api/music/currently-playing`);
  url.searchParams.set('accessToken', token);
  const resp = await fetch(url.toString());
  const body = await resp.json();
  console.log('CurrentlyPlaying:', resp.status, body);
  assert(resp.status === 200, 'currently-playing should return 200 with token');
  assert(typeof body.success === 'boolean' && body.success === true, 'Envelope success true');
  assert(body.data && typeof body.data.isPlaying === 'boolean', 'data.isPlaying boolean present');
}

async function main() {
  await checkHealthHeader();
  await checkCurrentlyPlayingOptionalAuth();
  console.log('✅ Envelope smoke tests passed');
}

main().catch((e) => {
  console.error('Smoke tests failed:', e);
  process.exit(1);
});
