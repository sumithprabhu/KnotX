/**
 * Script to read the counter value from Casper receiver contract
 * 
 * Usage: ts-node src/scripts/read-counter-casper.ts
 */

import {
  RpcClient,
  HttpHandler,
} from 'casper-js-sdk';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// Configuration
const RPC_URL = env.CASPER_TESTNET_RPC_URL || 'https://node.testnet.cspr.cloud/rpc';
const API_KEY = env.CASPER_API_KEY || '019b7cfa-8db3-7a21-89b3-e3a0bc3f3340';
const CONTRACT_HASH = 'hash-2ede3272d048e81c344c68f65db55141e1132d70da6443770ac0de443534d36e';
const KEY_COUNTER = 'count'; // Named key in the receiver contract

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
 * Get counter value from contract
 */
async function getCounter(rpcClient: RpcClient): Promise<number> {
  try {
    logger.info(
      { contractHash: CONTRACT_HASH, key: KEY_COUNTER },
      'Querying counter from contract...'
    );

    const queryResult = await rpcClient.queryLatestGlobalState(CONTRACT_HASH, [KEY_COUNTER]);
    
    if (queryResult.storedValue?.clValue) {
      const clValue = queryResult.storedValue.clValue;
      
      // The counter is stored as U64
      if (clValue.ui64 !== undefined) {
        const counter = Number(clValue.ui64);
        logger.info(
          { counter, contractHash: CONTRACT_HASH },
          '✅ Counter value retrieved'
        );
        return counter;
      }
      
      // Try parsing from bytes
      const bytes = clValue.bytes();
      if (bytes && bytes.length >= 8) {
        const counter = Number(Buffer.from(bytes).readBigUInt64BE(0));
        logger.info(
          { counter, contractHash: CONTRACT_HASH },
          '✅ Counter value retrieved (from bytes)'
        );
        return counter;
      }
    }
    
    // Try raw JSON parsing
    if (queryResult.rawJSON) {
      const raw = typeof queryResult.rawJSON === 'string' 
        ? JSON.parse(queryResult.rawJSON) 
        : queryResult.rawJSON;
      
      const storedValue = raw?.stored_value;
      if (storedValue?.CLValue) {
        const clValue = storedValue.CLValue;
        const bytes = clValue.bytes;
        
        if (bytes && typeof bytes === 'string') {
          const bytesBuffer = Buffer.from(bytes, 'hex');
          if (bytesBuffer.length >= 8) {
            const counter = Number(bytesBuffer.readBigUInt64BE(0));
            logger.info(
              { counter, contractHash: CONTRACT_HASH },
              '✅ Counter value retrieved (from raw JSON)'
            );
            return counter;
          }
        } else if (Array.isArray(bytes)) {
          const bytesBuffer = Buffer.from(bytes);
          if (bytesBuffer.length >= 8) {
            const counter = Number(bytesBuffer.readBigUInt64BE(0));
            logger.info(
              { counter, contractHash: CONTRACT_HASH },
              '✅ Counter value retrieved (from raw JSON array)'
            );
            return counter;
          }
        }
      }
    }
    
    throw new Error('Counter not found in contract state');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get counter');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    logger.info('🔍 Starting counter read script...');
    
    const rpcClient = createRpcClient();
    const counter = await getCounter(rpcClient);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 COUNTER VALUE');
    console.log('='.repeat(60));
    console.log(`Contract: ${CONTRACT_HASH}`);
    console.log(`Counter:  ${counter}`);
    console.log('='.repeat(60) + '\n');
    
    logger.info({ counter }, '✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Script failed');
    process.exit(1);
  }
}

// Run the script
main();
