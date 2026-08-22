import dotenv from "dotenv";
dotenv.config();

import dns from "dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

import { MongoClient, ServerApiVersion } from "mongodb";

const INSFORGE_URL = process.env.VITE_INSFORGE_URL || process.env.API_BASE_URL || "https://vb9ucr22.us-east.insforge.app";
const API_KEY = process.env.API_KEY || process.env.INSFORGE_ADMIN_KEY || "ik_799af068e8f4fb05944d04497229fe7d";
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "limra_restaurant";

async function fetchFromInsforge(table) {
  try {
    const res = await fetch(INSFORGE_URL + "/api/database/advance/rawsql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({
        query: "SELECT * FROM public." + table + " LIMIT 5000;"
      })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.rows || json.data || (Array.isArray(json) ? json : []);
  } catch (e) {
    return [];
  }
}

async function migrate() {
  console.log("=== Limra Restaurant: InsForge to MongoDB Atlas Migration ===");
  const client = new MongoClient(MONGO_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
  });

  await client.connect();
  const db = client.db(DB_NAME);
  console.log("Connected to MongoDB Atlas database:", DB_NAME);

  const tables = [
    "orders", "order_items", "menu_items", "categories", "table_orders",
    "customer_notifications", "verified_payments", "stock_items", "stock_transactions",
    "suppliers", "printer_settings", "coupons", "combos", "profiles"
  ];

  for (const table of tables) {
    const rows = await fetchFromInsforge(table);
    if (!rows || rows.length === 0) {
      console.log("- " + table + ": No rows or table not found");
      continue;
    }

    console.log("- Migrating " + rows.length + " records from " + table + " to MongoDB...");
    const col = db.collection(table);
    
    // Insert/upsert into MongoDB
    for (const row of rows) {
      const filter = row.id ? { id: row.id } : (row.utr ? { utr: row.utr } : (row.order_number ? { order_number: row.order_number } : { _insforge_id: row.id || JSON.stringify(row) }));
      await col.updateOne(filter, { $set: row }, { upsert: true });
    }
    console.log("  Successfully migrated " + table + " (" + rows.length + " rows)");
  }

  console.log('\n=== Checking final MongoDB Atlas collections ===');
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log('• ' + c.name + ': ' + count + ' documents');
  }

  await client.close();
  console.log('\n✅ Migration complete!');
}

migrate().catch(console.error);
