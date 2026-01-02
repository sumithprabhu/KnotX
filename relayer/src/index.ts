import { App } from './app';
import { logger } from './utils/logger';
import { env } from './config/env';
import { disconnectMongo } from './config/mongo';

/**
 * Application entry point
 */
async function main(): Promise<void> {
  const app = new App();

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');
    try {
      await app.stop();
      await disconnectMongo();
      logger.info('Application shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
    shutdown('unhandledRejection');
  });

  try {
    // Initialize and start the application
    await app.initialize();
    await app.start();

    logger.info(
      { port: env.PORT, nodeEnv: env.NODE_ENV },
      '🚀 Relayer server is running'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to start relayer server');
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error({ error }, 'Fatal error in main');
  process.exit(1);
});
