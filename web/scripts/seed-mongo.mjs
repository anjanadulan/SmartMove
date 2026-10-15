import { MongoClient } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'smartmove';

async function seed() {
  console.log(`Connecting to MongoDB at ${uri}...`);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log(`Connected! Seeding database: "${dbName}"...`);
    const db = client.db(dbName);

    // Read sample content
    const samplePath = path.resolve(__dirname, '../../database/mongodb/sample-content.json');
    const rawData = fs.readFileSync(samplePath, 'utf8');
    const data = JSON.parse(rawData);

    for (const [collectionName, documents] of Object.entries(data)) {
      const col = db.collection(collectionName);
      // Clean existing demo data
      await col.deleteMany({});
      
      // Transform dates if needed
      const docsToInsert = documents.map(doc => {
        const docCopy = { ...doc };
        if (docCopy.validUntil) docCopy.validUntil = new Date(docCopy.validUntil);
        if (docCopy.createdAt) docCopy.createdAt = new Date(docCopy.createdAt);
        else docCopy.createdAt = new Date();
        return docCopy;
      });

      if (docsToInsert.length > 0) {
        await col.insertMany(docsToInsert);
        console.log(`  ✓ Inserted ${docsToInsert.length} documents into "${collectionName}"`);
      }
    }

    console.log('\n MongoDB seeding completed successfully!');
    console.log('You can now open MongoDB Compass and inspect the "smartmove" database.\n');
  } catch (error) {
    console.error(' MongoDB seeding failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
