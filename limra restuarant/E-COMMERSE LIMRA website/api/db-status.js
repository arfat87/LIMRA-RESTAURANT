import { getDb, pingDatabase } from "./lib/mongodb.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const startTime = Date.now();
    const pingRes = await pingDatabase();
    const latencyMs = Date.now() - startTime;

    const db = await getDb();
    const collections = await db.listCollections().toArray();

    const stats = {};
    for (const c of collections) {
      stats[c.name] = await db.collection(c.name).countDocuments();
    }

    return res.status(200).json({
      status: "connected",
      database: db.databaseName,
      latencyMs,
      collections: stats,
      ping: pingRes
    });
  } catch (error) {
    console.error("MongoDB Status Error:", error);
    return res.status(500).json({
      status: "error",
      error: error.message || "Failed to connect to MongoDB Atlas"
    });
  }
}
