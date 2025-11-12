/**
 * Migration Script: Convert userId from String to ObjectId
 * 
 * CRITICAL: Run this BEFORE deploying code with ObjectId schema changes
 * 
 * This script converts userId fields from String to ObjectId in:
 * - albumstats
 * - trackstats  
 * - userstatssummaries
 * - completionevents
 * 
 * BACKUP YOUR DATABASE FIRST!
 * mongodump --uri="YOUR_MONGODB_URI" --out=/backup/$(date +%Y%m%d)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

interface MigrationStats {
  collection: string;
  totalDocs: number;
  converted: number;
  alreadyObjectId: number;
  errors: number;
  invalidIds: string[];
}

async function migrateCollection(collectionName: string): Promise<MigrationStats> {
  const stats: MigrationStats = {
    collection: collectionName,
    totalDocs: 0,
    converted: 0,
    alreadyObjectId: 0,
    errors: 0,
    invalidIds: [],
  };

  console.log(`\n📦 Migrating collection: ${collectionName}`);

  const collection = mongoose.connection.db!.collection(collectionName);
  const docs = await collection.find({}).toArray();
  stats.totalDocs = docs.length;

  console.log(`   Found ${docs.length} documents`);

  for (const doc of docs) {
    try {
      // Check if userId is already ObjectId
      if (doc.userId instanceof mongoose.Types.ObjectId) {
        stats.alreadyObjectId++;
        continue;
      }

      // Validate string is valid ObjectId format
      if (typeof doc.userId !== 'string' || !mongoose.Types.ObjectId.isValid(doc.userId)) {
        console.warn(`   ⚠️  Invalid ObjectId format: ${doc.userId} (doc._id: ${doc._id})`);
        stats.invalidIds.push(doc._id.toString());
        stats.errors++;
        continue;
      }

      // Convert string to ObjectId
      await collection.updateOne(
        { _id: doc._id },
        { $set: { userId: new mongoose.Types.ObjectId(doc.userId) } }
      );
      stats.converted++;

      if (stats.converted % 100 === 0) {
        console.log(`   ✓ Converted ${stats.converted} documents...`);
      }
    } catch (error) {
      console.error(`   ❌ Error converting doc._id: ${doc._id}`, error);
      stats.errors++;
    }
  }

  return stats;
}

async function validateUsersExist(collectionName: string): Promise<{ total: number; orphaned: string[] }> {
  console.log(`\n🔍 Validating userId references in ${collectionName}...`);

  const collection = mongoose.connection.db!.collection(collectionName);
  const usersCollection = mongoose.connection.db!.collection('users');
  
  const docs = await collection.find({}).toArray();
  const orphaned: string[] = [];

  for (const doc of docs) {
    const user = await usersCollection.findOne({ _id: doc.userId });
    if (!user) {
      orphaned.push(doc._id.toString());
      console.warn(`   ⚠️  Orphaned record: ${doc._id} (userId: ${doc.userId})`);
    }
  }

  return { total: docs.length, orphaned };
}

async function main() {
  console.log('🚀 Starting userId String → ObjectId Migration\n');
  console.log('================================================\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully\n');

    // Collections to migrate
    const collections = ['albumstats', 'trackstats', 'userstatssummaries', 'completionevents'];

    const allStats: MigrationStats[] = [];

    // Migrate each collection
    for (const collectionName of collections) {
      const stats = await migrateCollection(collectionName);
      allStats.push(stats);

      console.log(`\n   Summary for ${collectionName}:`);
      console.log(`   - Total documents: ${stats.totalDocs}`);
      console.log(`   - Converted: ${stats.converted}`);
      console.log(`   - Already ObjectId: ${stats.alreadyObjectId}`);
      console.log(`   - Errors: ${stats.errors}`);
      if (stats.invalidIds.length > 0) {
        console.log(`   - Invalid IDs: ${stats.invalidIds.join(', ')}`);
      }
    }

    // Validate referential integrity
    console.log('\n================================================');
    console.log('🔍 Validating Referential Integrity\n');

    for (const collectionName of collections) {
      const validation = await validateUsersExist(collectionName);
      if (validation.orphaned.length > 0) {
        console.warn(`\n⚠️  ${collectionName} has ${validation.orphaned.length} orphaned records`);
        console.warn(`   Document IDs: ${validation.orphaned.slice(0, 5).join(', ')}${validation.orphaned.length > 5 ? '...' : ''}`);
      } else {
        console.log(`✅ ${collectionName}: All ${validation.total} records have valid userId references`);
      }
    }

    // Final Summary
    console.log('\n================================================');
    console.log('📊 Migration Complete!\n');

    const totalConverted = allStats.reduce((sum, s) => sum + s.converted, 0);
    const totalAlready = allStats.reduce((sum, s) => sum + s.alreadyObjectId, 0);
    const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0);

    console.log(`Total documents converted: ${totalConverted}`);
    console.log(`Total already ObjectId: ${totalAlready}`);
    console.log(`Total errors: ${totalErrors}`);

    if (totalErrors > 0) {
      console.warn('\n⚠️  Migration completed WITH ERRORS. Review logs above.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration
main();
