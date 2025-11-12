import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AlbumStats from './src/models/AlbumStats.js';

dotenv.config();

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    // Check for NITRO album
    const nitro = await AlbumStats.findOne({ albumName: 'NITRO' }).lean();
    console.log('NITRO album status:', nitro ? '❌ Found (BAD)' : '✅ Not found (GOOD - was deleted)');

    // Show all remaining albums
    const allAlbums = await AlbumStats.find().lean();
    console.log(`\n📊 All remaining albums (${allAlbums.length}):\n`);
    allAlbums.forEach(a => {
      const uniqueCount = Array.isArray(a.uniqueTracksPlayed) ? a.uniqueTracksPlayed.length : 0;
      const progress = a.totalTracks ? Math.floor((uniqueCount / a.totalTracks) * 100) : 0;
      console.log(`- ${a.albumName}`);
      console.log(`  totalTracks: ${a.totalTracks || 'MISSING'} | uniqueTracks: ${uniqueCount} | progress: ${progress}%`);
    });

    // Final validation
    const invalid = await AlbumStats.countDocuments({
      $or: [
        { totalTracks: { $exists: false } },
        { totalTracks: null },
        { totalTracks: { $lt: 4 } }
      ]
    });

    console.log(`\n🔍 Final Check: ${invalid} invalid albums (should be 0)`);
    console.log(invalid === 0 ? '✅ ALL GOOD!' : '❌ STILL HAVE ISSUES');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verify();
