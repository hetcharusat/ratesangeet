import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

// Mark users with 131-char tokens as needing re-auth
async function fixInvalidTokens() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker');
    console.log('✅ Connected to MongoDB\n');

    // Find users with 131-char refresh tokens (invalid batch)
    const users = await User.find().lean();
    const invalidUsers = users.filter(u => u.refreshToken && u.refreshToken.length === 131);
    const validUsers = users.filter(u => u.refreshToken && u.refreshToken.length === 134);

    console.log(`Found ${invalidUsers.length} users with invalid 131-char tokens`);
    console.log(`Found ${validUsers.length} users with valid 134-char tokens\n`);

    if (invalidUsers.length === 0) {
      console.log('✅ No invalid tokens found!');
      await mongoose.disconnect();
      return;
    }

    console.log('Invalid users:');
    invalidUsers.forEach(u => {
      console.log(`  - ${u.displayName} (${u.spotifyId}) - created ${u.createdAt}`);
    });

    console.log('\n⚠️  These users need to re-login to get valid tokens.');
    console.log('\n💡 Options:');
    console.log('1. Ask users to logout and login again');
    console.log('2. Delete these users from DB (they will re-register on next login)');
    console.log('3. Add a "tokenRevoked" flag to notify them in-app');

    // Optionally: Add a flag to mark them
    // await User.updateMany(
    //   { refreshToken: { $regex: '^.{131}$' } },
    //   { $set: { tokenRevoked: true } }
    // );

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixInvalidTokens();
