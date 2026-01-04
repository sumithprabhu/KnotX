import { connectMongo, disconnectMongo } from '../config/mongo';
import { checkEventProcessingStatus } from '../utils/event-checker';
import { logger } from '../utils/logger';

/**
 * Script to check if all events are processed and verify message tracking
 */
async function main() {
  try {
    await connectMongo();
    logger.info('Connected to MongoDB');
    
    await checkEventProcessingStatus();
    
    logger.info('✅ Event check completed');
  } catch (error) {
    logger.error({ error }, 'Error checking events');
    process.exit(1);
  } finally {
    await disconnectMongo();
  }
}

main();
