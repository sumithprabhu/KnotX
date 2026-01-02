import { RelayMessage, RelayResult } from '../types/message';
import { ChainId } from '../types/chains';
import { SepoliaSender } from '../chains/evm/sepolia.sender';
import { SolanaSender } from '../chains/solana/solana.sender';
import { CasperSender } from '../chains/casper/casper.sender';
import { logger } from '../utils/logger';

/**
 * Routes messages to the appropriate chain sender
 */
export class MessageRouter {
  private sepoliaSender: SepoliaSender;
  private solanaSender: SolanaSender;
  private casperSender: CasperSender;

  constructor() {
    this.sepoliaSender = new SepoliaSender();
    this.solanaSender = new SolanaSender();
    this.casperSender = new CasperSender();
  }

  /**
   * Initialize all senders
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.sepoliaSender.initialize(),
        this.solanaSender.initialize(),
        this.casperSender.initialize(),
      ]);
      logger.info('All chain senders initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize chain senders');
      throw error;
    }
  }

  /**
   * Route message to the correct destination chain sender
   */
  async route(message: RelayMessage): Promise<RelayResult> {
    const destinationChain = message.destinationChain as ChainId;

    logger.info(
      {
        messageId: message.messageId,
        sourceChain: message.sourceChain,
        destinationChain,
      },
      'Routing message to destination chain'
    );

    try {
      switch (destinationChain) {
        case ChainId.ETHEREUM_SEPOLIA:
          return await this.sepoliaSender.sendMessageWithRetry(message);

        case ChainId.SOLANA_DEVNET:
          return await this.solanaSender.sendMessageWithRetry(message);

        case ChainId.CASPER_TESTNET:
          return await this.casperSender.sendMessageWithRetry(message);

        default:
          throw new Error(`Unsupported destination chain: ${destinationChain}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { error, messageId: message.messageId, destinationChain },
        'Failed to route message'
      );

      return {
        success: false,
        messageId: message.messageId,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }
}
