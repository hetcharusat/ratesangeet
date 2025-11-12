import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AlbumStats from './src/models/AlbumStats.js';

dotenv.config();

async function cleanupInvalidAlbums() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    // Find albums with missing or invalid totalTracks
    const invalidAlbums = await AlbumStats.find({
      $or: [
        { totalTracks: { $exists: false } },
        { totalTracks: null },
        { totalTracks: { $lt: 4 } }
      ]
    }).lean();

    console.log(`📊 Found ${invalidAlbums.length} invalid albums (missing totalTracks or <4 tracks)\n`);

    if (invalidAlbums.length === 0) {
      console.log('✅ No invalid albums found!');
      await mongoose.disconnect();
      return;
    }

    // Show sample
    console.log('Sample invalid albums:');
    invalidAlbums.slice(0, 5).forEach((a, i) => {
      console.log(`${i + 1}. ${a.albumName} (totalTracks: ${a.totalTracks || 'MISSING'})`);
    });

    console.log('\n⚠️  These albums violate V2 contract: "Only albums with ≥4 tracks are tracked"');
    console.log('Deleting invalid albums...\n');

    // Delete invalid albums
    const result = await AlbumStats.deleteMany({
      $or: [
        { totalTracks: { $exists: false } },
        { totalTracks: null },
        { totalTracks: { $lt: 4 } }
      ]
    });

    console.log(`✅ Deleted ${result.deletedCount} invalid albums`);

    // Verify
    const remaining = await AlbumStats.countDocuments({
      $or: [
        { totalTracks: { $exists: false } },
        { totalTracks: null },
        { totalTracks: { $lt: 4 } }
      ]
    });

    console.log(`\n🔍 Verification: ${remaining} invalid albums remaining (should be 0)`);

    // Show stats
    const validAlbums = await AlbumStats.countDocuments({ totalTracks: { $gte: 4 } });
    console.log(`✅ Valid albums (≥4 tracks): ${validAlbums}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupInvalidAlbums();
