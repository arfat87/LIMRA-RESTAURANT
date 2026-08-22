import dotenv from "dotenv";
dotenv.config();

import dns from "dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

import { MongoClient, ServerApiVersion } from "mongodb";
import { menuItems, categoryLabels, categoryEmojis, categoryImages } from "../src/data/menu.js";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "limra_restaurant";

if (!uri) {
  console.error("Error: MONGODB_URI is not defined in .env");
  process.exit(1);
}

async function seed() {
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    const db = client.db(dbName);
    console.log("Connected to database:", dbName);

    // 1. Seed Menu Items
    const menuCol = db.collection("menu_items");
    console.log(`Seeding ${menuItems.length} menu items...`);

    const operations = menuItems.map(item => ({
      updateOne: {
        filter: { id: item.id },
        update: {
          $set: {
            id: item.id,
            name: item.name,
            price: Number(item.price),
            category: item.category,
            emoji: item.emoji || "🍽️",
            image: item.image || "",
            available: true,
            updated_at: new Date()
          }
        },
        upsert: true
      }
    }));

    if (operations.length > 0) {
      const result = await menuCol.bulkWrite(operations);
      console.log(`Menu items seeded! Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);
    }

    // 2. Seed Categories
    const catCol = db.collection("categories");
    const categoryEntries = Object.keys(categoryLabels).map(slug => ({
      slug,
      name: categoryLabels[slug],
      emoji: categoryEmojis[slug] || "🍽️",
      image: categoryImages[slug] || "",
      updated_at: new Date()
    }));

    console.log(`Seeding ${categoryEntries.length} categories...`);
    const catOps = categoryEntries.map(cat => ({
      updateOne: {
        filter: { slug: cat.slug },
        update: { $set: cat },
        upsert: true
      }
    }));

    if (catOps.length > 0) {
      await catCol.bulkWrite(catOps);
      console.log("Categories seeded successfully!");
    }

    // 3. Create helpful indexes
    console.log("Creating indexes...");
    await menuCol.createIndex({ id: 1 }, { unique: true });
    await menuCol.createIndex({ category: 1 });
    await db.collection("orders").createIndex({ order_number: 1 }, { unique: true });
    await db.collection("orders").createIndex({ created_at: -1 });
    await db.collection("orders").createIndex({ status: 1 });
    await db.collection("orders").createIndex({ table_number: 1 });
    await db.collection("verified_payments").createIndex({ utr: 1 }, { unique: true });

    console.log("Indexes created successfully!");

    // 4. Summarize database contents
    const collections = await db.listCollections().toArray();
    console.log('\nCurrent collections in MongoDB Atlas:');
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`- ${c.name}: ${count} documents`);
    }

    console.log('\n✅ MongoDB Atlas seed completed successfully!');
  } catch (error) {
    console.error("Seed error:", error);
  } finally {
    await client.close();
  }
}

seed();
