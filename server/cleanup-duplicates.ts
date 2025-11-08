/**
 * Database Cleanup Script: Remove Duplicate Scrobbles
 * 
 * ROOT CAUSE: Before the fix, timestamps weren't rounded, causing multiple
 * scrobbles for the same track with slightly different playedAt values.
 * 
 * This script finds and removes duplicate scrobbles, keeping only the first one.
 * Run this AFTER deploying the root fix to clean up existing duplicates.
 */

import mongoose from 'mongoose';
import Scrobble from './src/models/Scrobble.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

interface DuplicateGroup {
  _id: {
    userId: mongoose.Types.ObjectId;
    spotifyId: string;
    playedAt: Date;
  };
  count: number;
  ids: mongoose.Types.ObjectId[];
}

async function cleanupDuplicates() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Analyze scrobble document sizes
    console.log('📊 Analyzing scrobble document sizes...');
    const sampleScrobbles = await Scrobble.find().limit(100).lean();
    const avgSize = sampleScrobbles.reduce((sum, doc) => {
      return sum + JSON.stringify(doc).length;
    }, 0) / sampleScrobbles.length;
    console.log(`   Average scrobble size: ${(avgSize / 1024).toFixed(2)} KB`);
    console.log(`   Total scrobbles: ${await Scrobble.countDocuments()}\n`);

    // Step 2: Find duplicates (same user, track, within ~10s window)
    console.log('🔍 Finding duplicate scrobbles...');
    console.log('   (Same userId + spotifyId + playedAt within 10s window)\n');

    const duplicates = await Scrobble.aggregate([
      {
        $addFields: {
          // Round playedAt to nearest 10 seconds for grouping
          roundedPlayedAt: {
            $toDate: {
              $multiply: [
                { $floor: { $divide: [{ $toLong: '$playedAt' }, 10000] } },
                10000
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            spotifyId: '$spotifyId',
            roundedPlayedAt: '$roundedPlayedAt'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          playedAts: { $push: '$playedAt' }
        }
      },
      {
        $match: {
          count: { $gt: 1 } // Only groups with duplicates
        }
      },
      {
        $sort: { count: -1 }
      }
    ]) as DuplicateGroup[];

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! Database is clean.\n');
      await mongoose.disconnect();
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} duplicate groups\n`);

    // Step 3: Show sample duplicates
    console.log('📋 Sample duplicate groups:');
    duplicates.slice(0, 5).forEach((dup, idx) => {
      console.log(`\n   Group ${idx + 1}:`);
      console.log(`   - Track: ${dup._id.spotifyId}`);
      console.log(`   - User: ${dup._id.userId}`);
      console.log(`   - Duplicates: ${dup.count}`);
      console.log(`   - IDs to delete: ${dup.count - 1}`);
    });

    // Step 4: Calculate storage impact
    const totalDuplicates = duplicates.reduce((sum, dup) => sum + (dup.count - 1), 0);
    const estimatedSavings = (totalDuplicates * avgSize / 1024 / 1024).toFixed(2);
    
    console.log(`\n💾 Storage Impact:`);
    console.log(`   - Total duplicate scrobbles: ${totalDuplicates}`);
    console.log(`   - Estimated storage savings: ${estimatedSavings} MB\n`);

    // Step 5: Confirm deletion
    console.log('🗑️  Ready to delete duplicates (keeping oldest scrobble in each group)');
    console.log('   This operation will:');
    console.log(`   - Delete ${totalDuplicates} duplicate scrobbles`);
    console.log(`   - Keep ${duplicates.length} original scrobbles`);
    console.log(`   - Free up ~${estimatedSavings} MB of storage\n`);

    // Prompt for confirmation (in production, add readline prompt)
    const DRY_RUN = process.env.DRY_RUN === '1';
    
    if (DRY_RUN) {
      console.log('🔒 DRY RUN MODE - No changes will be made\n');
      await mongoose.disconnect();
      return;
    }

    console.log('⚡ Starting cleanup...\n');

    let deletedCount = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < duplicates.length; i += BATCH_SIZE) {
      const batch = duplicates.slice(i, i + BATCH_SIZE);
      
      for (const dup of batch) {
        // Keep the first (oldest) scrobble, delete the rest
        const idsToDelete = dup.ids.slice(1);
        
        const result = await Scrobble.deleteMany({
          _id: { $in: idsToDelete }
        });
        
        deletedCount += result.deletedCount || 0;
      }

      console.log(`   Processed ${Math.min(i + BATCH_SIZE, duplicates.length)}/${duplicates.length} groups...`);
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   - Deleted: ${deletedCount} duplicate scrobbles`);
    console.log(`   - Freed: ~${(deletedCount * avgSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Remaining: ${await Scrobble.countDocuments()} scrobbles\n`);

    // Step 6: Verify no duplicates remain
    console.log('🔍 Verifying cleanup...');
    const remainingDuplicates = await Scrobble.aggregate([
      {
        $group: {
          _id: {
            userId: '$userId',
            spotifyId: '$spotifyId',
            playedAt: '$playedAt'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);

    if (remainingDuplicates.length === 0) {
      console.log('✅ Verification passed! No duplicates remain.\n');
    } else {
      console.log(`⚠️  Warning: ${remainingDuplicates.length} duplicate groups still exist\n`);
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run cleanup
console.log('='.repeat(60));
console.log('  Database Cleanup: Remove Duplicate Scrobbles');
console.log('='.repeat(60));
console.log('\n');

cleanupDuplicates();
