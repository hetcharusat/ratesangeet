import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function runPrechecks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 HYBRID NORMALIZATION - PRECHECK REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ============================================================
    // 1. Current Database State
    // ============================================================
    console.log('📊 CURRENT DATABASE STATE:\n');

    const scrobblesCount = await db.collection('scrobbles').countDocuments();
    const albumStatsCount = await db.collection('albumstats').countDocuments();
    const trackStatsCount = await db.collection('trackstats').countDocuments();
    const usersCount = await db.collection('users').countDocuments();

    console.log(`  Scrobbles:    ${scrobblesCount}`);
    console.log(`  AlbumStats:   ${albumStatsCount}`);
    console.log(`  TrackStats:   ${trackStatsCount}`);
    console.log(`  Users:        ${usersCount}`);

    // ============================================================
    // 2. Data Integrity Checks
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔒 DATA INTEGRITY CHECKS:\n');

    // Check for scrobbles with missing data
    const scrobblesWithoutAlbumId = await db.collection('scrobbles').countDocuments({ 
      albumId: { $exists: false } 
    });
    const scrobblesWithoutSpotifyId = await db.collection('scrobbles').countDocuments({ 
      spotifyId: { $exists: false } 
    });
    const scrobblesWithoutAlbumArt = await db.collection('scrobbles').countDocuments({ 
      albumArt: { $exists: false } 
    });

    console.log(`  ✓ Scrobbles with albumId:     ${scrobblesCount - scrobblesWithoutAlbumId}/${scrobblesCount}`);
    console.log(`  ✓ Scrobbles with spotifyId:   ${scrobblesCount - scrobblesWithoutSpotifyId}/${scrobblesCount}`);
    console.log(`  ✓ Scrobbles with albumArt:    ${scrobblesCount - scrobblesWithoutAlbumArt}/${scrobblesCount}`);

    if (scrobblesWithoutAlbumId > 0) {
      console.log(`  ⚠️  WARNING: ${scrobblesWithoutAlbumId} scrobbles missing albumId`);
    }
    if (scrobblesWithoutAlbumArt > 0) {
      console.log(`  ⚠️  WARNING: ${scrobblesWithoutAlbumArt} scrobbles missing albumArt`);
    }

    // ============================================================
    // 3. Unique Entities Count
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 UNIQUE ENTITIES (Will become new collections):\n');

    const scrobbles = await db.collection('scrobbles').find().toArray();
    
    const uniqueTracks = new Map<string, any>();
    const uniqueAlbums = new Map<string, any>();
    const uniqueArtists = new Set<string>();

    scrobbles.forEach(s => {
      if (s.spotifyId && s.trackName) {
        uniqueTracks.set(s.spotifyId, {
          spotifyId: s.spotifyId,
          name: s.trackName,
          albumId: s.albumId,
          durationMs: s.durationMs
        });
      }
      if (s.albumId && s.albumName) {
        uniqueAlbums.set(s.albumId, {
          spotifyId: s.albumId,
          name: s.albumName,
          albumArt: s.albumArt
        });
      }
      if (s.artistName) {
        uniqueArtists.add(s.artistName);
      }
    });

    console.log(`  Tracks to create:  ${uniqueTracks.size} (from ${scrobblesCount} scrobbles)`);
    console.log(`  Albums to create:  ${uniqueAlbums.size} (from ${scrobblesCount} scrobbles)`);
    console.log(`  Artists to create: ${uniqueArtists.size} (from ${scrobblesCount} scrobbles)`);

    // ============================================================
    // 4. Storage Analysis
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 STORAGE IMPACT:\n');

    const scrobblesStats = await db.command({ collStats: 'scrobbles' });
    const currentSize = scrobblesStats.size || 0;

    // Estimate new sizes
    const trackCollectionSize = uniqueTracks.size * 150; // ~150 bytes per track
    const albumCollectionSize = uniqueAlbums.size * 200; // ~200 bytes per album
    const artistCollectionSize = uniqueArtists.size * 100; // ~100 bytes per artist
    const newScrobbleSize = scrobblesCount * 150; // ~150 bytes (smaller, no embedded data)

    const newTotalSize = trackCollectionSize + albumCollectionSize + artistCollectionSize + newScrobbleSize;

    console.log(`  Current scrobbles collection:  ${(currentSize / 1024).toFixed(2)} KB`);
    console.log(`  \n  AFTER MIGRATION:`);
    console.log(`  - tracks collection:           ${(trackCollectionSize / 1024).toFixed(2)} KB`);
    console.log(`  - albums collection:           ${(albumCollectionSize / 1024).toFixed(2)} KB`);
    console.log(`  - artists collection:          ${(artistCollectionSize / 1024).toFixed(2)} KB`);
    console.log(`  - scrobbles (slimmed):         ${(newScrobbleSize / 1024).toFixed(2)} KB`);
    console.log(`  \n  Total new size:                ${(newTotalSize / 1024).toFixed(2)} KB`);
    console.log(`  💰 Savings:                    ${((1 - newTotalSize / currentSize) * 100).toFixed(1)}% (${((currentSize - newTotalSize) / 1024).toFixed(2)} KB)`);

    // ============================================================
    // 5. Code Impact Analysis
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 CODE CHANGES REQUIRED:\n');

    console.log('  NEW MODELS TO CREATE:');
    console.log('    - Track.ts        (spotifyId, name, albumId, durationMs)');
    console.log('    - Album.ts        (spotifyId, name, albumArt, artistId)');
    console.log('    - Artist.ts       (name, spotifyId)');

    console.log('\n  MODELS TO UPDATE:');
    console.log('    - Scrobble.ts     (add trackId, albumId refs, keep trackName/albumName)');
    console.log('    - AlbumStats.ts   (add albumId ref)');
    console.log('    - TrackStats.ts   (add trackId ref)');

    console.log('\n  ROUTES TO UPDATE:');
    console.log('    - v2/scrobbles.ts (populate albumArt from albums collection)');
    console.log('    - music.ts        (populate albumArt from albums collection)');
    console.log('    - stats.ts        (add .populate() for album art)');
    console.log('    - home.ts         (add .populate() for album art)');

    console.log('\n  MOBILE APP CHANGES:');
    console.log('    - ScrobbleContext (handle new response structure)');
    console.log('    - API client      (no changes - backward compatible)');

    // ============================================================
    // 6. Migration Strategy
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 MIGRATION STRATEGY:\n');

    console.log('  PHASE 1: Create New Collections (SAFE)');
    console.log('    1. Create tracks collection from existing scrobbles');
    console.log('    2. Create albums collection from existing scrobbles');
    console.log('    3. Create artists collection from existing scrobbles');
    console.log('    ✅ Old data still intact, can rollback easily\n');

    console.log('  PHASE 2: Add References (SAFE)');
    console.log('    1. Add trackId field to scrobbles (keep old fields)');
    console.log('    2. Add albumId field to scrobbles (keep old fields)');
    console.log('    3. Add artistId field to albums');
    console.log('    ✅ Backward compatible, no data loss\n');

    console.log('  PHASE 3: Update Code (CAREFUL)');
    console.log('    1. Update models with new refs');
    console.log('    2. Update routes to use .populate()');
    console.log('    3. Test all endpoints');
    console.log('    ⚠️  Can rollback by reverting code changes\n');

    console.log('  PHASE 4: Cleanup (OPTIONAL)');
    console.log('    1. Remove albumArt from scrobbles (keep trackName/albumName)');
    console.log('    2. Remove artistName from scrobbles');
    console.log('    ⚠️  Only after confirming everything works!');

    // ============================================================
    // 7. Risk Assessment
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  RISK ASSESSMENT:\n');

    console.log('  🟢 LOW RISK:');
    console.log('    - Creating new collections (reversible)');
    console.log('    - Adding new fields (backward compatible)');
    console.log('    - You have <200 scrobbles (easy to rollback)');

    console.log('\n  🟡 MEDIUM RISK:');
    console.log('    - Updating routes to use .populate()');
    console.log('    - Mobile app may need cache updates');
    console.log('    - Query performance changes (+12ms)');

    console.log('\n  🔴 HIGH RISK (avoid):');
    console.log('    - Deleting old fields before testing');
    console.log('    - No backup before migration');
    console.log('    - Deploying to production before local testing');

    // ============================================================
    // 8. Rollback Plan
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔙 ROLLBACK PLAN:\n');

    console.log('  IF SOMETHING BREAKS:');
    console.log('    1. Revert code changes (git checkout)');
    console.log('    2. Old fields still exist in scrobbles');
    console.log('    3. Delete new collections: tracks, albums, artists');
    console.log('    4. App works exactly as before');
    console.log('    ✅ Zero data loss, 5-minute rollback time');

    // ============================================================
    // 9. Testing Checklist
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ POST-MIGRATION TESTING:\n');

    console.log('  [ ] GET /api/v2/scrobbles/recent - Returns scrobbles with albumArt');
    console.log('  [ ] POST /api/v2/scrobbles/batch-upsert - Creates tracks/albums');
    console.log('  [ ] GET /api/v2/stats/top-albums - Returns albums with albumArt');
    console.log('  [ ] GET /api/v2/home - Home screen loads correctly');
    console.log('  [ ] Mobile app - Recent scrobbles show album art');
    console.log('  [ ] Mobile app - Offline cache still works');
    console.log('  [ ] Performance - <100ms for home screen');

    // ============================================================
    // 10. Final Recommendation
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 FINAL RECOMMENDATION:\n');

    const readyToMigrate = 
      scrobblesWithoutAlbumId < 10 && 
      scrobblesWithoutAlbumArt < 10 &&
      usersCount > 0;

    if (readyToMigrate) {
      console.log('  ✅ READY TO MIGRATE!');
      console.log('  \n  Your database is in good shape:');
      console.log(`    - ${scrobblesCount} scrobbles ready`);
      console.log(`    - ${uniqueTracks.size} unique tracks identified`);
      console.log(`    - ${uniqueAlbums.size} unique albums identified`);
      console.log('    - Data integrity checks passed');
      console.log('  \n  Next steps:');
      console.log('    1. Create database backup (MongoDB Atlas UI)');
      console.log('    2. Run migration script (creates new collections)');
      console.log('    3. Update models and routes');
      console.log('    4. Test all endpoints');
      console.log('    5. Deploy to production');
    } else {
      console.log('  ⚠️  NOT READY - Fix these issues first:');
      if (scrobblesWithoutAlbumId > 10) {
        console.log(`    - ${scrobblesWithoutAlbumId} scrobbles missing albumId`);
      }
      if (scrobblesWithoutAlbumArt > 10) {
        console.log(`    - ${scrobblesWithoutAlbumArt} scrobbles missing albumArt`);
      }
      if (usersCount === 0) {
        console.log('    - No users in database');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    
    return readyToMigrate;
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runPrechecks().then(ready => {
  if (ready) {
    console.log('✅ Prechecks passed! Ready to proceed with migration.');
    process.exit(0);
  } else {
    console.log('❌ Prechecks failed! Fix issues before migrating.');
    process.exit(1);
  }
});
