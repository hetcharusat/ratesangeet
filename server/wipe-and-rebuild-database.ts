/**
 * V2 Database Wipe & Rebuild Script
 * 
 * This script:
 * 1. Drops ALL collections (clean slate)
 * 2. Recreates collections with V2 schemas
 * 3. Creates all indexes
 * 4. Seeds minimal test data (optional)
 * 
 * ⚠️ WARNING: This will DELETE ALL DATA!
 * 
 * Usage:
 *   npx ts-node wipe-and-rebuild-database.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Scrobble from './src/models/Scrobble';
import TrackStats from './src/models/TrackStats';
import AlbumStats from './src/models/AlbumStats';
import UserStatsSummary from './src/models/UserStatsSummary';
import User from './src/models/User';
import Review from './src/models/Review';
import ReviewComment from './src/models/ReviewComment';
import CompletionEvent from './src/models/CompletionEvent';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ratesangeet';

async function wipeAndRebuild() {
  console.log('\n🚨 V2 Database Wipe & Rebuild\n');
  console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//*****@')); // Hide credentials

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;

    // ========== STEP 1: Drop ALL Collections ==========
    console.log('🗑️  STEP 1: Dropping all collections...');
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      const name = collection.name;
      console.log(`  - Dropping: ${name}`);
      await db.dropCollection(name);
    }
    console.log('✅ All collections dropped\n');

    // ========== STEP 2: Recreate Collections with V2 Schemas ==========
    console.log('📦 STEP 2: Creating V2 collections...');

    // Force recreation of models (triggers schema validation)
    const models = [
      { name: 'users', model: User },
      { name: 'scrobbles', model: Scrobble },
      { name: 'trackstats', model: TrackStats },
      { name: 'albumstats', model: AlbumStats },
      { name: 'userstatssummaries', model: UserStatsSummary },
      { name: 'reviews', model: Review },
      { name: 'reviewcomments', model: ReviewComment },
      { name: 'completionevents', model: CompletionEvent },
    ];

    for (const { name, model } of models) {
      await db.createCollection(name);
      console.log(`  ✅ Created: ${name}`);
    }

    console.log('\n📊 STEP 3: Creating indexes...');

    // Users
    await User.createIndexes();
    console.log('  ✅ users indexes');

    // Scrobbles (V2: with TTL, playedAtRounded10s)
    await Scrobble.createIndexes();
    console.log('  ✅ scrobbles indexes (TTL 90d on playedAt)');

    // TrackStats (V2: with replayGuardAt)
    await TrackStats.createIndexes();
    console.log('  ✅ trackstats indexes');

    // AlbumStats (V2: with uniqueTracksPlayed, albumPlayCount)
    await AlbumStats.createIndexes();
    console.log('  ✅ albumstats indexes');

    // UserStatsSummary
    await UserStatsSummary.createIndexes();
    console.log('  ✅ userstatssummaries indexes');

    // Reviews & Comments
    await Review.createIndexes();
    await ReviewComment.createIndexes();
    console.log('  ✅ reviews & reviewcomments indexes');

    // CompletionEvents
    await CompletionEvent.createIndexes();
    console.log('  ✅ completionevents indexes');

    console.log('\n✅ All indexes created');

    // ========== STEP 4: Verify Schema ==========
    console.log('\n🔍 STEP 4: Verifying V2 schema...');

    const scrobbleIndexes = await Scrobble.collection.getIndexes();
    console.log('  Scrobble indexes:', Object.keys(scrobbleIndexes));
    
    const albumStatsIndexes = await AlbumStats.collection.getIndexes();
    console.log('  AlbumStats indexes:', Object.keys(albumStatsIndexes));

    const trackStatsIndexes = await TrackStats.collection.getIndexes();
    console.log('  TrackStats indexes:', Object.keys(trackStatsIndexes));

    // ========== STEP 5: Verify Collections ==========
    console.log('\n📋 STEP 5: Final collection list:');
    const finalCollections = await db.listCollections().toArray();
    finalCollections.forEach(c => {
      console.log(`  - ${c.name}`);
    });

    console.log('\n✅ Database rebuild complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Test V2 scrobbling: Play songs on Spotify');
    console.log('  2. Verify no schema conflicts');
    console.log('  3. Run: .\\test-e2e-quick.ps1');
    console.log('  4. Check album completion logic (4-track min, 70%)');

    console.log('\n🎯 Database is clean and ready for V2 testing!\n');

  } catch (error) {
    console.error('❌ Error during rebuild:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB\n');
  }
}

// Run immediately
wipeAndRebuild()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
