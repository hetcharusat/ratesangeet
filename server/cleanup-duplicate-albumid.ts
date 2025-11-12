import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Remove duplicate albumId field from scrobbles
 * 
 * After the fix, scrobbles have BOTH albumId and albumRefId as ObjectIds.
 * We only need albumRefId (the reference to albums collection).
 * This script removes the duplicate albumId ObjectId field.
 */

async function removeOldAlbumIdField() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧹 CLEANUP: Remove duplicate albumId field');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;
    
    // Check current state
    const withBothFields = await db.collection('scrobbles').countDocuments({
      albumId: { $type: 'objectId' },
      albumRefId: { $exists: true }
    });
    
    console.log(`Scrobbles with both albumId + albumRefId: ${withBothFields}\n`);
    
    if (withBothFields === 0) {
      console.log('✅ No cleanup needed!');
      await mongoose.disconnect();
      return;
    }
    
    // Remove albumId ObjectId field (keep albumRefId)
    console.log('Removing duplicate albumId field...\n');
    
    const result = await db.collection('scrobbles').updateMany(
      { albumId: { $type: 'objectId' } },
      { $unset: { albumId: '' } }
    );
    
    console.log(`✅ Removed albumId from ${result.modifiedCount} scrobbles\n`);
    
    // Verify final state
    const afterCleanup = await db.collection('scrobbles').countDocuments({ albumId: { $exists: true } });
    const withAlbumRefId = await db.collection('scrobbles').countDocuments({ albumRefId: { $exists: true } });
    
    console.log('After cleanup:');
    console.log(`  albumId exists:    ${afterCleanup} (should be 0)`);
    console.log(`  albumRefId exists: ${withAlbumRefId} (should be 167)\n`);
    
    // Sample check
    const sample = await db.collection('scrobbles').findOne();
    if (sample) {
      console.log('Sample scrobble fields:');
      console.log(`  trackName:   ${sample.trackName} ✅`);
      console.log(`  albumName:   ${sample.albumName} ✅`);
      console.log(`  artistName:  ${sample.artistName} ✅`);
      console.log(`  trackId:     ${sample.trackId} ✅`);
      console.log(`  albumRefId:  ${sample.albumRefId} ✅`);
      console.log(`  artistId:    ${sample.artistId} ✅`);
      console.log(`  albumId:     ${sample.albumId || 'REMOVED'} ✅\n`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CLEANUP COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeOldAlbumIdField();
