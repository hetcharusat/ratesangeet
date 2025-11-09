import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const failingUserIds = [
  '31avdt2qtmnemk5hpdhcqahlr5ky',
  '31hgmnxc7sma3x2alcvljvspvsqm',
  '31v6x47t54capyuaa2tot3h6fmiu',
  'kqeoi0pilm5rhe32aprfyjzys',
  'temp_68f76ebaaeea6e3e5f62416d',
];

const workingUserIds = [
  'qbgsut4sn1n311rl8d7h4nyt8',
  '31dq54biedeulnptq5byr3xqko64',
];

async function diagnoseRefreshTokens() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker');
    console.log('✅ Connected to MongoDB\n');

    console.log('=== FAILING USERS ===');
    for (const spotifyId of failingUserIds) {
      const user = await User.findOne({ spotifyId }).lean();
      if (user) {
        console.log(`\n${spotifyId}:`);
        console.log(`  - Created: ${user.createdAt}`);
        console.log(`  - Refresh token length: ${user.refreshToken?.length || 0} chars`);
        console.log(`  - Refresh token starts: ${user.refreshToken?.substring(0, 20)}...`);
        console.log(`  - Access token starts: ${user.accessToken?.substring(0, 20)}...`);
      } else {
        console.log(`\n${spotifyId}: NOT FOUND IN DB`);
      }
    }

    console.log('\n\n=== WORKING USERS ===');
    for (const spotifyId of workingUserIds) {
      const user = await User.findOne({ spotifyId }).lean();
      if (user) {
        console.log(`\n${spotifyId}:`);
        console.log(`  - Created: ${user.createdAt}`);
        console.log(`  - Refresh token length: ${user.refreshToken?.length || 0} chars`);
        console.log(`  - Refresh token starts: ${user.refreshToken?.substring(0, 20)}...`);
        console.log(`  - Access token starts: ${user.accessToken?.substring(0, 20)}...`);
      } else {
        console.log(`\n${spotifyId}: NOT FOUND IN DB`);
      }
    }

    console.log('\n\n=== ANALYSIS ===');
    console.log('Checking for patterns...\n');

    const allUsers = await User.find({
      spotifyId: { $in: [...failingUserIds, ...workingUserIds] }
    }).lean();

    const failing = allUsers.filter(u => failingUserIds.includes(u.spotifyId));
    const working = allUsers.filter(u => workingUserIds.includes(u.spotifyId));

    if (failing.length > 0 && working.length > 0) {
      const failingAvgLength = failing.reduce((sum, u) => sum + (u.refreshToken?.length || 0), 0) / failing.length;
      const workingAvgLength = working.reduce((sum, u) => sum + (u.refreshToken?.length || 0), 0) / working.length;

      console.log(`Failing users avg refresh token length: ${Math.round(failingAvgLength)} chars`);
      console.log(`Working users avg refresh token length: ${Math.round(workingAvgLength)} chars`);

      const failingOldest = new Date(Math.min(...failing.map(u => u.createdAt.getTime())));
      const workingOldest = new Date(Math.min(...working.map(u => u.createdAt.getTime())));

      console.log(`\nFailing users oldest account: ${failingOldest.toISOString()}`);
      console.log(`Working users oldest account: ${workingOldest.toISOString()}`);

      const daysSinceFailingCreated = (Date.now() - failingOldest.getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceWorkingCreated = (Date.now() - workingOldest.getTime()) / (1000 * 60 * 60 * 24);

      console.log(`\nFailing users account age: ${Math.round(daysSinceFailingCreated)} days`);
      console.log(`Working users account age: ${Math.round(daysSinceWorkingCreated)} days`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseRefreshTokens();
