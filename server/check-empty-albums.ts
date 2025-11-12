import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkEmptyAlbums() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Find albums with empty uniqueTracksPlayed
    const empty = await db.collection('albumstats').find({
      $or: [
        { uniqueTracksPlayed: { $size: 0 } },
        { uniqueTracksPlayed: { $exists: false } }
      ]
    }).limit(10).toArray();

    console.log('📊 Empty Albums Analysis:\n');
    console.log(`Found ${empty.length} albums with empty uniqueTracksPlayed\n`);

    for (let i = 0; i < empty.length; i++) {
      const a = empty[i];
      console.log(`${i + 1}. ${a.albumName}`);
      console.log(`   albumId: ${a.albumId || 'MISSING'}`);
      console.log(`   totalTracks: ${a.totalTracks || 'MISSING'}`);
      console.log(`   playCount: ${a.playCount}`);
      console.log(`   albumArt: ${a.albumArt ? 'Present' : 'MISSING'}`);
      console.log(`   uniqueTracksPlayed: ${JSON.stringify(a.uniqueTracksPlayed)}`);
      
      // Check related scrobbles
      if (a.albumId) {
        const scrobbles = await db.collection('scrobbles').find({
          albumId: a.albumId,
          isScrobbled: true
        }).limit(3).toArray();
        
        console.log(`   Related scrobbles: ${scrobbles.length}`);
        scrobbles.forEach(s => {
          console.log(`     - ${s.trackName} (${s.spotifyId})`);
        });
      }
      console.log('');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEmptyAlbums();
