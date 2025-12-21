import { ethers } from 'ethers';
import { ChainId } from '../../types/chains';
import { RelayMessage } from '../../types/message';
import { getChainConfig } from '../../config/chains';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

/**
 * Ethereum Sepolia event listener
 * TODO: Replace with actual contract ABI and event listening logic
 */
export class SepoliaListener extends EventEmitter {
  private provider: ethers.JsonRpcProvider | null = null;
  private isListening = false;

  /**
   * Initialize connection to Ethereum Sepolia
   */
  async initialize(): Promise<void> {
    try {
      const config = getChainConfig(ChainId.ETHEREUM_SEPOLIA);
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
      
      const blockNumber = await this.provider.getBlockNumber();
      logger.info(
        { chain: ChainId.ETHEREUM_SEPOLIA, blockNumber },
        'Ethereum Sepolia listener initialized'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Ethereum Sepolia listener');
      throw error;
    }
  }

  /**
   * Start listening for MessageSent events
   * TODO: Implement actual event listening with contract ABI
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      logger.warn('Ethereum Sepolia listener is already running');
      return;
    }

    if (!this.provider) {
      await this.initialize();
    }

    this.isListening = true;
    logger.info('Starting Ethereum Sepolia event listener');

    // TODO: Replace with actual event listening
    // Example structure:
    // const contract = new ethers.Contract(gatewayAddress, abi, this.provider);
    // contract.on('MessageSent', (sourceChain, destChain, gateway, payload, nonce, event) => {
    //   this.handleMessageSent(event);
    // });

    // Stub: Emit a test message for demonstration
    logger.info('Ethereum Sepolia listener started (stubbed)');
  }

  /**
   * Stop listening for events
   */
  async stopListening(): Promise<void> {
    this.isListening = false;
    logger.info('Ethereum Sepolia listener stopped');
  }

  /**
   * Handle MessageSent event
   * TODO: Parse actual event data from contract
   */
  private handleMessageSent(event: any): void {
    try {
      // TODO: Parse event.args to extract:
      // - sourceChain
      // - destinationChain
      // - destinationGateway
      // - payload
      // - nonce or messageId

      const message: RelayMessage = {
        messageId: `eth-${Date.now()}-${Math.random()}`,
        nonce: 0, // TODO: Extract from event
        sourceChain: ChainId.ETHEREUM_SEPOLIA,
        destinationChain: '', // TODO: Extract from event
        sourceGateway: event.address || '',
        destinationGateway: '', // TODO: Extract from event
        payload: '', // TODO: Extract from event
        payloadHash: '', // TODO: Calculate hash
        timestamp: new Date(),
      };

      this.emit('message', message);
      logger.info({ messageId: message.messageId }, 'Message received from Ethereum Sepolia');
    } catch (error) {
      logger.error({ error, event }, 'Error handling MessageSent event');
    }
  }

  /**
   * Check if listener is active
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}
