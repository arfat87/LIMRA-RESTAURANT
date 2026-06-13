import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import 'dotenv/config';
import mongoose from 'mongoose';
import { Category } from '../models/Category.model';

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(uri, { dbName: 'dslrworld' } as any);

  const categories = [
    { name: 'DSLR Cameras', slug: 'dslr-cameras', description: 'Digital Single-Lens Reflex cameras from top brands like Canon, Nikon, and more.' },
    { name: 'Mirrorless Cameras', slug: 'mirrorless-cameras', description: 'Modern, compact, and high-performance mirrorless camera systems.' },
    { name: 'Lenses', slug: 'lenses', description: 'Prime, zoom, macro, and telephoto lenses for all camera mounts.' },
    { name: 'Tripods & Supports', slug: 'tripods-supports', description: 'Sturdy tripods, monopods, and gimbals for stable shots.' },
    { name: 'Accessories', slug: 'accessories', description: 'Camera bags, batteries, memory cards, filters, and cleaning kits.' }
  ];

  console.log(`Seeding categories...`);
  for (const cat of categories) {
    const existing = await Category.findOne({ slug: cat.slug });
    if (!existing) {
      await Category.create(cat);
      console.log(`✅ Created category: ${cat.name}`);
    } else {
      console.log(`ℹ️ Category already exists: ${cat.name}`);
    }
  }

  console.log(`🎉 Seeding complete!`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('❌ Error seeding categories:', err);
  process.exit(1);
});
