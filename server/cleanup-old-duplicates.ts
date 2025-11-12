import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupOldDuplicates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('🧹 Cleaning up duplicate scrobbles (old format)...\n');

    const db = mongoose.connection.db!;
    
    // Find scrobbles without playedAtRounded10s (these are duplicates of newer ones)
    const oldFormatScrobbles = await db.collection('scrobbles').find({
      playedAtRounded10s: { $exists: false }
    }).toArray();

    console.log(`📊 Found ${oldFormatScrobbles.length} scrobbles in old format (without playedAtRounded10s)`);

    if (oldFormatScrobbles.length === 0) {
      console.log('✅ No old format scrobbles to clean!');
      await mongoose.disconnect();
      return;
    }

    // Delete them - they are duplicates of existing scrobbles with playedAtRounded10s
    const deleteResult = await db.collection('scrobbles').deleteMany({
      playedAtRounded10s: { $exists: false }
    });

    console.log(`\n✅ Cleanup Complete:`);
    console.log(`   Deleted: ${deleteResult.deletedCount} duplicate scrobbles`);

    // Verify no duplicates remain
    const remaining = await db.collection('scrobbles').countDocuments({
      playedAtRounded10s: { $exists: false }
    });
    console.log(`   Remaining old format: ${remaining}`);

    // Check for any remaining duplicates
    const duplicates = await db.collection('scrobbles').aggregate([
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

    console.log(`\n📊 Final duplicate check: ${duplicates.length} duplicates found`);

    await mongoose.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupOldDuplicates();
