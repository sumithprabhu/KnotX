import { RelayMessage, RelayResult, MessageStatus } from '../types/message';
import { MessageRouter } from './message.router';
import { RelayValidator } from './relay.validator';
import { Message } from '../db';
import { logger } from '../utils/logger';
import { metricsService } from '../services/metrics.service';

/**
 * Executes relay operations end-to-end
 */
export class RelayExecutor {
  private router: MessageRouter;

  constructor() {
    this.router = new MessageRouter();
  }

  /**
   * Initialize executor
   */
  async initialize(): Promise<void> {
    await this.router.initialize();
    logger.info('Relay executor initialized');
  }

  /**
   * Execute relay: validate, store, route, and update status
   */
  async execute(message: RelayMessage): Promise<RelayResult> {
    const startTime = Date.now();

    try {
      // Validate message
      const validation = RelayValidator.validate(message);
      if (!validation.valid) {
        logger.warn(
          { messageId: message.messageId, error: validation.error },
          'Message validation failed'
        );
        return {
          success: false,
          messageId: message.messageId,
          error: validation.error,
          timestamp: new Date(),
        };
      }

      // Check if message already exists
      const existingMessage = await Message.findOne({ messageId: message.messageId });
      if (existingMessage) {
        logger.warn(
          { messageId: message.messageId },
          'Message already exists, skipping relay'
        );
        return {
          success: existingMessage.status === MessageStatus.DELIVERED,
          messageId: message.messageId,
          transactionHash: existingMessage.transactionHash,
          error: existingMessage.error,
          timestamp: existingMessage.updatedAt,
        };
      }

      // Store message as PENDING
      const dbMessage = await Message.create({
        messageId: message.messageId,
        nonce: message.nonce,
        sourceChain: message.sourceChain,
        destinationChain: message.destinationChain,
        sourceGateway: message.sourceGateway,
        destinationGateway: message.destinationGateway,
        payload: message.payload,
        payloadHash: message.payloadHash,
        status: MessageStatus.PENDING,
      });

      logger.info(
        { messageId: message.messageId },
        'Message stored in database, starting relay'
      );

      // Route and send message
      const result = await this.router.route(message);

      // Update message status
      if (result.success) {
        dbMessage.status = MessageStatus.DELIVERED;
        dbMessage.transactionHash = result.transactionHash;
        dbMessage.deliveredAt = new Date();
        await metricsService.recordSuccessfulRelay(message, result);
      } else {
        dbMessage.status = MessageStatus.FAILED;
        dbMessage.error = result.error;
        await metricsService.recordFailedRelay(message, result);
      }

      await dbMessage.save();

      const duration = Date.now() - startTime;
      logger.info(
        {
          messageId: message.messageId,
          success: result.success,
          duration,
        },
        'Relay execution completed'
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { error, messageId: message.messageId },
        'Relay execution failed'
      );

      // Update message status to FAILED if it was created
      try {
        await Message.updateOne(
          { messageId: message.messageId },
          {
            status: MessageStatus.FAILED,
            error: errorMessage,
          }
        );
      } catch (dbError) {
        logger.error({ error: dbError }, 'Failed to update message status');
      }

      await metricsService.recordFailedRelay(message, {
        success: false,
        messageId: message.messageId,
        error: errorMessage,
        timestamp: new Date(),
      });

      return {
        success: false,
        messageId: message.messageId,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }
}
