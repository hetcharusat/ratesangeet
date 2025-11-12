import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkDuplicates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('🔍 Analyzing Scrobbles for Duplicates...\n');

    const db = mongoose.connection.db!;
    
    // Total count
    const totalScrobbles = await db.collection('scrobbles').countDocuments();
    console.log('📊 Total Scrobbles:', totalScrobbles);

    // Check for exact duplicates (userId + spotifyId + playedAt)
    const exactDuplicates = await db.collection('scrobbles').aggregate([
      {
        $group: {
          _id: {
            userId: '$userId',
            spotifyId: '$spotifyId',
            playedAt: '$playedAt'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          tracks: { $push: '$trackName' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    console.log('\n❌ Exact Duplicates (userId + spotifyId + playedAt):', exactDuplicates.length);
    if (exactDuplicates.length > 0) {
      console.log('\n📋 Sample Exact Duplicates:');
      exactDuplicates.slice(0, 5).forEach((dup: any) => {
        console.log(`   Track: ${dup.tracks[0]} | SpotifyId: ${dup._id.spotifyId} | Count: ${dup.count}`);
      });
      console.log(`   Total duplicate documents: ${exactDuplicates.reduce((sum: number, d: any) => sum + d.count - 1, 0)}`);
    }

    // Check for playedAtRounded10s duplicates (the field we're using for deduplication)
    const roundedDuplicates = await db.collection('scrobbles').aggregate([
      {
        $match: { playedAtRounded10s: { $exists: true } }
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            spotifyId: '$spotifyId',
            playedAtRounded10s: '$playedAtRounded10s'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          tracks: { $push: '$trackName' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    console.log('\n❌ Rounded10s Duplicates (userId + spotifyId + playedAtRounded10s):', roundedDuplicates.length);
    if (roundedDuplicates.length > 0) {
      console.log('\n📋 Sample Rounded10s Duplicates:');
      roundedDuplicates.slice(0, 5).forEach((dup: any) => {
        console.log(`   Track: ${dup.tracks[0]} | SpotifyId: ${dup._id.spotifyId} | Count: ${dup.count}`);
      });
      console.log(`   Total duplicate documents: ${roundedDuplicates.reduce((sum: number, d: any) => sum + d.count - 1, 0)}`);
    }

    // Check scrobbles without playedAtRounded10s field (old format)
    const scrobblesWithoutRounded = await db.collection('scrobbles').countDocuments({
      playedAtRounded10s: { $exists: false }
    });
    console.log('\n⚠️  Scrobbles without playedAtRounded10s field:', scrobblesWithoutRounded);

    // Check userId format (String vs ObjectId)
    const scrobbleSample = await db.collection('scrobbles').findOne();
    if (scrobbleSample) {
      console.log('\n📋 Scrobble userId format:', scrobbleSample.userId?.constructor?.name || typeof scrobbleSample.userId);
    }

    await mongoose.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDuplicates();
