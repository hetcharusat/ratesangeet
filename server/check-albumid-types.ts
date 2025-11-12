import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkAlbumIdFields() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;
    
    // Get sample to see albumId types
    const samples = await db.collection('scrobbles').find().limit(5).toArray();
    
    console.log('Sample scrobbles:\n');
    samples.forEach((s, i) => {
      console.log(`${i + 1}. Track: ${s.trackName}`);
      console.log(`   albumId type: ${typeof s.albumId} | value: ${s.albumId}`);
      console.log(`   albumRefId type: ${typeof s.albumRefId} | value: ${s.albumRefId}`);
      console.log(`   albumName: ${s.albumName}\n`);
    });
    
    // Check if there were any Spotify album IDs before migration
    const withStringAlbumId = await db.collection('scrobbles').countDocuments({ 
      albumId: { $type: 'string' }
    });
    const withObjectIdAlbumId = await db.collection('scrobbles').countDocuments({ 
      albumId: { $type: 'objectId' }
    });
    
    console.log('Field type counts:');
    console.log(`  albumId as string:   ${withStringAlbumId}`);
    console.log(`  albumId as ObjectId: ${withObjectIdAlbumId}`);
    console.log(`  Total: ${withStringAlbumId + withObjectIdAlbumId}/167\n`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAlbumIdFields();
