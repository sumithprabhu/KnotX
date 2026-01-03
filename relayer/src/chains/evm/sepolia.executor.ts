import { ethers } from 'ethers';
import { ChainId } from '../../types/chains';
import { RelayMessage, RelayResult } from '../../types/message';
import { getChainConfig } from '../../config/chains';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Gateway contract ABI - executeMessage function
 */
const GATEWAY_ABI = [
  'function executeMessage(uint32 srcChainId, bytes sender, bytes receiver, uint64 messageNonce, bytes payload, bytes relayerSignature) external',
  'function sendMessage(uint32 dstChainId, bytes receiver, bytes payload) external payable returns (bytes32 messageId)',
  'event MessageSent(bytes32 indexed messageId, uint32 dstChainId, bytes receiver, bytes sender, uint64 nonce, bytes payload)',
];

/**
 * Ethereum Sepolia message executor
 * Executes messages on Sepolia gateway contract
 */
export class SepoliaExecutor {
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;
  private readonly GATEWAY_ADDRESS: string;
  private readonly SEPOLIA_CHAIN_ID = 11155111;

  constructor() {
    this.GATEWAY_ADDRESS = env.ETHEREUM_SEPOLIA_GATEWAY || '0xD3B1c72361f03d5F138C2c768AfdF700266bb39a';
  }

  /**
   * Initialize executor
   */
  async initialize(): Promise<void> {
    try {
      const config = getChainConfig(ChainId.ETHEREUM_SEPOLIA);
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

      if (config.privateKey) {
        this.signer = new ethers.Wallet(config.privateKey, this.provider);
        logger.info(
          { 
            address: await this.signer.getAddress(),
            gatewayAddress: this.GATEWAY_ADDRESS,
          },
          'Ethereum Sepolia executor initialized'
        );
      } else {
        throw new Error('No private key configured for Ethereum Sepolia executor');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Ethereum Sepolia executor');
      throw error;
    }
  }

  /**
   * Sign message for relayer signature
   * The contract expects a signature over the message hash
   * Based on MessageHash.sol: keccak256(abi.encode(srcChainId, dstChainId, srcGateway, keccak256(receiver), nonce, keccak256(payload)))
   */
  private async signMessageForRelayer(
    srcChainId: number,
    dstChainId: number,
    sender: string,
    receiver: string,
    nonce: number,
    payload: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not initialized');
    }

    // Build message hash (same as contract's MessageHash.compute)
    // The contract uses: keccak256(abi.encode(srcChainId, dstChainId, srcGateway, keccak256(receiver), nonce, keccak256(payload)))
    const receiverHash = ethers.keccak256(receiver);
    const payloadHash = ethers.keccak256(payload);
    
    // Use abi.encode (not abi.encodePacked) - this adds padding and length prefixes
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint32', 'uint32', 'bytes', 'bytes32', 'uint64', 'bytes32'],
      [srcChainId, dstChainId, sender, receiverHash, nonce, payloadHash]
    );
    
    const messageHash = ethers.keccak256(encoded);

    // Sign the message hash (EIP-191 personal sign)
    // The contract uses SignatureVerifier.verify which expects EIP-191 format
    const messageHashBytes = ethers.getBytes(messageHash);
    const signature = await this.signer.signMessage(messageHashBytes);
    
    return signature;
  }

  /**
   * Execute message on Sepolia gateway contract
   */
  async executeMessage(message: RelayMessage): Promise<RelayResult> {
    if (!this.provider || !this.signer) {
      await this.initialize();
    }

    if (!this.signer) {
      throw new Error('Ethereum Sepolia executor not properly initialized');
    }

    try {
      // Parse source chain ID
      const srcChainId = message.sourceChain === ChainId.ETHEREUM_SEPOLIA ? 11155111 :
                        message.sourceChain === ChainId.CASPER_TESTNET ? 3 :
                        parseInt(message.sourceChain.replace('chain-', '')) || 0;

      // Parse sender (source gateway)
      // For EVM, sender is an address (20 bytes) or bytes
      let sender: string;
      if (message.sourceGateway.startsWith('0x')) {
        // Already an address
        sender = message.sourceGateway;
      } else if (message.sourceGateway.startsWith('hash-')) {
        // Casper contract hash - extract bytes
        const senderHex = message.sourceGateway.replace('hash-', '');
        sender = ethers.hexlify(Buffer.from(senderHex, 'hex'));
      } else {
        sender = ethers.hexlify(Buffer.from(message.sourceGateway, 'hex'));
      }

      // Parse receiver
      // For EVM, receiver is bytes (can be 20 bytes address or 32 bytes contract hash)
      let receiver: string;
      if (message.destinationGateway.startsWith('0x')) {
        // Already hex format
        receiver = message.destinationGateway;
      } else if (message.destinationGateway.startsWith('hash-')) {
        // Casper contract hash - extract bytes
        const receiverHex = message.destinationGateway.replace('hash-', '');
        receiver = ethers.hexlify(Buffer.from(receiverHex, 'hex'));
      } else {
        receiver = ethers.hexlify(Buffer.from(message.destinationGateway, 'hex'));
      }

      // Parse payload
      const payload = '0x' + message.payload;

      logger.info(
        {
          messageId: message.messageId,
          srcChainId,
          sender,
          receiver,
          nonce: message.nonce,
          payloadLength: message.payload.length / 2,
        },
        'Executing message on Sepolia gateway'
      );

      // Sign message for relayer signature
      const relayerSignature = await this.signMessageForRelayer(
        srcChainId,
        this.SEPOLIA_CHAIN_ID,
        sender,
        receiver,
        message.nonce,
        payload
      );

      // Create contract instance
      const contract = new ethers.Contract(
        this.GATEWAY_ADDRESS,
        GATEWAY_ABI,
        this.signer
      );

      // Call executeMessage
      const tx = await contract.executeMessage(
        srcChainId,
        sender,
        receiver,
        message.nonce,
        payload,
        relayerSignature,
        { gasLimit: 500000 }
      );

      logger.info({ transactionHash: tx.hash }, 'Transaction sent, waiting for confirmation...');

      // Wait for transaction
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        logger.info(
          {
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
          },
          '✅ Message executed successfully on Sepolia!'
        );

        return {
          success: true,
          messageId: message.messageId,
          transactionHash: receipt.hash,
          timestamp: new Date(),
        };
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (error: any) {
      logger.error({ error: error.message || error, messageId: message.messageId }, 'Failed to execute message on Sepolia');
      return {
        success: false,
        messageId: message.messageId,
        error: error.message || String(error),
        timestamp: new Date(),
      };
    }
  }
}
