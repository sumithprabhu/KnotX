import { RelayMessage, RelayResult } from '../types/message';
import { Stats } from '../db';
import { logger } from '../utils/logger';

/**
 * Service for tracking relayer metrics and statistics
 */
class MetricsService {
  /**
   * Record a successful relay
   */
  async recordSuccessfulRelay(message: RelayMessage, result: RelayResult): Promise<void> {
    try {
      const stats = await this.getOrCreateStats();

      stats.totalMessages += 1;
      stats.successfulRelays += 1;

      // Update per-chain counts
      this.updatePerChainCounts(stats, message.sourceChain, 'sent', 'successful');
      this.updatePerChainCounts(stats, message.destinationChain, 'received', 'successful');

      stats.lastUpdated = new Date();
      await stats.save();

      logger.debug(
        {
          messageId: message.messageId,
          totalMessages: stats.totalMessages,
          successfulRelays: stats.successfulRelays,
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
  async recordFailedRelay(message: RelayMessage, result: RelayResult): Promise<void> {
    try {
      const stats = await this.getOrCreateStats();

      stats.totalMessages += 1;
      stats.failedRelays += 1;

      // Update per-chain counts
      this.updatePerChainCounts(stats, message.sourceChain, 'sent', 'failed');
      this.updatePerChainCounts(stats, message.destinationChain, 'received', 'failed');

      stats.lastUpdated = new Date();
      await stats.save();

      logger.debug(
        {
          messageId: message.messageId,
          totalMessages: stats.totalMessages,
          failedRelays: stats.failedRelays,
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
    return await this.getOrCreateStats();
  }

  /**
   * Get or create stats document
   */
  private async getOrCreateStats() {
    let stats = await Stats.findOne();
    if (!stats) {
      stats = await Stats.create({
        totalMessages: 0,
        successfulRelays: 0,
        failedRelays: 0,
        perChainCounts: {},
      });
    }
    return stats;
  }

  /**
   * Update per-chain counts
   */
  private updatePerChainCounts(
    stats: any,
    chainId: string,
    direction: 'sent' | 'received',
    outcome: 'successful' | 'failed'
  ): void {
    if (!stats.perChainCounts) {
      stats.perChainCounts = {};
    }

    if (!stats.perChainCounts[chainId]) {
      stats.perChainCounts[chainId] = {
        sent: 0,
        received: 0,
        successful: 0,
        failed: 0,
      };
    }

    stats.perChainCounts[chainId][direction] += 1;
    if (outcome === 'successful') {
      stats.perChainCounts[chainId].successful += 1;
    } else {
      stats.perChainCounts[chainId].failed += 1;
    }
  }
}

export const metricsService = new MetricsService();
