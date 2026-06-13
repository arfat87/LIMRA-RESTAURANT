import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User.model';

const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address. Example: npx ts-node src/scripts/promote.ts user@example.com');
  process.exit(1);
}

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(uri, { dbName: 'dslrworld' } as any);
  console.log(`Searching for user with email: ${email}`);
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`❌ User not found with email: ${email}`);
    process.exit(1);
  }
  user.role = 'ADMIN';
  user.isVerified = true;
  await user.save();
  console.log(`✅ Success! User ${email} has been promoted to ADMIN and marked as verified.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('❌ Error promoting user:', err);
  process.exit(1);
});
