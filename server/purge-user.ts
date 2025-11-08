/**
 * Purge a user completely (User, Scrobbles, Reviews, Stats) so they can login fresh.
 * ROOT ACTION: Ensures no orphaned scrobbles or stale placeholder users remain.
 * Usage:
 *   DRY_RUN=1 npx tsx purge-user.ts <userId>
 *   npx tsx purge-user.ts <userId>
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Scrobble from './src/models/Scrobble.js';
import Review from './src/models/Review.js';
import TrackStats from './src/models/TrackStats.js';
import AlbumStats from './src/models/AlbumStats.js';
import UserStatsSummary from './src/models/UserStatsSummary.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';
const userId = process.argv[2];
const DRY_RUN = process.env.DRY_RUN === '1';

async function purge() {
  if (!userId) {
    console.error('❌ Provide a userId: npx tsx purge-user.ts <userId>');
    process.exit(1);
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    console.error('❌ Invalid ObjectId format');
    process.exit(1);
  }
  console.log('\n============================================================');
  console.log('  USER PURGE');
  console.log('============================================================');
  console.log('Target userId:', userId);
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no deletions)' : 'LIVE');

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const user = await User.findById(userId);
  if (!user) {
    console.log('ℹ️  User document does not exist (placeholder or missing scenario)');
  } else {
    console.log('User document exists:', { spotifyId: user.spotifyId, username: user.username, displayName: user.displayName });
  }

  const scrobbleCount = await Scrobble.countDocuments({ userId });
  const reviewCount = await Review.countDocuments({ userId });
  const trackStatsCount = await TrackStats.countDocuments({ userId });
  const albumStatsCount = await AlbumStats.countDocuments({ userId });
  const summaryExists = await UserStatsSummary.findOne({ userId });

  console.log('\n📊 Data to remove:');
  console.log(`  Scrobbles:      ${scrobbleCount}`);
  console.log(`  Reviews:        ${reviewCount}`);
  console.log(`  TrackStats:     ${trackStatsCount}`);
  console.log(`  AlbumStats:     ${albumStatsCount}`);
  console.log(`  UserStatsSummary: ${summaryExists ? '1' : '0'}`);

  if (DRY_RUN) {
    console.log('\n🔒 DRY RUN: No deletions performed.');
  } else {
    const ops: Promise<any>[] = [];
    ops.push(Scrobble.deleteMany({ userId }));
    ops.push(Review.deleteMany({ userId }));
    ops.push(TrackStats.deleteMany({ userId }));
    ops.push(AlbumStats.deleteMany({ userId }));
    ops.push(UserStatsSummary.deleteMany({ userId }));
    ops.push(User.deleteOne({ _id: userId }));
    await Promise.all(ops);
    console.log('\n🗑️  Deleted all associated documents.');
  }

  if (!DRY_RUN) {
    // Verification: ensure nothing left
    const remainingScrobbles = await Scrobble.countDocuments({ userId });
    const remainingUser = await User.findById(userId);
    console.log('\n✅ Verification after purge:');
    console.log('  Remaining scrobbles:', remainingScrobbles);
    console.log('  User exists:', !!remainingUser);
  }

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected');
  console.log('\n✅ Purge complete');
}

purge().catch(e => { console.error('❌ Fatal error:', e); process.exit(1); });
