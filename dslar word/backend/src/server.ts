import 'dotenv/config';
import app from './app';
import { connectDB, disconnectDB } from './config/db';
import { logger } from './utils/logger';

const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  // Connect to MongoDB Atlas
  await connectDB();

  const server = app.listen(PORT, () => {
    logger.info('═══════════════════════════════════════════════');
    logger.info('  📷 DSLR WORLD — Backend API Started!');
    logger.info(`  🚀 Server: http://localhost:${PORT}`);
    logger.info(`  📍 Health: http://localhost:${PORT}/health`);
    logger.info(`  🌍 Env: ${process.env.NODE_ENV || 'development'}`);
    logger.info('  📦 Store: DSLR WORLD, Ranchi, Jharkhand');
    logger.info('  🍃 DB: MongoDB Atlas');
    logger.info('═══════════════════════════════════════════════');
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('✅ HTTP server closed');
      await disconnectDB();
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('❌ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason: Error) => {
    logger.error('❌ Unhandled Promise Rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
};

startServer().catch((error) => {
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});
