import {
  RpcClient,
  HttpHandler,
  ContractCallBuilder,
  Args,
  CLValue,
  CLTypeList,
  CLTypeUInt8,
  PublicKey,
  PrivateKey,
  KeyAlgorithm,
} from 'casper-js-sdk';
import { ChainId } from '../../types/chains';
import { RelayMessage, RelayResult } from '../../types/message';
import { getChainConfig } from '../../config/chains';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { signSync, getPublicKey, recoverPublicKey, Point } from '@noble/secp256k1';

/**
 * Casper Testnet message executor
 * Executes messages on Casper gateway contract
 */
export class CasperExecutor {
  private rpcClient: RpcClient | null = null;
  private publicKey: PublicKey | null = null;
  private privateKey: PrivateKey | null = null;
  private readonly CONTRACT_HASH: string;
  private readonly CASPER_CHAIN_ID = 3;

  constructor() {
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
   * Load keypair from PEM files
   */
  private async getKeyPair(): Promise<{ publicKey: PublicKey; privateKey: PrivateKey }> {
    try {
      // casper_keys folder is at src/casper_keys (relative to project root)
      const keysDir = path.join(__dirname, '../../casper_keys');
      const secretKeyPath = path.join(keysDir, 'secret_key.pem');
      
      const secretKeyPem = fs.readFileSync(secretKeyPath, 'utf-8');
      const privateKey = await PrivateKey.fromPem(secretKeyPem, KeyAlgorithm.ED25519);
      const publicKey = privateKey.publicKey;
      
      return { publicKey, privateKey };
    } catch (error) {
      logger.error({ error }, 'Failed to load keypair from PEM files');
      throw error;
    }
  }

  /**
   * Get Secp256k1 private key from PEM file
   */
  private getSecp256k1PrivateKey(): Uint8Array {
    try {
      // casper_keys folder is at src/casper_keys (relative to project root)
      const keysDir = path.join(__dirname, '../../casper_keys');
      const secretKeyPath = path.join(keysDir, 'secret_key.pem');
      
      const secretKeyPem = fs.readFileSync(secretKeyPath, 'utf-8');
      
      const pemHeader = '-----BEGIN PRIVATE KEY-----';
      const pemFooter = '-----END PRIVATE KEY-----';
      
      if (!secretKeyPem.includes(pemHeader) || !secretKeyPem.includes(pemFooter)) {
        throw new Error('Invalid PEM format');
      }
      
      const base64Content = secretKeyPem
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\s/g, '');
      
      const keyBytes = Buffer.from(base64Content, 'base64');
      
      let privateKeyBytes: Uint8Array;
      
      if (keyBytes.length === 48) {
        privateKeyBytes = new Uint8Array(keyBytes.slice(16, 48));
      } else if (keyBytes.length === 32) {
        privateKeyBytes = new Uint8Array(keyBytes);
      } else {
        privateKeyBytes = new Uint8Array(keyBytes.slice(-32));
      }
      
      if (privateKeyBytes.length !== 32) {
        throw new Error(`Invalid private key length: ${privateKeyBytes.length}, expected 32`);
      }
      
      return privateKeyBytes;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to load Secp256k1 private key from PEM file');
      throw error;
    }
  }

  /**
   * Build message bytes according to contract's build_message_bytes function
   */
  private buildMessageBytes(
    srcChainId: number,
    dstChainId: number,
    srcGateway: Uint8Array,
    receiver: Uint8Array,
    nonce: number,
    payload: Uint8Array
  ): Uint8Array {
    const buffer = Buffer.alloc(4 + 4 + 32 + 32 + 8 + payload.length);
    let offset = 0;

    buffer.writeUInt32BE(srcChainId, offset);
    offset += 4;

    buffer.writeUInt32BE(dstChainId, offset);
    offset += 4;

    buffer.set(srcGateway, offset);
    offset += 32;

    buffer.set(receiver, offset);
    offset += 32;

    buffer.writeBigUInt64BE(BigInt(nonce), offset);
    offset += 8;

    buffer.set(payload, offset);

    return new Uint8Array(buffer);
  }

  /**
   * Sign message bytes with Secp256k1
   */
  private signMessage(messageBytes: Uint8Array): { signature: Uint8Array; publicKey: Uint8Array } {
    const relayerPrivateKeyBytes = this.getSecp256k1PrivateKey();
    const privateKey = relayerPrivateKeyBytes;
    
    const publicKey = getPublicKey(privateKey, true);
    const signature = signSync(messageBytes, privateKey, { der: false });
    
    const r = signature.slice(0, 32);
    const s = signature.slice(32, 64);
    
    let v = 0;
    try {
      const recoveredPubKey = recoverPublicKey(messageBytes, signature, v, true);
      if (!Point.fromHex(recoveredPubKey).equals(Point.fromHex(publicKey))) {
        v = 1;
      }
    } catch {
      v = 0;
    }
    
    const fullSignature = new Uint8Array(65);
    fullSignature.set(r, 0);
    fullSignature.set(s, 32);
    fullSignature[64] = v;
    
    return { signature: fullSignature, publicKey };
  }

  /**
   * Initialize executor
   */
  async initialize(): Promise<void> {
    try {
      this.rpcClient = this.createRpcClient();
      const { publicKey, privateKey } = await this.getKeyPair();
      this.publicKey = publicKey;
      this.privateKey = privateKey;
      
      logger.info(
        { 
          contractHash: this.CONTRACT_HASH,
          publicKey: publicKey.toHex(),
        },
        'Casper executor initialized'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Casper executor');
      throw error;
    }
  }

  /**
   * Execute message on Casper gateway contract
   */
  async executeMessage(message: RelayMessage): Promise<RelayResult> {
    if (!this.rpcClient || !this.publicKey || !this.privateKey) {
      await this.initialize();
    }

    try {
      // Parse source chain ID
      const srcChainId = message.sourceChain === ChainId.ETHEREUM_SEPOLIA ? 11155111 :
                        message.sourceChain === ChainId.CASPER_TESTNET ? 3 :
                        parseInt(message.sourceChain.replace('chain-', '')) || 0;

      // Parse receiver (should be 32 bytes hex)
      const receiverBytes = Buffer.from(message.destinationGateway.replace('hash-', ''), 'hex');
      if (receiverBytes.length !== 32) {
        throw new Error(`Invalid receiver length: expected 32 bytes, got ${receiverBytes.length}`);
      }
      const receiver = new Uint8Array(receiverBytes);

      // Parse source gateway (32 bytes)
      const srcGatewayHex = message.sourceGateway.replace('hash-', '').replace('0x', '');
      const srcGatewayBytes = Buffer.from(srcGatewayHex, 'hex');
      const srcGateway = new Uint8Array(32);
      srcGateway.set(srcGatewayBytes.slice(-32), 0);

      // Parse payload
      const payload = Buffer.from(message.payload, 'hex');

      // Build message bytes
      const messageBytes = this.buildMessageBytes(
        srcChainId,
        this.CASPER_CHAIN_ID,
        srcGateway,
        receiver,
        message.nonce,
        payload
      );

      // Sign message
      const { signature } = this.signMessage(messageBytes);

      logger.info(
        {
          messageId: message.messageId,
          srcChainId,
          receiver: Buffer.from(receiver).toString('hex'),
          nonce: message.nonce,
          payloadLength: payload.length,
        },
        'Executing message on Casper gateway'
      );

      // Build runtime arguments
      const srcGatewayList = Array.from(srcGateway).map(byte => CLValue.newCLUint8(byte));
      const receiverList = Array.from(receiver).map(byte => CLValue.newCLUint8(byte));
      const payloadList = Array.from(payload).map(byte => CLValue.newCLUint8(byte));
      const signatureList = Array.from(signature).map(byte => CLValue.newCLUint8(byte));
      
      const listU8Type = new CLTypeList(CLTypeUInt8);
      
      const runtimeArgs = Args.fromMap({
        src_chain_id: CLValue.newCLUInt32(srcChainId),
        src_gateway: CLValue.newCLList(listU8Type, srcGatewayList),
        receiver: CLValue.newCLList(listU8Type, receiverList),
        nonce: CLValue.newCLUint64(BigInt(message.nonce)),
        payload: CLValue.newCLList(listU8Type, payloadList),
        signature: CLValue.newCLList(listU8Type, signatureList),
      });

      // Parse contract hash
      const contractHashStr = this.CONTRACT_HASH.replace('hash-', '');
      if (contractHashStr.length !== 64) {
        throw new Error(`Invalid contract hash length: expected 64 hex chars, got ${contractHashStr.length}`);
      }

      // Build transaction
      const transaction = new ContractCallBuilder()
        .from(this.publicKey!)
        .byHash(contractHashStr)
        .entryPoint('execute_message')
        .runtimeArgs(runtimeArgs)
        .chainName('casper-test')
        .payment(3_000_000_000)
        .buildFor1_5();

      // Sign transaction
      transaction.sign(this.privateKey!);

      const transactionHash = transaction.hash.toHex();
      logger.info({ transactionHash }, 'Transaction signed, sending to network...');

      // Send transaction
      await this.rpcClient!.putTransaction(transaction);
      
      logger.info({ transactionHash }, '✅ Transaction sent successfully!');

      // Get deploy hash
      const deploy = transaction.getDeploy();
      const deployHash = deploy ? deploy.hash.toHex() : transactionHash;

      // Wait for transaction to be processed
      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        
        try {
          const transactionInfo = await this.rpcClient!.getTransactionByDeployHash(deployHash);
          
          if (transactionInfo?.executionInfo) {
            const executionInfo = transactionInfo.executionInfo;
            const executionResult = executionInfo.executionResult as any;
            
            const errorMessage = executionResult?.errorMessage || null;
            
            if (!errorMessage) {
              logger.info(
                {
                  transactionHash,
                  blockHash: executionInfo.blockHash?.toHex?.() || executionInfo.blockHash,
                  blockHeight: executionInfo.blockHeight,
                },
                '✅ Message executed successfully on Casper!'
              );
              
              return {
                success: true,
                messageId: message.messageId,
                transactionHash,
                timestamp: new Date(),
              };
            } else {
              logger.error(
                { transactionHash, errorMessage },
                'Transaction execution failed'
              );
              throw new Error(`Transaction failed: ${errorMessage}`);
            }
          }
        } catch (error: any) {
          if (error.message?.includes('not found') || error.message?.includes('pending')) {
            // Continue waiting
          } else {
            throw error;
          }
        }
        
        attempts++;
      }
      
      throw new Error('Transaction not processed within timeout period');
    } catch (error: any) {
      logger.error({ error: error.message || error, messageId: message.messageId }, 'Failed to execute message on Casper');
      return {
        success: false,
        messageId: message.messageId,
        error: error.message || String(error),
        timestamp: new Date(),
      };
    }
  }
}
