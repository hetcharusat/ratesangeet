import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupDuplicatesAndOrphans() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected\n');

    const db = mongoose.connection.db!;
    
    // Get all valid user IDs
    const validUserIds = await db.collection('users').distinct('_id');
    console.log(`📊 Valid users in database: ${validUserIds.length}`);
    const validUserIdStrings = validUserIds.map((id: any) => id.toString());

    // Delete orphaned records (userId not in users collection)
    console.log('\n🧹 Cleaning up orphaned records...\n');

    // AlbumStats orphaned records
    const orphanedAlbumStats = await db.collection('albumstats').deleteMany({
      userId: { $not: { $type: 'objectId' } },
      $expr: { $not: { $in: [{ $toString: '$userId' }, validUserIdStrings] } }
    });
    console.log(`   AlbumStats: Deleted ${orphanedAlbumStats.deletedCount} orphaned records`);

    // TrackStats orphaned records
    const orphanedTrackStats = await db.collection('trackstats').deleteMany({
      userId: { $not: { $type: 'objectId' } },
      $expr: { $not: { $in: [{ $toString: '$userId' }, validUserIdStrings] } }
    });
    console.log(`   TrackStats: Deleted ${orphanedTrackStats.deletedCount} orphaned records`);

    // UserStatsSummaries orphaned records
    const orphanedUserSummaries = await db.collection('userstatssummaries').deleteMany({
      userId: { $not: { $type: 'objectId' } },
      $expr: { $not: { $in: [{ $toString: '$userId' }, validUserIdStrings] } }
    });
    console.log(`   UserStatsSummaries: Deleted ${orphanedUserSummaries.deletedCount} orphaned records`);

    // Now delete remaining String userId documents that have ObjectId duplicates
    console.log('\n🧹 Cleaning up duplicate String userId documents...\n');

    // For each collection, find String userId docs and check if ObjectId version exists
    const albumStatsStringDocs = await db.collection('albumstats').find({
      userId: { $not: { $type: 'objectId' } }
    }).toArray();

    let albumStatsDeleted = 0;
    for (const doc of albumStatsStringDocs) {
      const objectIdVersion = await db.collection('albumstats').findOne({
        userId: new mongoose.Types.ObjectId(doc.userId),
        albumKey: doc.albumKey
      });
      if (objectIdVersion) {
        await db.collection('albumstats').deleteOne({ _id: doc._id });
        albumStatsDeleted++;
      }
    }
    console.log(`   AlbumStats: Deleted ${albumStatsDeleted} duplicate String documents`);

    const trackStatsStringDocs = await db.collection('trackstats').find({
      userId: { $not: { $type: 'objectId' } }
    }).toArray();

    let trackStatsDeleted = 0;
    for (const doc of trackStatsStringDocs) {
      const objectIdVersion = await db.collection('trackstats').findOne({
        userId: new mongoose.Types.ObjectId(doc.userId),
        trackKey: doc.trackKey
      });
      if (objectIdVersion) {
        await db.collection('trackstats').deleteOne({ _id: doc._id });
        trackStatsDeleted++;
      }
    }
    console.log(`   TrackStats: Deleted ${trackStatsDeleted} duplicate String documents`);

    const userSummariesStringDocs = await db.collection('userstatssummaries').find({
      userId: { $not: { $type: 'objectId' } }
    }).toArray();

    let userSummariesDeleted = 0;
    for (const doc of userSummariesStringDocs) {
      const objectIdVersion = await db.collection('userstatssummaries').findOne({
        userId: new mongoose.Types.ObjectId(doc.userId)
      });
      if (objectIdVersion) {
        await db.collection('userstatssummaries').deleteOne({ _id: doc._id });
        userSummariesDeleted++;
      }
    }
    console.log(`   UserStatsSummaries: Deleted ${userSummariesDeleted} duplicate String documents`);

    // Final counts
    console.log('\n📊 Final Statistics:\n');
    const remainingAlbumStats = await db.collection('albumstats').find({
      userId: { $not: { $type: 'objectId' } }
    }).count();
    console.log(`   AlbumStats with String userId: ${remainingAlbumStats}`);

    const remainingTrackStats = await db.collection('trackstats').find({
      userId: { $not: { $type: 'objectId' } }
    }).count();
    console.log(`   TrackStats with String userId: ${remainingTrackStats}`);

    const remainingUserSummaries = await db.collection('userstatssummaries').find({
      userId: { $not: { $type: 'objectId' } }
    }).count();
    console.log(`   UserStatsSummaries with String userId: ${remainingUserSummaries}`);

    console.log('\n✅ Cleanup complete!');
    await mongoose.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupDuplicatesAndOrphans();
