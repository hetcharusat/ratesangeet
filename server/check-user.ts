import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

async function checkUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const userId = '690f3c63bd0a03a91f3cd7fb';
    
    // Check if user exists
    const user = await User.findById(userId).lean();
    
    if (user) {
      console.log('✅ User exists:');
      console.log(`   ID: ${user._id}`);
      console.log(`   Display Name: ${user.displayName}`);
      console.log(`   Spotify ID: ${user.spotifyId}`);
      console.log(`   Email: ${user.email}`);
    } else {
      console.log('❌ User NOT found with ID:', userId);
      
      // Check if any users exist
      const allUsers = await User.find().select('_id displayName spotifyId').limit(5).lean();
      console.log(`\n📋 Available users (${allUsers.length}):`);
      allUsers.forEach(u => {
        console.log(`   - ${u._id} (${u.displayName || 'No name'})`);
      });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
