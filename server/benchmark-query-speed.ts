import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function benchmarkQuerySpeed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;

    // ============================================================
    // TEST 1: Denormalized (Current) - Get 20 recent scrobbles
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 TEST 1: DENORMALIZED (Current Design)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const denormStart = Date.now();
    const denormScrobbles = await db.collection('scrobbles')
      .find()
      .sort({ playedAt: -1 })
      .limit(20)
      .toArray();
    const denormTime = Date.now() - denormStart;

    console.log(`Query: Find 20 recent scrobbles`);
    console.log(`Result: ${denormScrobbles.length} documents`);
    console.log(`⚡ Time: ${denormTime}ms`);
    console.log(`Queries: 1`);
    console.log(`Data available: trackName, albumName, artistName, albumArt (ALL in one query)`);

    // ============================================================
    // TEST 2: Hybrid - Scrobbles + Populate Albums for Art
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 TEST 2: HYBRID (Scrobbles + Populate for albumArt)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const hybridStart = Date.now();
    
    // Query 1: Get scrobbles (with trackName, albumName embedded)
    const hybridScrobbles = await db.collection('scrobbles')
      .find()
      .sort({ playedAt: -1 })
      .limit(20)
      .toArray();
    
    const query1Time = Date.now() - hybridStart;
    
    // Query 2: Get album art URLs for these scrobbles
    const albumIds = [...new Set(hybridScrobbles.map(s => s.albumId).filter(Boolean))];
    const albums = await db.collection('albumstats')
      .find({ albumId: { $in: albumIds } })
      .project({ albumId: 1, albumArt: 1 })
      .toArray();
    
    const hybridTime = Date.now() - hybridStart;
    
    // Simulate join in app
    const albumArtMap = new Map(albums.map(a => [a.albumId, a.albumArt]));
    const hybridResults = hybridScrobbles.map(s => ({
      ...s,
      albumArt: albumArtMap.get(s.albumId)
    }));

    console.log(`Query 1: Find 20 recent scrobbles (${query1Time}ms)`);
    console.log(`Query 2: Get ${albumIds.length} album arts (${hybridTime - query1Time}ms)`);
    console.log(`Result: ${hybridResults.length} documents`);
    console.log(`⚡ Total Time: ${hybridTime}ms`);
    console.log(`Queries: 2`);
    console.log(`Slowdown: +${hybridTime - denormTime}ms (${((hybridTime / denormTime - 1) * 100).toFixed(1)}% slower)`);

    // ============================================================
    // TEST 3: Fully Normalized - Multiple Populates
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗🔗🔗 TEST 3: FULLY NORMALIZED (Multiple Populates)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const normalizedStart = Date.now();
    
    // Query 1: Get scrobbles (only IDs)
    const normalizedScrobbles = await db.collection('scrobbles')
      .find()
      .sort({ playedAt: -1 })
      .limit(20)
      .project({ trackId: 1, albumId: 1, playedAt: 1 })
      .toArray();
    
    const q1Time = Date.now() - normalizedStart;
    
    // Query 2: Get track names
    const trackIds = [...new Set(normalizedScrobbles.map(s => s.spotifyId).filter(Boolean))];
    const tracks = await db.collection('trackstats')
      .find({ trackId: { $in: trackIds } })
      .project({ trackId: 1, trackName: 1, albumName: 1 })
      .toArray();
    
    const q2Time = Date.now() - normalizedStart - q1Time;
    
    // Query 3: Get album arts
    const normalizedAlbumIds = [...new Set(normalizedScrobbles.map(s => s.albumId).filter(Boolean))];
    const normalizedAlbums = await db.collection('albumstats')
      .find({ albumId: { $in: normalizedAlbumIds } })
      .project({ albumId: 1, albumArt: 1 })
      .toArray();
    
    const q3Time = Date.now() - normalizedStart - q1Time - q2Time;
    
    // Query 4: Get artist names
    const artistNames = await db.collection('albumstats')
      .find({ albumId: { $in: normalizedAlbumIds } })
      .project({ albumId: 1, artistName: 1 })
      .toArray();
    
    const normalizedTime = Date.now() - normalizedStart;
    const q4Time = normalizedTime - q1Time - q2Time - q3Time;

    console.log(`Query 1: Find 20 scrobbles (IDs only) (${q1Time}ms)`);
    console.log(`Query 2: Get ${trackIds.length} track names (${q2Time}ms)`);
    console.log(`Query 3: Get ${normalizedAlbumIds.length} album arts (${q3Time}ms)`);
    console.log(`Query 4: Get ${normalizedAlbumIds.length} artist names (${q4Time}ms)`);
    console.log(`Result: ${normalizedScrobbles.length} documents (after 4 joins)`);
    console.log(`⚡ Total Time: ${normalizedTime}ms`);
    console.log(`Queries: 4`);
    console.log(`Slowdown: +${normalizedTime - denormTime}ms (${((normalizedTime / denormTime - 1) * 100).toFixed(1)}% slower)`);

    // ============================================================
    // SUMMARY COMPARISON
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PERFORMANCE SUMMARY (20 Scrobbles)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`1. 📦 Denormalized:  ${denormTime}ms (1 query)  ⚡ BASELINE`);
    console.log(`2. 🔗 Hybrid:        ${hybridTime}ms (2 queries) +${hybridTime - denormTime}ms (+${((hybridTime / denormTime - 1) * 100).toFixed(0)}%)`);
    console.log(`3. 🔗🔗🔗 Normalized:   ${normalizedTime}ms (4 queries) +${normalizedTime - denormTime}ms (+${((normalizedTime / denormTime - 1) * 100).toFixed(0)}%)`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 USER EXPERIENCE IMPACT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const denormFps = 1000 / denormTime;
    const hybridFps = 1000 / hybridTime;
    const normalizedFps = 1000 / normalizedTime;

    console.log('Loading Home Screen (20 items):');
    console.log(`  Denormalized:  ${denormTime}ms  ${denormTime < 100 ? '✅ Instant' : denormTime < 300 ? '🟡 Fast' : '🔴 Slow'}`);
    console.log(`  Hybrid:        ${hybridTime}ms  ${hybridTime < 100 ? '✅ Instant' : hybridTime < 300 ? '🟡 Fast' : '🔴 Slow'}`);
    console.log(`  Normalized:    ${normalizedTime}ms  ${normalizedTime < 100 ? '✅ Instant' : normalizedTime < 300 ? '🟡 Fast' : '🔴 Slow'}`);

    console.log('\nInfinite Scroll (loading 20 more):');
    console.log(`  Denormalized:  Can load ${denormFps.toFixed(1)}x per second`);
    console.log(`  Hybrid:        Can load ${hybridFps.toFixed(1)}x per second (${((hybridFps / denormFps) * 100).toFixed(0)}%)`);
    console.log(`  Normalized:    Can load ${normalizedFps.toFixed(1)}x per second (${((normalizedFps / denormFps) * 100).toFixed(0)}%)`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 NETWORK IMPACT (Mobile App)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const denormSize = JSON.stringify(denormScrobbles).length;
    const hybridSize = JSON.stringify(hybridResults).length;
    
    console.log(`Denormalized: ${(denormSize / 1024).toFixed(2)} KB (1 HTTP request)`);
    console.log(`Hybrid:       ${(hybridSize / 1024).toFixed(2)} KB (2 HTTP requests)`);
    console.log(`\nNetwork overhead: ${((hybridTime - denormTime) + 50)}ms estimated (${50}ms per extra HTTP request)`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 RECOMMENDATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (hybridTime - denormTime < 20) {
      console.log('✅ Hybrid is ACCEPTABLE! (<20ms slowdown)');
      console.log('   Users won\'t notice the difference.');
      console.log('   Consider switching if storage is a concern.');
    } else if (hybridTime - denormTime < 50) {
      console.log('🟡 Hybrid is NOTICEABLE but OK (20-50ms slowdown)');
      console.log('   Users may notice slight lag on slow connections.');
      console.log('   Worth it if storage costs are high.');
    } else {
      console.log('🔴 Hybrid has SIGNIFICANT slowdown (>50ms)');
      console.log('   Users will notice the lag, especially on mobile.');
      console.log('   Stick with denormalized unless storage is critical.');
    }

    if (normalizedTime - denormTime < 50) {
      console.log('\n✅ Fully Normalized is also acceptable (<50ms)');
    } else if (normalizedTime - denormTime < 100) {
      console.log('\n🟡 Fully Normalized is slower but manageable (<100ms)');
    } else {
      console.log('\n🔴 Fully Normalized is TOO SLOW for production (>100ms)');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

benchmarkQuerySpeed();
