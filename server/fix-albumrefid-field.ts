import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fix migration field naming: Rename albumId reference to albumRefId
 * 
 * ISSUE: Migration script created field "albumId" for the ObjectId reference,
 * but this conflicts with the existing "albumId" string field (Spotify album ID).
 * 
 * SOLUTION: Rename "albumId" references to "albumRefId" to match Scrobble model.
 */

async function fixFieldNames() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 FIX: Rename albumId reference → albumRefId');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;
    
    // Check current state
    const total = await db.collection('scrobbles').countDocuments();
    const withOldField = await db.collection('scrobbles').countDocuments({ 
      albumId: { $type: 'objectId' } // Check if albumId is ObjectId (reference)
    });
    const withNewField = await db.collection('scrobbles').countDocuments({ albumRefId: { $exists: true } });
    
    console.log('Current state:');
    console.log(`  Total scrobbles:              ${total}`);
    console.log(`  With albumId (ObjectId ref):  ${withOldField}`);
    console.log(`  With albumRefId:              ${withNewField}\n`);
    
    if (withOldField === 0) {
      console.log('✅ No albumId references found - nothing to fix!');
      await mongoose.disconnect();
      return;
    }
    
    // Fix: Rename albumId → albumRefId for ObjectId references
    console.log('Renaming fields...\n');
    
    const result = await db.collection('scrobbles').updateMany(
      { albumId: { $type: 'objectId' } }, // Only update ObjectId refs, not string IDs
      [
        {
          $set: {
            albumRefId: '$albumId', // Copy to albumRefId
            // Keep old albumId field temporarily (it might have string value elsewhere)
          }
        }
      ]
    );
    
    console.log(`✅ Updated ${result.modifiedCount} scrobbles\n`);
    
    // Verify
    const afterFix = await db.collection('scrobbles').countDocuments({ albumRefId: { $exists: true } });
    console.log('After fix:');
    console.log(`  With albumRefId: ${afterFix}/${total}\n`);
    
    // Sample check
    const sample = await db.collection('scrobbles').findOne({ albumRefId: { $exists: true } });
    if (sample) {
      console.log('Sample scrobble:');
      console.log(`  albumRefId: ${sample.albumRefId} (ObjectId) ✅`);
      console.log(`  albumId: ${sample.albumId} (should be string or ObjectId)`);
      console.log(`  trackId: ${sample.trackId} ✅`);
      console.log(`  artistId: ${sample.artistId} ✅\n`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ FIX COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixFieldNames();
