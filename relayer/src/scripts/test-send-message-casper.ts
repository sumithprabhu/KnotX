/**
 * Test script to send a message via Casper gateway contract
 * 
 * Usage: ts-node src/scripts/test-send-message-casper.ts
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

// Configuration
const RPC_URL = 'https://node.testnet.cspr.cloud/rpc';
const API_KEY = '019b7cfa-8db3-7a21-89b3-e3a0bc3f3340';
const CONTRACT_HASH = 'hash-a595eebdfe2f22390873593f94f247824d0edc7e9a9d53003af2b5d7332069e6';

// Test parameters
const DST_CHAIN_ID = 11155111; // Ethereum Sepolia chain ID
// Receiver: 0x12345678910987654321 (20 bytes) - pad to 32 bytes for Casper
const RECEIVER_HEX = '12345678910987654321';
const receiverBytes = Buffer.from(RECEIVER_HEX, 'hex'); // 20 bytes from hex
const RECEIVER = new Uint8Array(32);
RECEIVER.set(receiverBytes, 0); // Copy 20 bytes at start
// Remaining 12 bytes stay as 0 (default)
// Payload: "hello world" as bytes for testing
const PAYLOAD = new TextEncoder().encode('hello world'); // "hello world" as UTF-8 bytes

/**
 * Create RPC client with Authorization header
 */
function createRpcClient(): RpcClient {
  try {
    // Create HttpHandler with custom headers for Authorization
    const httpHandler = new HttpHandler(RPC_URL);
    httpHandler.setCustomHeaders({
      Authorization: API_KEY,
      'Content-Type': 'application/json',
    });

    // Create RpcClient with the configured handler
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
 * Load keypair from PEM files
 */
async function getKeyPair(): Promise<{ publicKey: PublicKey; privateKey: PrivateKey }> {
  try {
    const keysDir = path.join(__dirname, '../casper_keys');
    const secretKeyPath = path.join(keysDir, 'secret_key.pem');
    
    // Read the secret key PEM file
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
 * Send message to Casper gateway contract
 */
async function sendMessage(): Promise<void> {
  try {
    logger.info('Starting send_message test...');

    // Create RPC client with Authorization header
    const rpcClient = createRpcClient();
    logger.info('RPC client created');

    // Get keypair for signing
    const { publicKey, privateKey } = await getKeyPair();

    // Parse contract hash (remove 'hash-' prefix)
    const contractHashStr = CONTRACT_HASH.replace('hash-', '');
    
    if (contractHashStr.length !== 64) {
      throw new Error(`Invalid contract hash length: expected 64 hex chars, got ${contractHashStr.length}`);
    }

    logger.info(
      {
        contractHash: CONTRACT_HASH,
        contractHashHex: contractHashStr,
        dstChainId: DST_CHAIN_ID,
        receiver: Buffer.from(RECEIVER).toString('hex'),
        receiverLength: RECEIVER.length,
        payload: Buffer.from(PAYLOAD).toString('hex'),
        payloadLength: PAYLOAD.length,
      },
      'Preparing send_message transaction'
    );
    
    console.log('\n🚀 SENDING MESSAGE TO CONTRACT:');
    console.log(`   Contract Hash: ${CONTRACT_HASH}`);
    console.log(`   Destination Chain ID: ${DST_CHAIN_ID}`);
    console.log(`   Receiver (hex): ${Buffer.from(RECEIVER).toString('hex')}`);
    console.log(`   Receiver (original): 0x${RECEIVER_HEX}`);
    console.log(`   Receiver length: ${RECEIVER.length} bytes`);
    console.log(`   Payload: ${Buffer.from(PAYLOAD).toString('hex')}`);
    console.log(`   Payload (text): ${new TextDecoder().decode(PAYLOAD)}`);
    console.log(`   Payload length: ${PAYLOAD.length} bytes\n`);

    // Build runtime arguments using CLValue types
    // Note: receiver and payload need to be List<U8>, not ByteArray
    const receiverList = Array.from(RECEIVER).map(byte => CLValue.newCLUint8(byte));
    const payloadList = Array.from(PAYLOAD).map(byte => CLValue.newCLUint8(byte));
    
    // Create List<U8> type
    const listU8Type = new CLTypeList(CLTypeUInt8);
    
    const runtimeArgs = Args.fromMap({
      dst_chain_id: CLValue.newCLUInt32(DST_CHAIN_ID),
      receiver: CLValue.newCLList(listU8Type, receiverList),
      payload: CLValue.newCLList(listU8Type, payloadList),
    });

    // Build contract call transaction using ContractCallBuilder
    const transaction = new ContractCallBuilder()
      .from(publicKey)
      .byHash(contractHashStr)
      .entryPoint('send_message')
      .runtimeArgs(runtimeArgs)
      .chainName('casper-test')
      .payment(3_000_000_000) // 3 CSPR in motes (matching example)
      .buildFor1_5(); // Use Casper 1.5 format (legacy deploy)

    // Sign the transaction
    transaction.sign(privateKey);

    const transactionHash = transaction.hash.toHex();
    logger.info(
      { transactionHash },
      'Transaction signed, sending to network...'
    );

    // Send transaction (for Casper 1.5, this creates a deploy internally)
    const result = await rpcClient.putTransaction(transaction);
    
    logger.info(
      { transactionHash, result },
      '✅ Transaction sent successfully!'
    );

    // Get the deploy from transaction if available
    const deploy = transaction.getDeploy();
    const deployHash = deploy ? deploy.hash.toHex() : transactionHash;

    // Wait for transaction to be processed (polling)
    logger.info('Waiting for transaction to be processed...');
    
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      try {
        const transactionInfo = await rpcClient.getTransactionByDeployHash(deployHash);
        
        if (transactionInfo.executionInfo) {
          const executionInfo = transactionInfo.executionInfo;
          const executionResult = executionInfo.executionResult;
          
          // Check if execution was successful (no error message means success)
          if (!executionResult.errorMessage) {
            logger.info(
              {
                transactionHash,
                deployHash,
                blockHash: executionInfo.blockHash.toHex(),
                blockHeight: executionInfo.blockHeight,
                cost: executionResult.cost,
                consumed: executionResult.consumed,
                limit: executionResult.limit,
              },
              '✅ Transaction executed successfully!'
            );
            return;
          } else {
            // Log full execution result for debugging
            logger.error(
              {
                transactionHash,
                deployHash,
                errorMessage: executionResult.errorMessage,
                cost: executionResult.cost,
                consumed: executionResult.consumed,
                limit: executionResult.limit,
                refund: executionResult.refund,
                transfers: executionResult.transfers,
                effectsCount: executionResult.effects?.length || 0,
                fullExecutionResult: JSON.stringify(executionResult, null, 2),
              },
              '❌ Transaction execution failed'
            );
            
            // Check if it's an unsupported chain error (error code 1)
            if (executionResult.errorMessage?.includes('UnsupportedChain') || 
                executionResult.errorMessage?.includes('[1]')) {
              logger.warn(
                'Chain might not be supported. You may need to call set_supported_chain first.'
              );
            }
            
            throw new Error(`Transaction failed: ${executionResult.errorMessage}`);
          }
        }
        
        attempts++;
        logger.debug({ attempt: attempts, maxAttempts }, 'Waiting for transaction execution...');
      } catch (error: any) {
        // If transaction not found yet, continue waiting
        if (error.message?.includes('not found') || error.message?.includes('404')) {
          attempts++;
          continue;
        }
        throw error;
      }
    }
    
    throw new Error('Timeout waiting for transaction execution');
  } catch (error) {
    logger.error({ error }, 'Failed to send message');
    throw error;
  }
}

// Run the test
if (require.main === module) {
  sendMessage()
    .then(() => {
      logger.info('Test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Test failed');
      process.exit(1);
    });
}

export { sendMessage };
