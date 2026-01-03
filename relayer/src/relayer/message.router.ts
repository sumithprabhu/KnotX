import { RelayMessage, RelayResult } from '../types/message';
import { ChainId } from '../types/chains';
import { SepoliaExecutor } from '../chains/evm/sepolia.executor';
import { CasperExecutor } from '../chains/casper/casper.executor';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Routes messages to the appropriate chain executor
 */
export class MessageRouter {
  private sepoliaExecutor: SepoliaExecutor;
  private casperExecutor: CasperExecutor;

  constructor() {
    this.sepoliaExecutor = new SepoliaExecutor();
    this.casperExecutor = new CasperExecutor();
  }

  /**
   * Initialize all executors
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.sepoliaExecutor.initialize(),
        this.casperExecutor.initialize(),
      ]);
      logger.info('All chain executors initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize chain executors');
      throw error;
    }
  }

  /**
   * Route message to the correct destination chain executor
   */
  async route(message: RelayMessage): Promise<RelayResult> {
    const destinationChain = message.destinationChain as ChainId;

    // Set destination gateway based on destination chain
    if (!message.destinationGateway) {
      if (destinationChain === ChainId.ETHEREUM_SEPOLIA) {
        message.destinationGateway = env.ETHEREUM_SEPOLIA_GATEWAY || '0xD3B1c72361f03d5F138C2c768AfdF700266bb39a';
      } else if (destinationChain === ChainId.CASPER_TESTNET) {
        message.destinationGateway = env.CASPER_GATEWAY || 'hash-4ce6b9ec80fde0158f7ab13f37cff883660048c1d457e9e48130cc884ce83073';
      }
    }

    logger.info(
      {
        messageId: message.messageId,
        sourceChain: message.sourceChain,
        destinationChain,
        destinationGateway: message.destinationGateway,
      },
      'Routing message to destination chain executor'
    );

    try {
      switch (destinationChain) {
        case ChainId.ETHEREUM_SEPOLIA:
          return await this.sepoliaExecutor.executeMessage(message);

        case ChainId.CASPER_TESTNET:
          return await this.casperExecutor.executeMessage(message);

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
