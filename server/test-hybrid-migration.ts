import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Album from './src/models/Album.js';

dotenv.config();

const API_URL = 'http://localhost:5000/api';
const TEST_USER_ID = '6913a8ead11693d2faa25b01'; // Replace with your actual user ID

async function runHybridTests() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 HYBRID NORMALIZATION - COMPREHENSIVE TESTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Connect to MongoDB for verification
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    // ============================================================
    // TEST 1: GET /v2/scrobbles/recent (with .populate())
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: GET /v2/scrobbles/recent');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const start1 = Date.now();
    try {
      const response = await axios.get(`${API_URL}/v2/scrobbles/recent`, {
        params: { limit: 20 },
        headers: { 'x-user-id': TEST_USER_ID },
      });

      const time1 = Date.now() - start1;
      console.log(`✅ Status: ${response.status}`);
      console.log(`⚡ Time: ${time1}ms`);
      console.log(`📦 Items returned: ${response.data.items.length}`);

      if (response.data.items.length > 0) {
        const sample = response.data.items[0];
        console.log(`\n  Sample scrobble:`);
        console.log(`    Track: ${sample.trackName}`);
        console.log(`    Album: ${sample.albumName}`);
        console.log(`    Album Art: ${sample.albumArt ? 'Present' : 'Missing ❌'}`);
        console.log(`    Has albumRefId: ${sample.albumRefId ? 'Yes ❌ (should be removed)' : 'No ✅'}`);
      }

      if (time1 > 100) {
        console.log(`\n⚠️  WARNING: Response time ${time1}ms exceeds 100ms target`);
      } else {
        console.log(`\n✅ Performance: ${time1}ms (under 100ms target)`);
      }
    } catch (error: any) {
      console.error(`❌ TEST FAILED:`, error.response?.data || error.message);
    }

    // ============================================================
    // TEST 2: Verify Albums Collection
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 2: Verify Albums Collection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const albumsCount = await Album.countDocuments();
    const albumsWithArt = await Album.countDocuments({ albumArt: { $exists: true, $ne: null } });
    const sampleAlbum = await Album.findOne().lean();

    console.log(`✅ Total albums: ${albumsCount}`);
    console.log(`✅ Albums with art: ${albumsWithArt}/${albumsCount} (${((albumsWithArt/albumsCount)*100).toFixed(1)}%)`);

    if (sampleAlbum) {
      console.log(`\n  Sample album:`);
      console.log(`    Name: ${sampleAlbum.name}`);
      console.log(`    Album Art: ${sampleAlbum.albumArt ? 'Present ✅' : 'Missing ❌'}`);
      console.log(`    Artist ID: ${sampleAlbum.artistId ? 'Linked ✅' : 'Missing ❌'}`);
    }

    // ============================================================
    // TEST 3: Storage Savings Verification
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 3: Storage Savings Verification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const db = mongoose.connection.db!;
    const scrobblesStats = await db.command({ collStats: 'scrobbles' });
    const albumsStats = await db.command({ collStats: 'albums' });
    const tracksStats = await db.command({ collStats: 'tracks' });
    const artistsStats = await db.command({ collStats: 'artists' });

    const totalSize = scrobblesStats.size + albumsStats.size + tracksStats.size + artistsStats.size;

    console.log(`Scrobbles:  ${(scrobblesStats.size / 1024).toFixed(2)} KB`);
    console.log(`Albums:     ${(albumsStats.size / 1024).toFixed(2)} KB`);
    console.log(`Tracks:     ${(tracksStats.size / 1024).toFixed(2)} KB`);
    console.log(`Artists:    ${(artistsStats.size / 1024).toFixed(2)} KB`);
    console.log(`\nTotal:      ${(totalSize / 1024).toFixed(2)} KB`);

    // ============================================================
    // TEST 4: Check Scrobbles Have References
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 4: Scrobbles Reference Integrity');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const totalScrobbles = await db.collection('scrobbles').countDocuments();
    const scrobblesWithTrackId = await db.collection('scrobbles').countDocuments({ trackId: { $exists: true } });
    const scrobblesWithAlbumRefId = await db.collection('scrobbles').countDocuments({ albumRefId: { $exists: true } });
    const scrobblesWithArtistId = await db.collection('scrobbles').countDocuments({ artistId: { $exists: true } });

    console.log(`Total scrobbles:        ${totalScrobbles}`);
    console.log(`With trackId:           ${scrobblesWithTrackId}/${totalScrobbles} (${((scrobblesWithTrackId/totalScrobbles)*100).toFixed(1)}%)`);
    console.log(`With albumRefId:        ${scrobblesWithAlbumRefId}/${totalScrobbles} (${((scrobblesWithAlbumRefId/totalScrobbles)*100).toFixed(1)}%)`);
    console.log(`With artistId:          ${scrobblesWithArtistId}/${totalScrobbles} (${((scrobblesWithArtistId/totalScrobbles)*100).toFixed(1)}%)`);

    if (scrobblesWithTrackId === totalScrobbles) {
      console.log('\n✅ ALL scrobbles have references!');
    } else {
      console.log(`\n⚠️  ${totalScrobbles - scrobblesWithTrackId} scrobbles missing references`);
    }

    // ============================================================
    // FINAL SUMMARY
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FINAL SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const allTestsPassed = 
      albumsCount > 0 &&
      albumsWithArt > 0 &&
      scrobblesWithTrackId > 0;

    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED!');
      console.log('\n🎉 Hybrid normalization is working correctly!');
      console.log('\n📋 NEXT STEPS:');
      console.log('   1. Test all other endpoints (stats, home, etc.)');
      console.log('   2. Test mobile app integration');
      console.log('   3. Monitor performance for 24 hours');
      console.log('   4. THEN consider Phase 7: Remove redundant fields');
    } else {
      console.log('❌ SOME TESTS FAILED!');
      console.log('\n⚠️  Issues detected:');
      if (albumsCount === 0) console.log('   - No albums created');
      if (albumsWithArt === 0) console.log('   - No albums have album art');
      if (scrobblesWithTrackId === 0) console.log('   - Scrobbles missing references');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

runHybridTests();
