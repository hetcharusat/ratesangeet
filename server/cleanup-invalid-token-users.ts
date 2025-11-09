import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

// Delete users with 131-char tokens (invalid credential batch)
async function cleanupInvalidTokenUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker');
    console.log('✅ Connected to MongoDB\n');

    // Find users with 131-char refresh tokens
    const allUsers = await User.find().lean();
    const invalidUsers = allUsers.filter(u => u.refreshToken && u.refreshToken.length === 131);
    
    if (invalidUsers.length === 0) {
      console.log('✅ No invalid 131-char tokens found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${invalidUsers.length} users with invalid 131-char tokens:\n`);
    invalidUsers.forEach(u => {
      console.log(`  - ${u.displayName} (@${u.username || 'no-username'}) - ${u.spotifyId}`);
    });

    console.log('\n🗑️  Deleting these users...');
    
    const userIds = invalidUsers.map(u => u._id);
    const result = await User.deleteMany({ _id: { $in: userIds } });
    
    console.log(`✅ Deleted ${result.deletedCount} users with invalid tokens`);
    console.log('\n💡 These users can now re-login and will get fresh, working tokens.');

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupInvalidTokenUsers();
