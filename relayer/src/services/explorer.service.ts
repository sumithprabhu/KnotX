import { Message, Stats, IMessage } from '../db';
import { MessageStatus } from '../types/message';
import { logger } from '../utils/logger';

/**
 * Service for explorer UI data queries
 */
class ExplorerService {
  /**
   * Get messages with pagination and filters
   */
  async getMessages(options: {
    page?: number;
    limit?: number;
    sourceChain?: string;
    destinationChain?: string;
    status?: MessageStatus;
  }): Promise<{ messages: IMessage[]; total: number; page: number; limit: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const filter: any = {};
      if (options.sourceChain) {
        filter.sourceChain = options.sourceChain;
      }
      if (options.destinationChain) {
        filter.destinationChain = options.destinationChain;
      }
      if (options.status) {
        filter.status = options.status;
      }

      const [messages, total] = await Promise.all([
        Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Message.countDocuments(filter),
      ]);

      return {
        messages,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error({ error, options }, 'Failed to get messages');
      throw error;
    }
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: string): Promise<IMessage | null> {
    try {
      return await Message.findOne({ messageId });
    } catch (error) {
      logger.error({ error, messageId }, 'Failed to get message by ID');
      throw error;
    }
  }

  /**
   * Get statistics for explorer
   */
  async getExplorerStats() {
    try {
      const stats = await Stats.findOne();
      const messageStats = await Message.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const statusCounts = messageStats.reduce(
        (acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalMessages: stats?.totalMessages || 0,
        successfulRelays: stats?.successfulRelays || 0,
        failedRelays: stats?.failedRelays || 0,
        statusCounts,
        perChainCounts: stats?.perChainCounts || {},
        lastUpdated: stats?.lastUpdated || new Date(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get explorer stats');
      throw error;
    }
  }
}

export const explorerService = new ExplorerService();
