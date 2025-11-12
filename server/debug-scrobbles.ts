import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function debugScrobbles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;
    
    // Get sample scrobble with all fields
    const sample = await db.collection('scrobbles').findOne();
    
    console.log('Sample scrobble fields:');
    console.log(JSON.stringify(sample, null, 2));
    
    // Check if albumRefId exists (renamed from albumId)
    const withAlbumRefId = await db.collection('scrobbles').countDocuments({ albumRefId: { $exists: true } });
    const withAlbumId = await db.collection('scrobbles').countDocuments({ albumId: { $exists: true, $ne: null } });
    
    console.log('\nReference field stats:');
    console.log(`albumRefId exists: ${withAlbumRefId}/167`);
    console.log(`albumId exists: ${withAlbumId}/167`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugScrobbles();
