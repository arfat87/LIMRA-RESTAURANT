import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, ServerApiVersion } from 'mongodb';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const DEFAULT_URI = 'mongodb+srv://arfatalis451_db_user:QGLrLdwQK0j8h33K@limra.pp0vnqp.mongodb.net/limra_restaurant?retryWrites=true&w=majority&appName=limra';
const dbName = process.env.MONGODB_DB_NAME || 'limra_restaurant';

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
};

export async function getMongoClient() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }

  return await global._mongoClientPromise;
}

export async function getDb(databaseName = dbName) {
  const client = await getMongoClient();
  return client.db(databaseName);
}

export async function getCollection(collectionName, databaseName = dbName) {
  const db = await getDb(databaseName);
  return db.collection(collectionName);
}

export async function pingDatabase() {
  const db = await getDb();
  return await db.command({ ping: 1 });
}
