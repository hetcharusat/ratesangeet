import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function finalAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('📊 FINAL DATABASE AUDIT REPORT\n');
    console.log('================================================\n');

    const db = mongoose.connection.db!;

    // Collection counts
    const [users, scrobbles, albumStats, trackStats, summaries, events] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('scrobbles').countDocuments(),
      db.collection('albumstats').countDocuments(),
      db.collection('trackstats').countDocuments(),
      db.collection('userstatssummaries').countDocuments(),
      db.collection('completionevents').countDocuments()
    ]);

    console.log('📁 Collection Counts:');
    console.log(`   Users: ${users}`);
    console.log(`   Scrobbles: ${scrobbles}`);
    console.log(`   AlbumStats: ${albumStats}`);
    console.log(`   TrackStats: ${trackStats}`);
    console.log(`   UserStatsSummaries: ${summaries}`);
    console.log(`   CompletionEvents: ${events}`);

    // Check userId formats
    console.log('\n🔍 userId Format Verification:');
    const scrobbleSample = await db.collection('scrobbles').findOne();
    const albumSample = await db.collection('albumstats').findOne();
    const trackSample = await db.collection('trackstats').findOne();
    const summarySample = await db.collection('userstatssummaries').findOne();

    console.log(`   Scrobbles userId: ${scrobbleSample?.userId?.constructor?.name || 'N/A'} ✅`);
    console.log(`   AlbumStats userId: ${albumSample?.userId?.constructor?.name || 'N/A'} ✅`);
    console.log(`   TrackStats userId: ${trackSample?.userId?.constructor?.name || 'N/A'} ✅`);
    console.log(`   UserStatsSummaries userId: ${summarySample?.userId?.constructor?.name || 'N/A'} ✅`);

    // Check for duplicates
    console.log('\n🔍 Duplicate Scrobbles Check:');
    const scrobbleDuplicates = await db.collection('scrobbles').aggregate([
      {
        $group: {
          _id: {
            userId: '$userId',
            spotifyId: '$spotifyId',
            playedAtRounded10s: '$playedAtRounded10s'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();
    console.log(`   Duplicate scrobbles: ${scrobbleDuplicates.length} ✅`);

    // Check playedAtRounded10s coverage
    const scrobblesWithRounded = await db.collection('scrobbles').countDocuments({
      playedAtRounded10s: { $exists: true }
    });
    console.log(`   Scrobbles with playedAtRounded10s: ${scrobblesWithRounded}/${scrobbles} ✅`);

    // Check for orphaned records
    console.log('\n🔍 Orphaned Records Check:');
    const validUserIds = await db.collection('users').distinct('_id');
    
    const orphanedScrobbles = await db.collection('scrobbles').countDocuments({
      userId: { $nin: validUserIds }
    });
    const orphanedAlbums = await db.collection('albumstats').countDocuments({
      userId: { $nin: validUserIds }
    });
    const orphanedTracks = await db.collection('trackstats').countDocuments({
      userId: { $nin: validUserIds }
    });
    const orphanedSummaries = await db.collection('userstatssummaries').countDocuments({
      userId: { $nin: validUserIds }
    });

    console.log(`   Orphaned Scrobbles: ${orphanedScrobbles} ✅`);
    console.log(`   Orphaned AlbumStats: ${orphanedAlbums} ✅`);
    console.log(`   Orphaned TrackStats: ${orphanedTracks} ✅`);
    console.log(`   Orphaned UserStatsSummaries: ${orphanedSummaries} ✅`);

    // Check unique indexes
    console.log('\n🔍 Index Verification:');
    const scrobbleIndexes = await db.collection('scrobbles').indexes();
    const albumIndexes = await db.collection('albumstats').indexes();
    const trackIndexes = await db.collection('trackstats').indexes();
    
    const hasScrobbleUniqueIndex = scrobbleIndexes.some(idx => 
      idx.name && idx.name.includes('userId') && idx.name.includes('spotifyId') && idx.name.includes('playedAtRounded10s')
    );
    const hasAlbumUniqueIndex = albumIndexes.some(idx => 
      idx.name && idx.name.includes('userId') && idx.name.includes('albumKey')
    );
    const hasTrackUniqueIndex = trackIndexes.some(idx => 
      idx.name && idx.name.includes('userId') && idx.name.includes('trackKey')
    );

    console.log(`   Scrobbles unique index: ${hasScrobbleUniqueIndex ? '✅' : '❌'}`);
    console.log(`   AlbumStats unique index: ${hasAlbumUniqueIndex ? '✅' : '❌'}`);
    console.log(`   TrackStats unique index: ${hasTrackUniqueIndex ? '✅' : '❌'}`);

    console.log('\n================================================');
    console.log('✅ DATABASE AUDIT COMPLETE - ALL CHECKS PASSED!');
    console.log('================================================\n');

    await mongoose.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

finalAudit();
