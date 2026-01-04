import {
  RpcClient,
  HttpHandler,
} from 'casper-js-sdk';
import { ChainId } from '../../types/chains';
import { RelayMessage } from '../../types/message';
import { getChainConfig } from '../../config/chains';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';
import { ChainState } from '../../db/models/ChainState';
import { createHash } from 'crypto';

/**
 * Casper Testnet listener - polls for new messages by nonce
 */
export class CasperListener extends EventEmitter {
  private rpcClient: RpcClient | null = null;
  private isListening = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 10000; // Poll every 10 seconds
  private readonly CONTRACT_HASH: string;
  private readonly KEY_NONCE = 'nonce';
  private readonly KEY_MESSAGES = 'messages';

  constructor() {
    super();
    this.CONTRACT_HASH = env.CASPER_GATEWAY || 'hash-4ce6b9ec80fde0158f7ab13f37cff883660048c1d457e9e48130cc884ce83073';
  }

  /**
   * Create RPC client with Authorization header
   */
  private createRpcClient(): RpcClient {
    const config = getChainConfig(ChainId.CASPER_TESTNET);
    const httpHandler = new HttpHandler(config.rpcUrl);
    
    if (env.CASPER_API_KEY) {
      httpHandler.setCustomHeaders({
        Authorization: env.CASPER_API_KEY,
        'Content-Type': 'application/json',
      });
    }

    return new RpcClient(httpHandler);
  }

  /**
   * Initialize connection to Casper Testnet
   */
  async initialize(): Promise<void> {
    try {
      this.rpcClient = this.createRpcClient();
      logger.info(
        { chain: ChainId.CASPER_TESTNET, contractHash: this.CONTRACT_HASH },
        'Casper Testnet listener initialized'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Casper Testnet listener');
      throw error;
    }
  }

  /**
   * Get current nonce from contract
   */
  private async getCurrentNonce(): Promise<number> {
    if (!this.rpcClient) {
      throw new Error('RPC client not initialized');
    }

    try {
      const queryResult = await this.rpcClient.queryLatestGlobalState(this.CONTRACT_HASH, [this.KEY_NONCE]);
      
      if (queryResult.storedValue?.clValue) {
        const clValue = queryResult.storedValue.clValue;
        if (clValue.ui64 !== undefined) {
          return Number(clValue.ui64);
        }
        const bytes = clValue.bytes();
        if (bytes && bytes.length >= 8) {
          return Number(Buffer.from(bytes).readBigUInt64BE(0));
        }
      }
      
      throw new Error('Nonce not found in contract state');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get current nonce');
      throw error;
    }
  }

  /**
   * Get messages dictionary URef from contract
   */
  private async getMessagesDictionaryURef(): Promise<string> {
    if (!this.rpcClient) {
      throw new Error('RPC client not initialized');
    }

    try {
      const queryResult = await this.rpcClient.queryLatestGlobalState(this.CONTRACT_HASH, []);
      
      if (queryResult.rawJSON) {
        const raw = typeof queryResult.rawJSON === 'string' 
          ? JSON.parse(queryResult.rawJSON) 
          : queryResult.rawJSON;
        
        const storedValue = raw?.stored_value;
        if (storedValue?.Contract) {
          const namedKeys = storedValue.Contract.named_keys;
          let namedKeysMap: Record<string, string> = {};
          
          if (Array.isArray(namedKeys)) {
            for (const item of namedKeys) {
              if (item.name && item.key) {
                namedKeysMap[item.name] = item.key;
              }
            }
          } else if (typeof namedKeys === 'object' && namedKeys !== null) {
            namedKeysMap = namedKeys;
          }
          
          if (namedKeysMap[this.KEY_MESSAGES]) {
            return namedKeysMap[this.KEY_MESSAGES];
          }
        }
      }
      
      throw new Error('Messages dictionary URef not found');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get messages dictionary URef');
      throw error;
    }
  }

  /**
   * Get state root hash from latest block
   */
  private async getStateRootHash(): Promise<string> {
    const config = getChainConfig(ChainId.CASPER_TESTNET);
    const rpcUrl = config.rpcUrl;
    const uniqueId = Date.now();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    };
    
    if (env.CASPER_API_KEY) {
      headers['Authorization'] = env.CASPER_API_KEY;
    }
    
    const statusRequest = {
      jsonrpc: '2.0',
      id: uniqueId,
      method: 'info_get_status',
      params: {}
    };
    
    const statusResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(statusRequest),
    });
    
    if (!statusResponse.ok) {
      const text = await statusResponse.text();
      throw new Error(`HTTP ${statusResponse.status}: ${text.substring(0, 100)}`);
    }
    
    const statusData = await statusResponse.json() as any;
    
    if (statusData.error) {
      throw new Error(statusData.error.message || 'Failed to get status');
    }
    
    const lastAddedBlock = statusData.result?.last_added_block_info;
    const latestBlockHash = lastAddedBlock?.hash || lastAddedBlock?.block_hash;
    
    const blockRequest = {
      jsonrpc: '2.0',
      id: uniqueId + 1,
      method: 'chain_get_block',
      params: latestBlockHash ? { block_identifier: { Hash: latestBlockHash } } : {}
    };
    
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(blockRequest),
    });
    
    if (!blockResponse.ok) {
      const text = await blockResponse.text();
      throw new Error(`HTTP ${blockResponse.status}: ${text.substring(0, 100)}`);
    }
    
    const blockData = await blockResponse.json() as any;
    
    if (blockData.error) {
      throw new Error(blockData.error.message || 'Failed to get latest block');
    }
    
    const stateRootHash = blockData.result?.block?.header?.state_root_hash
      || blockData.result?.block_with_signatures?.block?.header?.state_root_hash
      || blockData.result?.block_with_signatures?.block?.Version2?.header?.state_root_hash;
    
    if (!stateRootHash) {
      throw new Error('Could not get state root hash from latest block');
    }
    
    return stateRootHash;
  }

  /**
   * Get message bytes by nonce
   */
  private async getMessageBytes(stateRootHash: string, dictionaryURef: string, nonce: number): Promise<Uint8Array | null> {
    const config = getChainConfig(ChainId.CASPER_TESTNET);
    const rpcUrl = config.rpcUrl;
    
    try {
      const dictionaryItemKey = nonce.toString();
      
      const rpcRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'state_get_dictionary_item',
        params: {
          state_root_hash: stateRootHash,
          dictionary_identifier: {
            URef: {
              seed_uref: dictionaryURef,
              dictionary_item_key: dictionaryItemKey
            }
          }
        }
      };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (env.CASPER_API_KEY) {
        headers['Authorization'] = env.CASPER_API_KEY;
      }
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(rpcRequest),
      });
      
      const data = await response.json() as any;
      
      if (data.error) {
        if (data.error.code === -32001 || data.error.message?.includes('not found')) {
          return null;
        }
        throw new Error(data.error.message || 'RPC error');
      }
      
      if (!data.result?.stored_value?.CLValue) {
        return null;
      }
      
      const clValue = data.result.stored_value.CLValue;
      const bytes = clValue.bytes;
      
      if (!bytes) {
        return null;
      }
      
      let messageBytes: Uint8Array;
      if (typeof bytes === 'string') {
        messageBytes = Uint8Array.from(Buffer.from(bytes, 'hex'));
      } else if (Array.isArray(bytes)) {
        messageBytes = Uint8Array.from(bytes);
      } else {
        messageBytes = bytes;
      }
      
      // Check if messageBytes might have CLValue encoding (length prefix)
      // CLValue List<U8> format: first 4 bytes might be length
      if (messageBytes.length >= 4) {
        const possibleLength = Buffer.from(messageBytes.slice(0, 4)).readUInt32BE(0);
        // If first 4 bytes look like a reasonable length (less than total length and reasonable size)
        if (possibleLength > 0 && possibleLength < messageBytes.length && possibleLength < 10000) {
          logger.debug(
            { 
              nonce, 
              possibleLength, 
              totalLength: messageBytes.length,
              firstBytes: Buffer.from(messageBytes.slice(0, 8)).toString('hex'),
            },
            'Detected possible CLValue length prefix, extracting actual bytes'
          );
          // Extract actual message bytes (skip length prefix)
          messageBytes = messageBytes.slice(4);
        }
      }
      
      return messageBytes.length > 0 ? messageBytes : null;
    } catch (error: any) {
      logger.error({ error: error.message, nonce }, 'Failed to get message bytes');
      return null;
    }
  }

  /**
   * Parse message bytes into structured format
   */
  private parseMessageBytes(messageBytes: Uint8Array): {
    srcChainId: number;
    dstChainId: number;
    srcGateway: Uint8Array;
    receiver: Uint8Array;
    nonce: number;
    payload: Uint8Array;
  } | null {
    try {
      if (messageBytes.length < 16) {
        return null;
      }

      let offset = 0;

      const srcChainId = Buffer.from(messageBytes.slice(offset, offset + 4)).readUInt32BE(0);
      offset += 4;

      const possibleDstChainIdAt4 = Buffer.from(messageBytes.slice(offset, offset + 4)).readUInt32BE(0);
      const possibleDstChainIdAt8 = messageBytes.length >= 12 
        ? Buffer.from(messageBytes.slice(offset + 4, offset + 8)).readUInt32BE(0)
        : null;
      
      let dstChainId: number;
      let srcGatewayStart: number;
      
      if (possibleDstChainIdAt8 === 11155111) {
        offset += 4;
        dstChainId = possibleDstChainIdAt8;
        srcGatewayStart = offset + 4;
      } else {
        dstChainId = possibleDstChainIdAt4;
        srcGatewayStart = offset + 4;
      }
      
      offset = srcGatewayStart;

      const srcGatewayLength = 32;
      const receiverLength = 32;
      const nonceLength = 8;
      
      const srcGateway = messageBytes.slice(offset, offset + srcGatewayLength);
      offset += srcGatewayLength;
      
      const receiverWithPrefix = messageBytes.slice(offset, offset + receiverLength);
      let receiver: Uint8Array;
      if (receiverWithPrefix[0] === 0x17 && receiverWithPrefix[1] === 0x5f && receiverWithPrefix[2] === 0xc9 && receiverWithPrefix[3] === 0xfe) {
        const actualReceiver = receiverWithPrefix.slice(4, 24);
        receiver = new Uint8Array(32);
        receiver.set(actualReceiver, 0);
      } else {
        receiver = receiverWithPrefix;
      }
      offset += receiverLength;
      
      const nonce = Number(Buffer.from(messageBytes.slice(offset, offset + nonceLength)).readBigUInt64BE(0));
      offset += nonceLength;
      
      let payload: Uint8Array;
      if (messageBytes.length >= offset + 4) {
        const possibleLength = Buffer.from(messageBytes.slice(offset, offset + 4)).readUInt32BE(0);
        if (possibleLength > 0 && possibleLength < 10000 && messageBytes.length >= offset + 4 + possibleLength) {
          payload = messageBytes.slice(offset + 4, offset + 4 + possibleLength);
        } else {
          payload = messageBytes.slice(offset);
        }
      } else {
        payload = messageBytes.slice(offset);
      }

      return {
        srcChainId,
        dstChainId,
        srcGateway,
        receiver,
        nonce,
        payload,
      };
    } catch (error) {
      logger.debug({ error, messageLength: messageBytes.length }, 'Failed to parse message bytes');
      return null;
    }
  }

  /**
   * Process a single message by nonce
   */
  private async processMessage(nonce: number): Promise<RelayMessage | null> {
    try {
      const stateRootHash = await this.getStateRootHash();
      const dictionaryURef = await this.getMessagesDictionaryURef();
      
      const messageBytes = await this.getMessageBytes(stateRootHash, dictionaryURef, nonce);
      
      if (!messageBytes) {
        return null;
      }
      
      // Log raw message bytes for debugging
      logger.info(
        { 
          nonce, 
          messageLength: messageBytes.length,
          messageBytesHex: Buffer.from(messageBytes).toString('hex'),
          firstBytes: Buffer.from(messageBytes.slice(0, Math.min(20, messageBytes.length))).toString('hex'),
        },
        '📥 Raw message bytes received from Casper'
      );
      
      const parsed = this.parseMessageBytes(messageBytes);
      if (!parsed) {
        logger.warn({ nonce, messageLength: messageBytes.length }, 'Failed to parse message bytes');
        return null;
      }
      
      // Log parsed values for debugging
      logger.info(
        {
          nonce,
          srcChainId: parsed.srcChainId,
          dstChainId: parsed.dstChainId,
          srcChainIdHex: `0x${parsed.srcChainId.toString(16).padStart(8, '0')}`,
          dstChainIdHex: `0x${parsed.dstChainId.toString(16).padStart(8, '0')}`,
          srcGatewayHex: Buffer.from(parsed.srcGateway).toString('hex'),
          srcGatewayLength: parsed.srcGateway.length,
          receiverHex: Buffer.from(parsed.receiver).toString('hex'),
          receiverLength: parsed.receiver.length,
          payloadHex: Buffer.from(parsed.payload).toString('hex'),
          payloadLength: parsed.payload.length,
          payloadAsString: Buffer.from(parsed.payload).toString('utf8'),
        },
        '📋 Parsed message values from Casper'
      );
      
      // Convert to RelayMessage format
      const payloadHex = Buffer.from(parsed.payload).toString('hex');
      const payloadHash = createHash('sha256').update(parsed.payload).digest('hex');
      
      // Map chain IDs - Since this is from Casper, sourceChain should always be Casper
      // If srcChainId is not 3, log a warning but still use Casper as source
      let sourceChain: string;
      if (parsed.srcChainId === 3) {
        sourceChain = ChainId.CASPER_TESTNET;
      } else {
        logger.warn(
          { 
            parsedSrcChainId: parsed.srcChainId,
            expectedSrcChainId: 3,
            srcChainIdHex: `0x${parsed.srcChainId.toString(16).padStart(8, '0')}`,
            first4Bytes: Buffer.from(messageBytes.slice(0, 4)).toString('hex'),
          },
          '⚠️  Unexpected srcChainId, defaulting to Casper Testnet'
        );
        // Default to Casper since we're reading from Casper gateway
        sourceChain = ChainId.CASPER_TESTNET;
      }
      
      const destinationChain = parsed.dstChainId === 3 ? ChainId.CASPER_TESTNET : 
                               parsed.dstChainId === 11155111 ? ChainId.ETHEREUM_SEPOLIA : 
                               `chain-${parsed.dstChainId}`;
      
      // Convert receiver to contract hash format
      const receiverHex = Buffer.from(parsed.receiver).toString('hex');
      const receiverContractHash = `hash-${receiverHex}`;
      
      const message: RelayMessage = {
        messageId: `casper-${nonce}-${Date.now()}`,
        nonce: parsed.nonce,
        sourceChain,
        destinationChain,
        sourceGateway: this.CONTRACT_HASH,
        destinationGateway: receiverContractHash, // Receiver contract hash
        payload: payloadHex,
        payloadHash,
        timestamp: new Date(),
      };
      
      return message;
    } catch (error: any) {
      logger.error({ error: error.message, nonce }, 'Failed to process message');
      return null;
    }
  }

  /**
   * Poll for new messages
   */
  private async pollForMessages(): Promise<void> {
    try {
      if (!this.rpcClient) {
        await this.initialize();
      }

      // Get last processed nonce from database
      let chainState = await ChainState.findOne({ chainId: ChainId.CASPER_TESTNET });
      if (!chainState) {
        chainState = await ChainState.create({
          chainId: ChainId.CASPER_TESTNET,
          lastProcessedNonce: -1,
        });
      }

      const lastProcessedNonce = chainState.lastProcessedNonce;
      const currentNonce = await this.getCurrentNonce();
      
      // Only process if current nonce is greater than last processed
      if (currentNonce <= lastProcessedNonce) {
        logger.debug(
          { lastProcessedNonce, currentNonce },
          'No new messages (nonce unchanged), skipping'
        );
        return;
      }

      logger.info(
        { lastProcessedNonce, currentNonce, newMessages: currentNonce - lastProcessedNonce - 1 },
        'New messages detected, processing...'
      );

      // Process messages from lastProcessedNonce + 1 to currentNonce - 1
      for (let nonce = lastProcessedNonce + 1; nonce < currentNonce; nonce++) {
        try {
          const message = await this.processMessage(nonce);
          
          if (message) {
            logger.info(
              { messageId: message.messageId, nonce, destinationChain: message.destinationChain },
              'New message detected from Casper'
            );
            
            this.emit('message', message);
            
            // Update last processed nonce
            chainState.lastProcessedNonce = nonce;
            await chainState.save();
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          logger.error({ error: error.message, nonce }, 'Error processing message');
        }
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error polling for messages');
    }
  }

  /**
   * Start listening for new messages
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      logger.warn('Casper Testnet listener is already running');
      return;
    }

    if (!this.rpcClient) {
      await this.initialize();
    }

    this.isListening = true;
    logger.info('Starting Casper Testnet listener (nonce-based polling)');

    // Initial poll
    await this.pollForMessages();

    // Set up polling interval
    this.pollingInterval = setInterval(() => {
      this.pollForMessages().catch(error => {
        logger.error({ error }, 'Error in polling interval');
      });
    }, this.POLL_INTERVAL_MS);

    logger.info(`Casper Testnet listener started (polling every ${this.POLL_INTERVAL_MS}ms)`);
  }

  /**
   * Stop listening for events
   */
  async stopListening(): Promise<void> {
    this.isListening = false;
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    logger.info('Casper Testnet listener stopped');
  }

  /**
   * Check if listener is active
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}
