import { ethers } from 'ethers';
import { ChainId } from '../../types/chains';
import { RelayMessage } from '../../types/message';
import { getChainConfig } from '../../config/chains';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';
import { ChainState } from '../../db/models/ChainState';
import { createHash } from 'crypto';

/**
 * Gateway contract ABI - MessageSent event
 * Based on KnotXGateway.sol:
 * event MessageSent(bytes32 indexed messageId, uint32 dstChainId, bytes receiver, bytes sender, uint64 nonce, bytes payload);
 */
const GATEWAY_ABI = [
  'event MessageSent(bytes32 indexed messageId, uint32 dstChainId, bytes receiver, bytes sender, uint64 nonce, bytes payload)',
  'function sendMessage(uint32 dstChainId, bytes receiver, bytes payload) external payable returns (bytes32 messageId)',
  'function executeMessage(uint32 srcChainId, bytes sender, bytes receiver, uint64 messageNonce, bytes payload, bytes relayerSignature) external',
];

/**
 * Ethereum Sepolia event listener
 */
export class SepoliaListener extends EventEmitter {
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private isListening = false;
  private readonly GATEWAY_ADDRESS: string;

  constructor() {
    super();
    this.GATEWAY_ADDRESS = env.ETHEREUM_SEPOLIA_GATEWAY || '0xD3B1c72361f03d5F138C2c768AfdF700266bb39a';
  }

  /**
   * Initialize connection to Ethereum Sepolia
   * Uses WebSocket provider for real-time event listening
   */
  async initialize(): Promise<void> {
    try {
      const config = getChainConfig(ChainId.ETHEREUM_SEPOLIA);
      
      // Convert HTTP RPC URL to WebSocket URL for real-time listening
      const wsUrl = config.rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      
      // Use WebSocketProvider for real-time event listening
      this.provider = new ethers.WebSocketProvider(wsUrl);
      
      // Handle WebSocket connection events
      this.provider.on('error', (error) => {
        logger.error({ error }, 'WebSocket provider error');
      });
      
      this.provider.on('close', () => {
        logger.warn('WebSocket connection closed, will attempt to reconnect');
      });
      
      this.contract = new ethers.Contract(
        this.GATEWAY_ADDRESS,
        GATEWAY_ABI,
        this.provider
      );
      
      const blockNumber = await this.provider.getBlockNumber();
      logger.info(
        { 
          chain: ChainId.ETHEREUM_SEPOLIA, 
          blockNumber,
          gatewayAddress: this.GATEWAY_ADDRESS,
          connectionType: 'WebSocket',
        },
        'Ethereum Sepolia listener initialized (WebSocket)'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Ethereum Sepolia listener');
      throw error;
    }
  }

  /**
   * Start listening for MessageSent events
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      logger.warn('Ethereum Sepolia listener is already running');
      return;
    }

    if (!this.provider || !this.contract) {
      await this.initialize();
    }

    this.isListening = true;
    logger.info('Starting Ethereum Sepolia event listener');

    try {
      // Get last processed block from database
      if (!this.provider) {
        return;
      }
      
      let chainState = await ChainState.findOne({ chainId: ChainId.ETHEREUM_SEPOLIA });
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = chainState?.lastProcessedBlock 
        ? chainState.lastProcessedBlock + 1 
        : Math.max(0, currentBlock - 1000); // Start from 1000 blocks ago if no state

      // Listen for new events
      // Event signature: MessageSent(bytes32 indexed messageId, uint32 dstChainId, bytes receiver, bytes sender, uint64 nonce, bytes payload)
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }
      
      this.contract.on('MessageSent', async (
        messageId: string,
        dstChainId: bigint,
        receiver: string,
        sender: string,
        nonce: bigint,
        payload: string,
        event: ethers.Log
      ) => {
        await this.handleMessageSent(
          messageId,
          dstChainId,
          receiver,
          sender,
          nonce,
          payload,
          event
        );
      });

      // Also process historical events from last processed block
      if (typeof fromBlock === 'number') {
        await this.processHistoricalEvents(fromBlock);
      }

      logger.info(`Ethereum Sepolia listener started (listening from block ${fromBlock})`);
    } catch (error) {
      logger.error({ error }, 'Error starting Ethereum Sepolia listener');
      this.isListening = false;
      throw error;
    }
  }

  /**
   * Process historical events from a specific block
   */
  private async processHistoricalEvents(fromBlock: number): Promise<void> {
    if (!this.contract) {
      return;
    }

    try {
      const currentBlock = await this.provider!.getBlockNumber();
      const toBlock = Math.min(fromBlock + 1000, currentBlock); // Process in batches of 1000

      logger.info(
        { fromBlock, toBlock, currentBlock },
        'Processing historical Sepolia events'
      );

      const filter = this.contract.filters.MessageSent();
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

      for (const event of events) {
        if ('args' in event && event.args) {
          const args = event.args as any;
          await this.handleMessageSent(
            args[0] as string, // messageId
            args[1] as bigint,  // dstChainId
            args[2] as string,  // receiver
            args[3] as string,  // sender
            args[4] as bigint,  // nonce
            args[5] as string,  // payload
            event
          );
        }
      }

      // Update last processed block
      await ChainState.findOneAndUpdate(
        { chainId: ChainId.ETHEREUM_SEPOLIA },
        { lastProcessedBlock: toBlock },
        { upsert: true }
      );

      // If there are more blocks to process, continue
      if (toBlock < currentBlock) {
        await this.processHistoricalEvents(toBlock + 1);
      }
    } catch (error: any) {
      logger.error({ error: error.message, fromBlock }, 'Error processing historical events');
    }
  }

  /**
   * Handle MessageSent event
   */
  private async handleMessageSent(
    messageId: string,
    dstChainId: bigint,
    receiver: string,
    _sender: string,
    nonce: bigint,
    payload: string,
    event: ethers.Log
  ): Promise<void> {
    try {
      // Convert payload to hex string
      const payloadHex = ethers.hexlify(payload);
      const payloadBytes = ethers.getBytes(payload);
      const payloadHash = createHash('sha256').update(payloadBytes).digest('hex');

      // Map chain IDs
      // Source chain is always Sepolia (since we're listening on Sepolia)
      const dstChainIdNum = Number(dstChainId);
      
      const sourceChain = ChainId.ETHEREUM_SEPOLIA;
      const destinationChain = dstChainIdNum === 3 ? ChainId.CASPER_TESTNET : 
                               dstChainIdNum === 11155111 ? ChainId.ETHEREUM_SEPOLIA : 
                               `chain-${dstChainIdNum}`;

      // Convert receiver to appropriate format
      // For Casper: receiver is 32 bytes (contract hash)
      // For EVM: receiver is 20 bytes (address)
      let destinationGateway = '';
      if (destinationChain === ChainId.CASPER_TESTNET) {
        // Casper receiver is 32 bytes, convert to hash format
        const receiverBytes = ethers.getBytes(receiver);
        if (receiverBytes.length === 32) {
          destinationGateway = `hash-${ethers.hexlify(receiver).replace('0x', '')}`;
        } else {
          // Pad to 32 bytes if needed
          const padded = new Uint8Array(32);
          padded.set(receiverBytes.slice(-32), 0);
          destinationGateway = `hash-${Buffer.from(padded).toString('hex')}`;
        }
      } else if (destinationChain === ChainId.ETHEREUM_SEPOLIA) {
        // EVM receiver is 20 bytes address
        destinationGateway = ethers.getAddress(receiver);
      } else {
        destinationGateway = ethers.hexlify(receiver);
      }

      const message: RelayMessage = {
        messageId: `eth-${messageId}-${Date.now()}`,
        nonce: Number(nonce),
        sourceChain,
        destinationChain,
        sourceGateway: this.GATEWAY_ADDRESS,
        destinationGateway,
        payload: payloadHex.replace('0x', ''),
        payloadHash,
        timestamp: new Date(),
      };

      logger.info(
        { 
          messageId: message.messageId, 
          nonce: message.nonce,
          sourceChain: message.sourceChain,
          destinationChain: message.destinationChain,
          blockNumber: event.blockNumber,
        },
        'Message received from Ethereum Sepolia'
      );

      this.emit('message', message);

      // Update last processed block
      await ChainState.findOneAndUpdate(
        { chainId: ChainId.ETHEREUM_SEPOLIA },
        { lastProcessedBlock: event.blockNumber },
        { upsert: true }
      );
    } catch (error) {
      logger.error({ error, event }, 'Error handling MessageSent event');
    }
  }

  /**
   * Stop listening for events
   */
  async stopListening(): Promise<void> {
    this.isListening = false;
    
    if (this.contract) {
      this.contract.removeAllListeners('MessageSent');
    }
    
    // Close WebSocket connection
    if (this.provider && 'destroy' in this.provider) {
      await (this.provider as any).destroy();
    }
    
    logger.info('Ethereum Sepolia listener stopped (WebSocket closed)');
  }

  /**
   * Check if listener is active
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}
