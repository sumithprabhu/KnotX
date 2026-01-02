/**
 * Test script to execute a message on Casper gateway contract
 * 
 * This simulates receiving a message from Sepolia Ethereum and executing it on Casper
 * 
 * Usage: ts-node src/scripts/test-execute-message-casper.ts
 */

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
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { signSync, getPublicKey, recoverPublicKey, Point, utils } from '@noble/secp256k1';

// Configuration
const RPC_URL = 'https://node.testnet.cspr.cloud/rpc';
const API_KEY = '019b7cfa-8db3-7a21-89b3-e3a0bc3f3340';
const CONTRACT_HASH = 'hash-4ce6b9ec80fde0158f7ab13f37cff883660048c1d457e9e48130cc884ce83073';

// Test parameters
const SRC_CHAIN_ID = 11155111; // Ethereum Sepolia chain ID
const CASPER_CHAIN_ID = 3; // Casper chain ID (destination)
const NONCE = 0; // Nonce for the message (you may need to adjust this)

// Receiver: Contract hash that will receive the message
// This is the mock_receiver contract hash (32 bytes)
const RECEIVER_CONTRACT_HASH = 'hash-2ede3272d048e81c344c68f65db55141e1132d70da6443770ac0de443534d36e';

// Source gateway: Placeholder Ethereum gateway address (20 bytes, padded to 32)
const SRC_GATEWAY_HEX = '0000000000000000000000000000000000000000'; // Placeholder - replace with actual gateway
const srcGatewayBytes = Buffer.from(SRC_GATEWAY_HEX, 'hex');
const SRC_GATEWAY = new Uint8Array(32);
SRC_GATEWAY.set(srcGatewayBytes, 12); // Place at end (20 bytes)

// Payload: "hello world"
const PAYLOAD = new TextEncoder().encode('hello world');

/**
 * Create RPC client with Authorization header
 */
function createRpcClient(): RpcClient {
  try {
    const httpHandler = new HttpHandler(RPC_URL);
    httpHandler.setCustomHeaders({
      Authorization: API_KEY,
      'Content-Type': 'application/json',
    });

    const rpcClient = new RpcClient(httpHandler);
    
    logger.info(
      { 
        rpcUrl: RPC_URL,
        apiKeyPrefix: API_KEY.substring(0, 10) + '...',
      },
      'RPC client created with Authorization header'
    );
    return rpcClient;
  } catch (error) {
    logger.error({ error }, 'Failed to create RPC client');
    throw error;
  }
}

/**
 * Load keypair from PEM files (for transaction signing)
 */
async function getKeyPair(): Promise<{ publicKey: PublicKey; privateKey: PrivateKey }> {
  try {
    const keysDir = path.join(__dirname, '../casper_keys');
    const secretKeyPath = path.join(keysDir, 'secret_key.pem');
    
    const secretKeyPem = fs.readFileSync(secretKeyPath, 'utf-8');
    const privateKey = await PrivateKey.fromPem(secretKeyPem, KeyAlgorithm.ED25519);
    const publicKey = privateKey.publicKey;
    
    logger.info(
      { 
        publicKey: publicKey.toHex(),
        keyPath: secretKeyPath,
      },
      'Loaded keypair from PEM files'
    );
    
    return { publicKey, privateKey };
  } catch (error) {
    logger.error({ error }, 'Failed to load keypair from PEM files');
    throw error;
  }
}

/**
 * Load Secp256k1 private key from the same PEM file
 * The relayer uses the same private key bytes but as Secp256k1
 */
function getSecp256k1PrivateKey(): Uint8Array {
  try {
    const keysDir = path.join(__dirname, '../casper_keys');
    const secretKeyPath = path.join(keysDir, 'secret_key.pem');
    
    // Read the PEM file
    const secretKeyPem = fs.readFileSync(secretKeyPath, 'utf-8');
    
    // Parse PEM to get raw private key bytes
    // ED25519 PEM format: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    
    if (!secretKeyPem.includes(pemHeader) || !secretKeyPem.includes(pemFooter)) {
      throw new Error('Invalid PEM format');
    }
    
    // Extract base64 content
    const base64Content = secretKeyPem
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    
    const keyBytes = Buffer.from(base64Content, 'base64');
    
    // ED25519 private key in PKCS#8 format is typically 48 bytes:
    // - 16 bytes header
    // - 32 bytes actual private key
    // We need to extract the 32-byte private key
    let privateKeyBytes: Uint8Array;
    
    if (keyBytes.length === 48) {
      // PKCS#8 format: extract the 32-byte key (usually at offset 16)
      privateKeyBytes = new Uint8Array(keyBytes.slice(16, 48));
    } else if (keyBytes.length === 32) {
      // Already raw 32 bytes
      privateKeyBytes = new Uint8Array(keyBytes);
    } else {
      // Try to find the 32-byte key in the structure
      // For ED25519, the key is usually the last 32 bytes
      privateKeyBytes = new Uint8Array(keyBytes.slice(-32));
    }
    
    if (privateKeyBytes.length !== 32) {
      throw new Error(`Invalid private key length: ${privateKeyBytes.length}, expected 32`);
    }
    
    logger.info(
      {
        privateKeyHex: Buffer.from(privateKeyBytes).toString('hex'),
        keyPath: secretKeyPath,
      },
      'Loaded Secp256k1 private key from PEM file (same as ED25519 key bytes)'
    );
    
    return privateKeyBytes;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to load Secp256k1 private key from PEM file');
    throw error;
  }
}

/**
 * Build message bytes according to contract's build_message_bytes function
 * Format: src_chain_id (4) + dst_chain_id (4) + src_gateway (32) + receiver (32) + nonce (8) + payload (variable)
 */
function buildMessageBytes(
  srcChainId: number,
  dstChainId: number,
  srcGateway: Uint8Array,
  receiver: Uint8Array,
  nonce: number,
  payload: Uint8Array
): Uint8Array {
  const buffer = Buffer.alloc(4 + 4 + 32 + 32 + 8 + payload.length);
  let offset = 0;

  // src_chain_id (4 bytes, big-endian)
  buffer.writeUInt32BE(srcChainId, offset);
  offset += 4;

  // dst_chain_id (4 bytes, big-endian)
  buffer.writeUInt32BE(dstChainId, offset);
  offset += 4;

  // src_gateway (32 bytes)
  buffer.set(srcGateway, offset);
  offset += 32;

  // receiver (32 bytes)
  buffer.set(receiver, offset);
  offset += 32;

  // nonce (8 bytes, big-endian)
  buffer.writeBigUInt64BE(BigInt(nonce), offset);
  offset += 8;

  // payload (variable length)
  buffer.set(payload, offset);

  return new Uint8Array(buffer);
}

/**
 * Convert contract hash to 32-byte receiver address
 * The receiver should be the contract hash (32 bytes, without 'hash-' prefix)
 */
function getReceiverFromContractHash(contractHash: string): Uint8Array {
  // Remove 'hash-' prefix if present
  const hashStr = contractHash.replace('hash-', '');
  
  if (hashStr.length !== 64) {
    throw new Error(`Invalid contract hash length: expected 64 hex chars, got ${hashStr.length}`);
  }
  
  // Convert hex string to 32-byte Uint8Array
  return new Uint8Array(Buffer.from(hashStr, 'hex'));
}

/**
 * Get relayer public key from contract
 */
async function getRelayerPubkey(rpcClient: RpcClient): Promise<Uint8Array | null> {
  try {
    const queryResult = await rpcClient.queryLatestGlobalState(CONTRACT_HASH, ['relayer_pubkey']);
    
    if (queryResult.storedValue?.clValue) {
      const clValue = queryResult.storedValue.clValue;
      const bytes = clValue.bytes();
      if (bytes) {
        // The bytes might be stored with a length prefix (CLValue format)
        // Try to extract the actual 33-byte key
        let keyBytes: Uint8Array;
        
        if (bytes.length === 33) {
          // Already 33 bytes
          keyBytes = new Uint8Array(bytes);
        } else if (bytes.length === 37 && bytes[0] === 0x21) {
          // CLValue with length prefix: 0x21 (33) + 33 bytes of key
          keyBytes = new Uint8Array(bytes.slice(4, 37));
        } else if (bytes.length > 33) {
          // Try to find 33 bytes starting with 0x01, 0x02, or 0x03 (key type prefix)
          const keyStart = bytes.findIndex((b, i) => 
            (b === 0x01 || b === 0x02 || b === 0x03) && 
            i + 32 < bytes.length
          );
          if (keyStart >= 0) {
            keyBytes = new Uint8Array(bytes.slice(keyStart, keyStart + 33));
          } else {
            // Take last 33 bytes
            keyBytes = new Uint8Array(bytes.slice(-33));
          }
        } else {
          logger.warn(
            {
              bytesLength: bytes.length,
              bytesHex: Buffer.from(bytes).toString('hex'),
            },
            'Relayer pubkey has unexpected length'
          );
          return null;
        }
        
        if (keyBytes.length === 33) {
          return keyBytes;
        }
      }
    }
    
    // Try to get from raw JSON
    if (queryResult.rawJSON) {
      const raw = typeof queryResult.rawJSON === 'string' 
        ? JSON.parse(queryResult.rawJSON) 
        : queryResult.rawJSON;
      
      const storedValue = raw?.stored_value;
      if (storedValue?.CLValue) {
        const clValue = storedValue.CLValue;
        const bytes = clValue.bytes;
        if (bytes && typeof bytes === 'string') {
          const keyBytes = Buffer.from(bytes, 'hex');
          if (keyBytes.length === 33) {
            return new Uint8Array(keyBytes);
          }
        }
      }
    }
    
    return null;
  } catch (error: any) {
    logger.debug({ error: error.message }, 'Could not get relayer pubkey from contract');
    return null;
  }
}

/**
 * Sign message bytes with Secp256k1 private key
 * Note: The contract expects Secp256k1 signature (65 bytes: r, s, v)
 * 
 * For testing, we'll generate a random Secp256k1 key pair
 * In production, you'd use the actual relayer's Secp256k1 private key
 */
function signMessage(messageBytes: Uint8Array, relayerPrivateKeyHex?: string): { signature: Uint8Array; publicKey: Uint8Array } {
  let privateKey: Uint8Array;
  
  if (relayerPrivateKeyHex) {
    // Use provided private key (32 bytes hex = 64 hex chars)
    privateKey = new Uint8Array(Buffer.from(relayerPrivateKeyHex, 'hex'));
    if (privateKey.length !== 32) {
      throw new Error('Invalid private key length - must be 32 bytes (64 hex chars)');
    }
  } else {
    // Generate a random key for testing
    logger.warn('No relayer private key provided - generating random key for testing');
    privateKey = utils.randomPrivateKey();
  }
  
  // Get public key (compressed, 33 bytes)
  const publicKey = getPublicKey(privateKey, true); // compressed = true
  
  // Sign the message
  // Casper uses raw message bytes (not hashed)
  const signature = signSync(messageBytes, privateKey, { der: false });
  
  // Convert to 65-byte format: [r (32 bytes), s (32 bytes), v (1 byte)]
  // secp256k1 signature is already 64 bytes (r, s), we need to add recovery id (v)
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  
  // Calculate recovery id (v)
  // For Casper, we typically use 0 or 1 for v
  // Try to recover the public key to determine v
  let v = 0;
  try {
    const recoveredPubKey = recoverPublicKey(messageBytes, signature, v, true);
    if (!Point.fromHex(recoveredPubKey).equals(Point.fromHex(publicKey))) {
      v = 1;
    }
  } catch {
    v = 0; // Default to 0 if recovery fails
  }
  
  // Create 65-byte signature: r + s + v
  const fullSignature = new Uint8Array(65);
  fullSignature.set(r, 0);
  fullSignature.set(s, 32);
  fullSignature[64] = v;
  
  logger.info(
    {
      publicKeyHex: Buffer.from(publicKey).toString('hex'),
      signatureLength: fullSignature.length,
      signatureHex: Buffer.from(fullSignature).toString('hex'),
    },
    'Message signed with Secp256k1'
  );
  
  return { signature: fullSignature, publicKey };
}

/**
 * Execute message on Casper gateway contract
 */
async function executeMessage(): Promise<void> {
  try {
    logger.info('Starting execute_message test...');

    const rpcClient = createRpcClient();
    const { publicKey, privateKey } = await getKeyPair();

    // Get receiver address from contract hash
    const receiver = getReceiverFromContractHash(RECEIVER_CONTRACT_HASH);

    // Build message bytes
    const messageBytes = buildMessageBytes(
      SRC_CHAIN_ID,
      CASPER_CHAIN_ID,
      SRC_GATEWAY,
      receiver,
      NONCE,
      PAYLOAD
    );

    logger.info(
      {
        contractHash: CONTRACT_HASH,
        srcChainId: SRC_CHAIN_ID,
        dstChainId: CASPER_CHAIN_ID,
        srcGateway: Buffer.from(SRC_GATEWAY).toString('hex'),
        receiver: Buffer.from(receiver).toString('hex'),
        receiverContractHash: RECEIVER_CONTRACT_HASH,
        nonce: NONCE,
        payload: Buffer.from(PAYLOAD).toString('hex'),
        payloadText: new TextDecoder().decode(PAYLOAD),
        messageBytesLength: messageBytes.length,
        messageBytesHex: Buffer.from(messageBytes).toString('hex'),
      },
      'Preparing execute_message transaction'
    );

    // Sign message bytes with Secp256k1
    // Use the same private key from casper_keys (interpreted as Secp256k1)
    const relayerPrivateKeyBytes = getSecp256k1PrivateKey();
    const relayerPrivateKeyHex = Buffer.from(relayerPrivateKeyBytes).toString('hex');
    const { signature, publicKey: signingPubkey } = signMessage(messageBytes, relayerPrivateKeyHex);
    
    logger.info(
      {
        signingPubkeyHex: Buffer.from(signingPubkey).toString('hex'),
        signingPubkeyLength: signingPubkey.length,
      },
      'Generated Secp256k1 public key from private key'
    );
    
    // Get relayer pubkey from contract to verify we're using the right key
    const contractRelayerPubkey = await getRelayerPubkey(rpcClient);
    if (contractRelayerPubkey) {
      logger.info(
        {
          contractRelayerPubkeyHex: Buffer.from(contractRelayerPubkey).toString('hex'),
          contractRelayerPubkeyLength: contractRelayerPubkey.length,
        },
        'Retrieved relayer pubkey from contract'
      );
      
      // Verify the public key matches the relayer pubkey
      const matches = contractRelayerPubkey.length === signingPubkey.length && 
                     contractRelayerPubkey.every((b, i) => b === signingPubkey[i]);
      
      if (matches) {
        logger.info('✅ Signing public key matches contract relayer pubkey');
      } else {
        logger.error(
          {
            contractRelayerPubkey: Buffer.from(contractRelayerPubkey).toString('hex'),
            signingPubkey: Buffer.from(signingPubkey).toString('hex'),
          },
          '❌ Signing public key does NOT match contract relayer pubkey - signature will fail!'
        );
        logger.warn(
          'The contract was installed with a different relayer_pubkey. ' +
          'You need to either: 1) Reinstall the contract with the correct relayer_pubkey, ' +
          'or 2) Use the private key that corresponds to the stored relayer_pubkey.'
        );
      }
    } else {
      logger.warn(
        'Could not retrieve relayer pubkey from contract - cannot verify key match'
      );
    }

    // Parse contract hash
    const contractHashStr = CONTRACT_HASH.replace('hash-', '');
    if (contractHashStr.length !== 64) {
      throw new Error(`Invalid contract hash length: expected 64 hex chars, got ${contractHashStr.length}`);
    }

    // Build runtime arguments using CLValue types
    const srcGatewayList = Array.from(SRC_GATEWAY).map(byte => CLValue.newCLUint8(byte));
    const receiverList = Array.from(receiver).map(byte => CLValue.newCLUint8(byte));
    const payloadList = Array.from(PAYLOAD).map(byte => CLValue.newCLUint8(byte));
    const signatureList = Array.from(signature).map(byte => CLValue.newCLUint8(byte));
    
    // Create List<U8> type
    const listU8Type = new CLTypeList(CLTypeUInt8);
    
    const runtimeArgs = Args.fromMap({
      src_chain_id: CLValue.newCLUInt32(SRC_CHAIN_ID),
      src_gateway: CLValue.newCLList(listU8Type, srcGatewayList),
      receiver: CLValue.newCLList(listU8Type, receiverList),
      nonce: CLValue.newCLUint64(BigInt(NONCE)),
      payload: CLValue.newCLList(listU8Type, payloadList),
      signature: CLValue.newCLList(listU8Type, signatureList),
    });

    // Build contract call transaction
    const transaction = new ContractCallBuilder()
      .from(publicKey)
      .byHash(contractHashStr)
      .entryPoint('execute_message')
      .runtimeArgs(runtimeArgs)
      .chainName('casper-test')
      .payment(3_000_000_000) // 3 CSPR in motes
      .buildFor1_5(); // Use Casper 1.5 format

    // Sign transaction
    transaction.sign(privateKey);

    const transactionHash = transaction.hash.toHex();
    logger.info(
      { transactionHash },
      'Transaction signed, sending to network...'
    );

    // Send transaction
    const result = await rpcClient.putTransaction(transaction);
    
    logger.info(
      { transactionHash, result },
      '✅ Transaction sent successfully!'
    );

    // Get deploy hash
    const deploy = transaction.getDeploy();
    const deployHash = deploy ? deploy.hash.toHex() : transactionHash;

    // Wait for transaction to be processed
    logger.info('Waiting for transaction to be processed...');
    
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      try {
        const transactionInfo = await rpcClient.getTransactionByDeployHash(deployHash);
        
        if (!transactionInfo) {
          logger.debug(
            { attempt: attempts + 1, maxAttempts },
            'Transaction not found yet, waiting...'
          );
          continue;
        }
        
        if (transactionInfo.executionInfo) {
          const executionInfo = transactionInfo.executionInfo;
          const executionResult = executionInfo.executionResult;
          
          // Check for error message (could be in different formats)
          let errorMessage: string | null = null;
          
          if (executionResult) {
            // Try different possible locations for error message
            const result = executionResult as any;
            errorMessage = result.errorMessage || 
                          result.error_message ||
                          result.Version2?.error_message ||
                          result.Version2?.errorMessage ||
                          null;
          }
          
          if (!errorMessage) {
            // Success!
            const blockHash = executionInfo.blockHash?.toHex?.() || 
                             (executionInfo.blockHash as any)?.toString?.() ||
                             executionInfo.blockHash;
            
            const result = executionResult as any;
            logger.info(
              {
                transactionHash,
                deployHash,
                blockHash,
                blockHeight: executionInfo.blockHeight,
                cost: result?.cost || result?.Version2?.cost,
                consumed: result?.consumed || result?.Version2?.consumed,
                limit: result?.limit || result?.Version2?.limit,
              },
              '✅ Transaction executed successfully!'
            );
            return;
          } else {
            logger.error(
              {
                transactionHash,
                errorMessage,
                executionResult: JSON.stringify(executionResult, null, 2),
              },
              'Transaction execution failed'
            );
            throw new Error(`Transaction failed: ${errorMessage}`);
          }
        } else {
          // Transaction exists but no execution info yet
          logger.debug(
            { attempt: attempts + 1, maxAttempts, hasExecutionInfo: false },
            'Transaction found but execution info not available yet, waiting...'
          );
        }
      } catch (error: any) {
        if (error.message?.includes('not found') || 
            error.message?.includes('pending') ||
            error.message?.includes('Cannot read properties')) {
          logger.debug(
            { attempt: attempts + 1, maxAttempts, error: error.message },
            'Transaction not yet processed, waiting...'
          );
        } else {
          throw error;
        }
      }
      
      attempts++;
    }
    
    throw new Error('Transaction not processed within timeout period');
  } catch (error: any) {
    logger.error({ error: error.message || error }, 'Failed to execute message');
    throw error;
  }
}

// Run the script
executeMessage()
  .then(() => {
    logger.info('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ error }, 'Test failed');
    process.exit(1);
  });

