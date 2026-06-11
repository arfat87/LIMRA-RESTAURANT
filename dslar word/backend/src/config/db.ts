import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || '';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: 'dslrworld',
    });
    logger.info('✅ MongoDB connected via Mongoose');
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Graceful disconnect helper
export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('✅ MongoDB disconnected');
};

export default mongoose;
