/**
 * Create missing User documents for users who have scrobbles but no User doc
 * (logged in before User model was properly implemented)
 */
import mongoose from 'mongoose';
import User from './src/models/User.js';
import Scrobble from './src/models/Scrobble.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function backfillUsers() {
  try {
    console.log('\n============================================================');
    console.log('  Backfill Missing User Documents');
    console.log('============================================================\n');

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all unique userIds from scrobbles
    console.log('🔍 Finding users with scrobbles...');
    const userIds = await Scrobble.distinct('userId');
    console.log(`   Found ${userIds.length} unique user IDs in scrobbles\n`);

    let created = 0;
    let existing = 0;
    let skipped = 0;

    for (const userId of userIds) {
      // Check if User document exists
      const userDoc = await User.findById(userId);
      
      if (userDoc) {
        existing++;
        continue;
      }

      // User missing - try to create from scrobble data
      const scrobble = await Scrobble.findOne({ userId }).sort({ createdAt: -1 });
      
      if (!scrobble) {
        console.log(`⚠️  User ${userId} has no scrobbles (shouldn't happen)`);
        skipped++;
        continue;
      }

      // Create minimal User document (bypass validation with insertOne)
      await mongoose.connection.collection('users').insertOne({
        _id: new mongoose.Types.ObjectId(userId),
        spotifyId: `temp_${userId}`, // Placeholder - will be updated on next login
        displayName: 'User', // Will be updated on next login
        email: 'temp@example.com', // Placeholder
        username: `user_${userId.toString().slice(-8)}`, // Temp username
        accessToken: 'temp', // Will be set on next login
        refreshToken: 'temp', // Will be set on next login
        createdAt: new Date(),
        followers: [],
        following: [],
      });

      console.log(`✅ Created placeholder User document for ${userId} (will be updated on next login)`);
      created++;
    }

    console.log('\n📊 Summary:');
    console.log(`   Existing User docs: ${existing}`);
    console.log(`   Created User docs: ${created}`);
    console.log(`   Skipped: ${skipped}`);

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

backfillUsers();
