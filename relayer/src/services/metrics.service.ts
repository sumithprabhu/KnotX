import { RelayMessage, RelayResult } from '../types/message';
import { RelayerMetrics } from '../db';
import { logger } from '../utils/logger';

/**
 * Service for tracking relayer metrics and statistics
 */
class MetricsService {
  /**
   * Record a successful relay
   */
  async recordSuccessfulRelay(message: RelayMessage, _result: RelayResult): Promise<void> {
    try {
      const metrics = await this.getOrCreateMetrics();

      metrics.totalMessagesProcessed += 1;
      metrics.totalMessagesDelivered += 1;

      // Update per-chain counts
      if (!metrics.messagesBySourceChain[message.sourceChain]) {
        metrics.messagesBySourceChain[message.sourceChain] = 0;
      }
      if (!metrics.messagesByDestinationChain[message.destinationChain]) {
        metrics.messagesByDestinationChain[message.destinationChain] = 0;
      }

      metrics.messagesBySourceChain[message.sourceChain] += 1;
      metrics.messagesByDestinationChain[message.destinationChain] += 1;
      metrics.lastUpdated = new Date();

      await metrics.save();

      logger.debug(
        {
          messageId: message.messageId,
          totalProcessed: metrics.totalMessagesProcessed,
          totalDelivered: metrics.totalMessagesDelivered,
        },
        'Metrics updated for successful relay'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to record successful relay metrics');
    }
  }

  /**
   * Record a failed relay
   */
  async recordFailedRelay(message: RelayMessage, _result: RelayResult): Promise<void> {
    try {
      const metrics = await this.getOrCreateMetrics();

      metrics.totalMessagesProcessed += 1;
      metrics.totalMessagesFailed += 1;

      // Update per-chain counts
      if (!metrics.messagesBySourceChain[message.sourceChain]) {
        metrics.messagesBySourceChain[message.sourceChain] = 0;
      }
      if (!metrics.messagesByDestinationChain[message.destinationChain]) {
        metrics.messagesByDestinationChain[message.destinationChain] = 0;
      }

      metrics.messagesBySourceChain[message.sourceChain] += 1;
      metrics.messagesByDestinationChain[message.destinationChain] += 1;
      metrics.lastUpdated = new Date();

      await metrics.save();

      logger.debug(
        {
          messageId: message.messageId,
          totalProcessed: metrics.totalMessagesProcessed,
          totalFailed: metrics.totalMessagesFailed,
        },
        'Metrics updated for failed relay'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to record failed relay metrics');
    }
  }

  /**
   * Get current statistics
   */
  async getStats() {
    return await this.getOrCreateMetrics();
  }

  /**
   * Get or create metrics document
   */
  private async getOrCreateMetrics() {
    let metrics = await RelayerMetrics.findOne();
    if (!metrics) {
      metrics = await RelayerMetrics.create({
        totalMessagesProcessed: 0,
        totalMessagesDelivered: 0,
        totalMessagesFailed: 0,
        messagesBySourceChain: {},
        messagesByDestinationChain: {},
        lastUpdated: new Date(),
      });
    }
    return metrics;
  }
}

export const metricsService = new MetricsService();
