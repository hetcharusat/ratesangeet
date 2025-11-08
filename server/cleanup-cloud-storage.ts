import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Scrobble from './src/models/Scrobble.js';
import AlbumStats from './src/models/AlbumStats.js';
import TrackStats from './src/models/TrackStats.js';
import UserStatsSummary from './src/models/UserStatsSummary.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker';

async function cleanupCloudStorage() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    // Count before cleanup
    const scrobbleCount = await Scrobble.countDocuments();
    const albumStatsCount = await AlbumStats.countDocuments();
    const trackStatsCount = await TrackStats.countDocuments();
    const userStatsSummaryCount = await UserStatsSummary.countDocuments();

    console.log('📊 Current Cloud Storage:');
    console.log(`   - Scrobbles (raw): ${scrobbleCount} documents`);
    console.log(`   - AlbumStats (summaries): ${albumStatsCount} documents`);
    console.log(`   - TrackStats (summaries): ${trackStatsCount} documents`);
    console.log(`   - UserStatsSummaries (totals): ${userStatsSummaryCount} documents\n`);

    if (scrobbleCount > 0) {
      console.log('🧹 Deleting raw scrobbles from cloud (these belong in local SQLite only)...');
      const result = await Scrobble.deleteMany({});
      console.log(`✅ Deleted ${result.deletedCount} scrobbles from cloud\n`);
    } else {
      console.log('✅ No raw scrobbles in cloud (already clean)\n');
    }

    console.log('📋 Summary Collections (keeping these):');
    console.log(`   - AlbumStats: ${albumStatsCount} (per-user album play counts)`);
    console.log(`   - TrackStats: ${trackStatsCount} (per-user track play counts)`);
    console.log(`   - UserStatsSummaries: ${userStatsSummaryCount} (lifetime totals per user)`);
    console.log('\n✨ Cloud storage is now optimized for minimal usage!');
    console.log('   Raw scrobbles will be stored in local SQLite on each device.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

cleanupCloudStorage();
