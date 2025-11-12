import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function analyzeDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('=== DATABASE COLLECTIONS ===');
    console.log(`Total collections: ${collections.length}\n`);

    for (const col of collections) {
      const collectionName = col.name;
      console.log(`\n📦 COLLECTION: ${collectionName}`);
      console.log('─'.repeat(60));

      // Get collection stats
      const count = await db.collection(collectionName).countDocuments();
      console.log(`Documents: ${count}`);

      // Get sample document to show schema
      const sample = await db.collection(collectionName).findOne({});
      if (sample) {
        console.log('\n📄 Sample Document Schema:');
        console.log(JSON.stringify(sample, null, 2));
      }

      // Get indexes
      const indexes = await db.collection(collectionName).indexes();
      console.log('\n🔍 Indexes:');
      indexes.forEach(idx => {
        console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
      });

      console.log('\n');
    }

    await mongoose.connection.close();
    console.log('\n✅ Analysis complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeDatabase();
