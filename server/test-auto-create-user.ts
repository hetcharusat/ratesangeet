import axios from 'axios';

/**
 * Test script to validate ROOT FIX: auto-create missing user before scrobble.
 *
 * Usage (PowerShell):
 *   $env:API_BASE="http://localhost:5000/api"; $env:ACCESS_TOKEN="<spotify_access_token>"; $env:MISSING_USER_ID="<hex24>"; npx tsx test-auto-create-user.ts
 *
 * Preconditions:
 * - ACCESS_TOKEN must be a valid Spotify user token (scope: user-read-currently-playing)
 * - MISSING_USER_ID should be a 24-char ObjectId that does NOT exist in the users collection.
 * - Ensure something is actively playing in Spotify that crosses the 40% threshold.
 */
(async () => {
  const base = process.env.API_BASE || 'http://localhost:5000/api';
  const accessToken = process.env.ACCESS_TOKEN;
  const missingUserId = process.env.MISSING_USER_ID;

  if (!accessToken || !missingUserId) {
    console.error('❌ Missing ACCESS_TOKEN or MISSING_USER_ID env variables');
    process.exit(1);
  }

  console.log('🔍 Verifying user does not already exist...');
  try {
    const userResp = await axios.get(`${base}/users/${missingUserId}`);
    console.error('⚠️ User already exists – pick a different MISSING_USER_ID');
    process.exit(1);
  } catch (e: any) {
    if (e.response?.status === 404) {
      console.log('✅ User confirmed missing. Proceeding with scrobble test.');
    } else {
      console.error('❌ Unexpected error checking user:', e.response?.data || e.message);
      process.exit(1);
    }
  }

  console.log('🎵 Attempting scrobble... (ensure track playing >40%)');
  try {
    const scrobbleResp = await axios.post(`${base}/music/scrobble`, {
      accessToken,
      userId: missingUserId,
    });
    console.log('✅ Scrobble response:', scrobbleResp.data);
  } catch (e: any) {
    console.error('❌ Scrobble failed:', e.response?.data || e.message);
    process.exit(1);
  }

  console.log('🔁 Verifying user auto-created...');
  try {
    const userResp2 = await axios.get(`${base}/users/${missingUserId}`);
    console.log('✅ User now exists:', userResp2.data);
  } catch (e: any) {
    console.error('❌ User still missing after scrobble:', e.response?.data || e.message);
    process.exit(1);
  }

  console.log('📊 Checking AlbumStats created/updated...');
  try {
    const statsResp = await axios.get(`${base}/stats/album/${missingUserId}`, { params: { limit: 5 } });
    console.log('✅ AlbumStats sample:', statsResp.data);
  } catch (e: any) {
    console.error('⚠️ Could not fetch AlbumStats:', e.response?.data || e.message);
  }

  console.log('✅ Test complete');
})();
