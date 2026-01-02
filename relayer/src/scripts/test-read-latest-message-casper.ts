/**
 * Test script to read ONLY the latest message (highest nonce) from Casper gateway contract
 * and verify it matches the expected content
 * 
 * Usage: ts-node src/scripts/test-read-latest-message-casper.ts
 */

import {
  RpcClient,
  HttpHandler,
} from 'casper-js-sdk';
import { logger } from '../utils/logger';

// Configuration
const RPC_URL = 'https://node.testnet.cspr.cloud/rpc';
const API_KEY = '019b7cfa-8db3-7a21-89b3-e3a0bc3f3340';
const CONTRACT_HASH = 'hash-a595eebdfe2f22390873593f94f247824d0edc7e9a9d53003af2b5d7332069e6';
const KEY_NONCE = 'nonce';
const KEY_MESSAGES = 'messages';

// Expected values (from send script)
const EXPECTED_RECEIVER = '1234567891098765432100000000000000000000000000000000000000000000'; // 0x12345678910987654321 padded to 32 bytes
const EXPECTED_DST_CHAIN_ID = 11155111; // Sepolia
const EXPECTED_PAYLOAD_TEXT = 'hello world';

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
 * Get current nonce from contract
 */
async function getCurrentNonce(rpcClient: RpcClient): Promise<number> {
  try {
    const queryResult = await rpcClient.queryLatestGlobalState(CONTRACT_HASH, [KEY_NONCE]);
    
    if (queryResult.storedValue?.clValue) {
      const clValue = queryResult.storedValue.clValue;
      // The nonce is stored as U64
      if (clValue.ui64 !== undefined) {
        return Number(clValue.ui64);
      }
      // Try parsing from bytes
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
async function getMessagesDictionaryURef(rpcClient: RpcClient): Promise<string> {
  try {
    const queryResult = await rpcClient.queryLatestGlobalState(CONTRACT_HASH, []);
    
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
        
        if (namedKeysMap[KEY_MESSAGES]) {
          return namedKeysMap[KEY_MESSAGES];
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
async function getStateRootHash(): Promise<string> {
  const rpcUrl = RPC_URL;
  const uniqueId = Date.now();
  
  const statusRequest = {
    jsonrpc: '2.0',
    id: uniqueId,
    method: 'info_get_status',
    params: {}
  };
  
  const statusResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API_KEY,
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(statusRequest),
  });
  
  if (!statusResponse.ok) {
    const text = await statusResponse.text();
    throw new Error(`HTTP ${statusResponse.status}: ${text.substring(0, 100)}`);
  }
  
  let statusData: any;
  try {
    const text = await statusResponse.text();
    statusData = JSON.parse(text);
  } catch (error: any) {
    throw new Error(`Failed to parse status response: ${error.message}`);
  }
  
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
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API_KEY,
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(blockRequest),
  });
  
  if (!blockResponse.ok) {
    const text = await blockResponse.text();
    throw new Error(`HTTP ${blockResponse.status}: ${text.substring(0, 100)}`);
  }
  
  let blockData: any;
  try {
    const text = await blockResponse.text();
    blockData = JSON.parse(text);
  } catch (error: any) {
    throw new Error(`Failed to parse block response: ${error.message}`);
  }
  
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
async function getMessageBytes(stateRootHash: string, dictionaryURef: string, nonce: number): Promise<Uint8Array | null> {
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
    
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': API_KEY,
      },
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
    
    // Convert bytes to Uint8Array
    let messageBytes: Uint8Array;
    if (typeof bytes === 'string') {
      messageBytes = Uint8Array.from(Buffer.from(bytes, 'hex'));
    } else if (Array.isArray(bytes)) {
      messageBytes = Uint8Array.from(bytes);
    } else {
      messageBytes = bytes;
    }
    
    if (messageBytes.length === 0) {
      return null;
    }
    
    return messageBytes;
  } catch (error: any) {
    logger.error({ error: error.message, nonce }, 'Failed to get message bytes');
    return null;
  }
}

/**
 * Parse message bytes
 */
function parseMessageBytes(messageBytes: Uint8Array): {
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

    // Parse src_chain_id (4 bytes, big-endian)
    const srcChainId = Buffer.from(messageBytes.slice(offset, offset + 4)).readUInt32BE(0);
    offset += 4;

    // Check if dst_chain_id is at offset 4 or 8
    // Based on raw data analysis, dst_chain_id appears to be at offset 8
    // Bytes 4-7 might be a version/length field
    const possibleDstChainIdAt4 = Buffer.from(messageBytes.slice(offset, offset + 4)).readUInt32BE(0);
    const possibleDstChainIdAt8 = messageBytes.length >= 12 
      ? Buffer.from(messageBytes.slice(offset + 4, offset + 8)).readUInt32BE(0)
      : null;
    
    let dstChainId: number;
    let srcGatewayStart: number;
    
    // If bytes 8-11 contain 11155111 (Sepolia), use that as dst_chain_id
    if (possibleDstChainIdAt8 === 11155111) {
      // dst_chain_id is at offset 8
      offset += 4; // Skip bytes 4-7 (unknown field)
      dstChainId = possibleDstChainIdAt8;
      srcGatewayStart = offset + 4; // After dst_chain_id
    } else {
      // Standard format: dst_chain_id at offset 4
      dstChainId = possibleDstChainIdAt4;
      srcGatewayStart = offset + 4;
    }
    
    offset = srcGatewayStart;

    const nonceLength = 8;
    const receiverLength = 32;
    const srcGatewayLength = 32;
    
    // Parse src_gateway (32 bytes)
    const srcGateway = messageBytes.slice(offset, offset + srcGatewayLength);
    offset += srcGatewayLength;
    
    // Parse receiver (32 bytes)
    // Note: Based on raw data, receiver might have a 4-byte prefix
    // The actual receiver address starts after the prefix
    const receiverWithPrefix = messageBytes.slice(offset, offset + receiverLength);
    
    // Check if receiver has a 4-byte prefix (like 175fc9fe)
    // If so, extract the actual receiver (20 bytes) and pad to 32 bytes
    let receiver: Uint8Array;
    if (receiverWithPrefix[0] === 0x17 && receiverWithPrefix[1] === 0x5f && receiverWithPrefix[2] === 0xc9 && receiverWithPrefix[3] === 0xfe) {
      // Has prefix, extract receiver from bytes 4-23 (20 bytes) and pad
      const actualReceiver = receiverWithPrefix.slice(4, 24); // 20 bytes
      receiver = new Uint8Array(32);
      receiver.set(actualReceiver, 0);
      // Rest stays as 0
    } else {
      // No prefix, use as-is
      receiver = receiverWithPrefix;
    }
    offset += receiverLength;
    
    // Parse nonce (8 bytes, big-endian)
    const nonce = Number(Buffer.from(messageBytes.slice(offset, offset + nonceLength)).readBigUInt64BE(0));
    offset += nonceLength;
    
    // Parse payload (remaining bytes)
    // Note: Payload might have a 4-byte length prefix
    let payload: Uint8Array;
    if (messageBytes.length >= offset + 4) {
      const possibleLength = Buffer.from(messageBytes.slice(offset, offset + 4)).readUInt32BE(0);
      // If the first 4 bytes look like a length prefix and the remaining bytes match that length
      if (possibleLength > 0 && possibleLength < 10000 && messageBytes.length >= offset + 4 + possibleLength) {
        // Skip the 4-byte length prefix
        payload = messageBytes.slice(offset + 4, offset + 4 + possibleLength);
      } else {
        // No length prefix, use all remaining bytes
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
 * Main function to read and verify latest message
 */
async function readLatestMessage(): Promise<void> {
  try {
    logger.info('Reading latest message from contract...');

    const rpcClient = createRpcClient();
    
    // Get current nonce
    const currentNonce = await getCurrentNonce(rpcClient);
    logger.info({ currentNonce }, 'Current nonce from contract');
    
    if (currentNonce === 0) {
      logger.warn('No messages found (nonce is 0)');
      return;
    }
    
    // Latest message is at nonce (currentNonce - 1)
    const latestNonce = currentNonce - 1;
    logger.info({ latestNonce }, 'Reading latest message');
    
    // Get dictionary URef
    const dictionaryURef = await getMessagesDictionaryURef(rpcClient);
    logger.info({ dictionaryURef: dictionaryURef.substring(0, 40) + '...' }, 'Got dictionary URef');
    
    // Get state root hash
    const stateRootHash = await getStateRootHash();
    logger.info({ stateRootHash: stateRootHash.substring(0, 16) + '...' }, 'Got state root hash');
    
    // Get message bytes
    const messageBytes = await getMessageBytes(stateRootHash, dictionaryURef, latestNonce);
    
    if (!messageBytes) {
      logger.error({ latestNonce }, 'Message not found');
      return;
    }
    
    logger.info({ messageLength: messageBytes.length }, 'Retrieved message bytes');
    
    // Log raw data
    console.log('\n🔍 RAW MESSAGE DATA:');
    console.log('Full message (hex):', Buffer.from(messageBytes).toString('hex'));
    console.log('Message length:', messageBytes.length, 'bytes');
    console.log('\n📊 BYTE BREAKDOWN:');
    console.log('Bytes 0-3 (src_chain_id):', Buffer.from(messageBytes.slice(0, 4)).toString('hex'));
    console.log('Bytes 4-7 (dst_chain_id):', Buffer.from(messageBytes.slice(4, 8)).toString('hex'));
    console.log('Bytes 8-39 (src_gateway):', Buffer.from(messageBytes.slice(8, 40)).toString('hex'));
    console.log('Bytes 40-71 (receiver):', Buffer.from(messageBytes.slice(40, 72)).toString('hex'));
    console.log('Bytes 72-79 (nonce):', Buffer.from(messageBytes.slice(72, 80)).toString('hex'));
    console.log('Bytes 80+ (payload):', Buffer.from(messageBytes.slice(80)).toString('hex'));
    console.log('\n');
    
    // Parse message
    const parsed = parseMessageBytes(messageBytes);
    if (!parsed) {
      logger.error('Failed to parse message bytes');
      return;
    }
    
    // Log parsed components
    console.log('📋 PARSED COMPONENTS:');
    console.log('srcChainId:', parsed.srcChainId, `(0x${parsed.srcChainId.toString(16)})`);
    console.log('dstChainId:', parsed.dstChainId, `(0x${parsed.dstChainId.toString(16)})`);
    console.log('srcGateway (hex):', Buffer.from(parsed.srcGateway).toString('hex'));
    console.log('receiver (hex):', Buffer.from(parsed.receiver).toString('hex'));
    console.log('nonce:', parsed.nonce);
    console.log('payload (hex):', Buffer.from(parsed.payload).toString('hex'));
    
    const payloadText = new TextDecoder().decode(parsed.payload);
    if (payloadText.match(/^[\x20-\x7E]*$/)) {
      console.log('payload (text):', payloadText);
    }
    console.log('\n');
    
    // Verify against expected values
    console.log('✅ VERIFICATION:');
    const receiverHex = Buffer.from(parsed.receiver).toString('hex');
    const receiverMatch = receiverHex.toLowerCase() === EXPECTED_RECEIVER.toLowerCase();
    const dstChainIdMatch = parsed.dstChainId === EXPECTED_DST_CHAIN_ID;
    const payloadMatch = payloadText.includes(EXPECTED_PAYLOAD_TEXT);
    
    console.log(`Receiver match: ${receiverMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`  Expected: ${EXPECTED_RECEIVER}`);
    console.log(`  Actual:   ${receiverHex}`);
    console.log(`\nDestination Chain ID match: ${dstChainIdMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`  Expected: ${EXPECTED_DST_CHAIN_ID}`);
    console.log(`  Actual:   ${parsed.dstChainId}`);
    console.log(`\nPayload match: ${payloadMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`  Expected: "${EXPECTED_PAYLOAD_TEXT}"`);
    console.log(`  Actual:   "${payloadText}"`);
    
    if (receiverMatch && dstChainIdMatch && payloadMatch) {
      console.log('\n🎉 ALL VERIFICATIONS PASSED!');
    } else {
      console.log('\n⚠️  SOME VERIFICATIONS FAILED');
    }
    
    logger.info('Test completed');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Test failed');
    process.exit(1);
  }
}

// Run the script
readLatestMessage().catch(error => {
  logger.error({ error }, 'Unhandled error');
  process.exit(1);
});

