import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker';

async function checkIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    // Check AlbumStats indexes
    console.log('📊 AlbumStats indexes:');
    const albumCollection = db.collection('albumstats');
    const albumIndexes = await albumCollection.indexes();
    albumIndexes.forEach((idx: any) => {
      console.log(`   ${JSON.stringify(idx.key)} - unique: ${idx.unique || false}`);
    });

    // Check TrackStats indexes
    console.log('\n📊 TrackStats indexes:');
    const trackCollection = db.collection('trackstats');
    const trackIndexes = await trackCollection.indexes();
    trackIndexes.forEach((idx: any) => {
      console.log(`   ${JSON.stringify(idx.key)} - unique: ${idx.unique || false}`);
    });

    // Drop old indexes
    console.log('\n🗑️  Dropping old indexes...');
    
    try {
      await albumCollection.dropIndex('userId_1_albumId_1');
      console.log('   ✅ Dropped userId_1_albumId_1 from albumstats');
    } catch (e: any) {
      if (e.code === 27) {
        console.log('   ⚠️  userId_1_albumId_1 does not exist');
      } else {
        console.log(`   ❌ Error dropping userId_1_albumId_1: ${e.message}`);
      }
    }

    try {
      await trackCollection.dropIndex('userId_1_trackId_1');
      console.log('   ✅ Dropped userId_1_trackId_1 from trackstats');
    } catch (e: any) {
      if (e.code === 27) {
        console.log('   ⚠️  userId_1_trackId_1 does not exist');
      } else {
        console.log(`   ❌ Error dropping userId_1_trackId_1: ${e.message}`);
      }
    }

    console.log('\n✅ Done! Now run `npm run backfill` again.');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

checkIndexes();
