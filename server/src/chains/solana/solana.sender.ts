import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { ChainId } from '../../types/chains';
import { RelayMessage, RelayResult } from '../../types/message';
import { getChainConfig } from '../../config/chains';
import { logger } from '../../utils/logger';
import { retry } from '../../utils/retry';

/**
 * Solana Devnet message sender
 * TODO: Replace with actual program instruction building and transaction logic
 */
export class SolanaSender {
  private connection: Connection | null = null;
  private keypair: Keypair | null = null;

  /**
   * Initialize connection and keypair
   */
  async initialize(): Promise<void> {
    try {
      const config = getChainConfig(ChainId.SOLANA_DEVNET);
      this.connection = new Connection(config.rpcUrl, 'confirmed');

      if (config.privateKey) {
        // TODO: Parse private key from config
        // const secretKey = Uint8Array.from(JSON.parse(config.privateKey));
        // this.keypair = Keypair.fromSecretKey(secretKey);
        logger.warn('Solana private key parsing not implemented yet');
      } else {
        logger.warn('No private key configured for Solana Devnet sender');
      }

      logger.info('Solana Devnet sender initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Solana Devnet sender');
      throw error;
    }
  }

  /**
   * Send message to destination gateway program
   * TODO: Implement actual program instruction and transaction
   */
  async sendMessage(message: RelayMessage): Promise<RelayResult> {
    if (!this.connection || !this.keypair) {
      await this.initialize();
    }

    if (!this.keypair) {
      throw new Error('Solana Devnet sender not properly initialized');
    }

    try {
      logger.info(
        { messageId: message.messageId, destinationChain: message.destinationChain },
        'Sending message via Solana Devnet'
      );

      // TODO: Replace with actual program interaction
      // Example structure:
      // const programId = new PublicKey(message.destinationGateway);
      // const instruction = new TransactionInstruction({
      //   keys: [...],
      //   programId,
      //   data: Buffer.from(payload),
      // });
      // const transaction = new Transaction().add(instruction);
      // const signature = await sendAndConfirmTransaction(
      //   this.connection,
      //   transaction,
      //   [this.keypair]
      // );

      // Stub: Simulate successful transaction
      const stubSignature = Array(88)
        .fill(0)
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('');

      const result: RelayResult = {
        success: true,
        messageId: message.messageId,
        transactionHash: stubSignature,
        timestamp: new Date(),
      };

      logger.info(
        { messageId: message.messageId, signature: stubSignature },
        'Message sent successfully via Solana Devnet'
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { error, messageId: message.messageId },
        'Failed to send message via Solana Devnet'
      );

      return {
        success: false,
        messageId: message.messageId,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send message with retry logic
   */
  async sendMessageWithRetry(message: RelayMessage): Promise<RelayResult> {
    return retry(
      () => this.sendMessage(message),
      {
        maxAttempts: 3,
        delayMs: 2000,
        onRetry: (attempt, error) => {
          logger.warn(
            { attempt, messageId: message.messageId, error },
            'Retrying message send'
          );
        },
      }
    );
  }
}
