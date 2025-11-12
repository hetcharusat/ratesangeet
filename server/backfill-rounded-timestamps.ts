import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function backfillPlayedAtRounded10s() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('🔧 Backfilling playedAtRounded10s field...\n');

    const db = mongoose.connection.db!;
    
    // Find scrobbles without playedAtRounded10s
    const scrobblesWithoutRounded = await db.collection('scrobbles').find({
      playedAtRounded10s: { $exists: false }
    }).toArray();

    console.log(`📊 Found ${scrobblesWithoutRounded.length} scrobbles without playedAtRounded10s`);

    if (scrobblesWithoutRounded.length === 0) {
      console.log('✅ All scrobbles already have playedAtRounded10s field!');
      await mongoose.disconnect();
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const scrobble of scrobblesWithoutRounded) {
      try {
        // Calculate playedAtRounded10s from existing playedAt
        const playedAt = new Date(scrobble.playedAt);
        const playedAtMs = playedAt.getTime();
        
        // For old scrobbles, we assume progressMs was ~50% of duration (estimate)
        const estimatedProgressMs = (scrobble.durationMs || 0) * 0.5;
        const startedAtMs = playedAtMs - estimatedProgressMs;
        const roundedStartMs = Math.floor(startedAtMs / 10000) * 10000;
        const playedAtRounded10s = new Date(roundedStartMs);

        await db.collection('scrobbles').updateOne(
          { _id: scrobble._id },
          { $set: { playedAtRounded10s } }
        );
        updated++;
      } catch (err: any) {
        console.error(`   ❌ Failed to update ${scrobble._id}:`, err.message);
        skipped++;
      }
    }

    console.log(`\n✅ Backfill Complete:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);

    await mongoose.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

backfillPlayedAtRounded10s();
