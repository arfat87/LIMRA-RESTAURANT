import dotenv from "dotenv";
dotenv.config();
import { getDb } from "../api/lib/mongodb.js";

const INSFORGE_URL = process.env.VITE_INSFORGE_URL || process.env.API_BASE_URL || "https://vb9ucr22.us-east.insforge.app";
const API_KEY = process.env.API_KEY || process.env.INSFORGE_ADMIN_KEY || "ik_799af068e8f4fb05944d04497229fe7d";

async function queryPostgres(sql) {
  try {
    const res = await fetch(INSFORGE_URL + "/api/database/advance/rawsql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return { error: res.statusText, rows: [] };
    const json = await res.json();
    const rows = json.rows || json.data || (Array.isArray(json) ? json : []);
    return { rows, error: null };
  } catch (e) {
    return { error: e.message, rows: [] };
  }
}

async function moveWholeDatabase() {
  console.log("=================================================================");
  console.log("🚀 MIGRATING 100% OF INSFORGE DATA TO MONGODB ATLAS");
  console.log("=================================================================\n");

  const db = await getDb();

  // 1. Fetch all tables across all schemas
  const tableQuery = `
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name;
  `;

  const { rows: allTables, error: tblErr } = await queryPostgres(tableQuery);
  if (tblErr) {
    console.error("Failed to list tables:", tblErr);
    process.exit(1);
  }

  console.log(`Discovered ${allTables.length} total database tables across all schemas.\n`);

  const summary = [];

  for (let i = 0; i < allTables.length; i++) {
    const t = allTables[i];
    const schema = t.table_schema;
    const table = t.table_name;
    const fullPgName = `"${schema}"."${table}"`;
    const mongoCollectionName = schema === "public" ? table : `${schema}_${table}`;

    process.stdout.write(`[${i + 1}/${allTables.length}] Migrating ${schema}.${table}... `);

    // Fetch all rows
    const { rows, error } = await queryPostgres(`SELECT * FROM ${fullPgName};`);
    const col = db.collection(mongoCollectionName);

    if (error) {
      console.log(`⚠️  Skipped (${error})`);
      summary.push({ schema, table, mongoCol: mongoCollectionName, pgCount: 0, mongoCount: 0, status: "SKIPPED" });
      continue;
    }

    if (rows && rows.length > 0) {
      const ops = rows.map((row) => {
        const filter = row.id
          ? { id: row.id }
          : row.utr
          ? { utr: row.utr }
          : row.order_number
          ? { order_number: row.order_number }
          : row.code
          ? { code: row.code }
          : row.email
          ? { email: row.email }
          : row.key
          ? { key: row.key }
          : row.name
          ? { name: row.name }
          : { _row_fingerprint: JSON.stringify(row) };

        return {
          updateOne: {
            filter: filter,
            update: { $set: { ...row, _migrated_from: fullPgName, _migrated_at: new Date() } },
            upsert: true
          }
        };
      });

      await col.bulkWrite(ops);
      console.log(`✅ ${rows.length} rows migrated`);
    } else {
      try {
        await db.createCollection(mongoCollectionName);
      } catch (e) {}
      console.log("✅ 0 rows (table ready)");
    }

    const currentMongoCount = await col.countDocuments();
    summary.push({
      schema,
      table,
      mongoCol: mongoCollectionName,
      pgCount: rows.length,
      mongoCount: currentMongoCount,
      status: "SYNCED"
    });
  }

  console.log("\n-----------------------------------------------------------------------------------------");
  console.log("| PostgreSQL Table Name         | MongoDB Atlas Collection | PG Rows | Mongo Docs | Status |");
  console.log("-----------------------------------------------------------------------------------------");
  for (const s of summary) {
    const pgName = (s.schema + "." + s.table).padEnd(29);
    const mCol = s.mongoCol.padEnd(24);
    const pgC = String(s.pgCount || 0).padStart(7);
    const mC = String(s.mongoCount || 0).padStart(10);
    console.log(`| ${pgName} | ${mCol} | ${pgC} | ${mC} | ${s.status.padEnd(6)} |`);
  }
  console.log("-----------------------------------------------------------------------------------------");

  const totalPgRows = summary.reduce((acc, it) => acc + (it.pgCount || 0), 0);
  const totalMongoDocs = summary.reduce((acc, it) => acc + (it.mongoCount || 0), 0);

  console.log(`\n🎉 MIGRATION OF WHOLE DATABASE COMPLETE!`);
  console.log(`• Total Tables Processed: ${summary.length}`);
  console.log(`• Total Records Migrated: ${totalPgRows}`);
  console.log(`• Total Documents in MongoDB Atlas: ${totalMongoDocs}\n`);

  process.exit(0);
}

moveWholeDatabase().catch(console.error);
