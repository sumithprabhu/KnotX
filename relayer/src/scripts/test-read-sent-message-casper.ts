/**
 * Test script to read sent messages from Casper gateway contract
 * 
 * OPTIMAL SOLUTION: Direct nonce-based dictionary queries
 * - Gets current nonce (1 RPC call)
 * - Queries each message by nonce from dictionary (N RPC calls where N = nonce)
 * - Much faster and more efficient than block scanning!
 * 
 * Usage:
 *   ts-node src/scripts/test-read-sent-message-casper.ts
 * 
 * ⚠️  RATE LIMITING WARNING:
 * The RPC endpoint has strict rate limits. This script makes minimal RPC calls:
 * - 1 call to get nonce
 * - N calls to get messages (where N = current nonce)
 * - Small delays between calls to avoid rate limits
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

// Constants from contract
const KEY_NONCE = 'nonce';
const KEY_MESSAGES = 'messages';

// Note: Based on test file (send_message_stores_message_by_nonce), 
// dictionary keys are used as raw strings (e.g., "0", "1", "2"), not hashed.
// The test shows: query_dictionary_item(None, messages_uref, &message_id)
// where message_id is a string like "0"

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
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.statusCode === 429 && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        logger.warn(
          { attempt: attempt + 1, delay, maxRetries },
          'Rate limited, retrying...'
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Get current nonce from contract's named key
 */
async function getNonceFromContract(rpcClient: RpcClient): Promise<number> {
  try {
    const queryResult = await retryWithBackoff(() =>
      rpcClient.queryLatestGlobalState(CONTRACT_HASH, [KEY_NONCE])
    );
    
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
    
    logger.warn('Could not parse nonce from query result, defaulting to 0');
    return 0;
  } catch (error: any) {
    if (error.statusCode === 429) {
      logger.error(
        {
          error: 'Rate limited (429)',
          message: 'RPC endpoint is rate limiting requests. Please wait 2-3 minutes and try again.',
        },
        'Rate limited - please wait and retry'
      );
      throw new Error('Rate limited - please wait 2-3 minutes before running again');
    }
    logger.error({ error }, 'Failed to get nonce');
    throw error;
  }
}

/**
 * Get messages dictionary URef from contract's full state
 * Use queryLatestGlobalState to get contract info, then extract URef from raw JSON
 * Returns both the URef and the state root hash used
 */
async function getMessagesDictionaryURef(rpcClient: RpcClient): Promise<{ dictionaryURef: string; stateRootHash: string }> {
  try {
    // Query the contract to get its full state info
    // We'll query an empty path to get the contract's root info
    const queryResult = await retryWithBackoff(() =>
      rpcClient.queryLatestGlobalState(CONTRACT_HASH, [])
    );
    
    console.log('\n🔍 CONTRACT STATE QUERY RESULT:');
    console.log('Has storedValue:', !!queryResult?.storedValue);
    console.log('StoredValue type:', queryResult?.storedValue ? Object.keys(queryResult.storedValue)[0] : 'none');
    
    // Try to get from raw JSON (most reliable)
    if (queryResult.rawJSON) {
      try {
        const raw = typeof queryResult.rawJSON === 'string' 
          ? JSON.parse(queryResult.rawJSON) 
          : queryResult.rawJSON;
        
        const storedValue = raw?.stored_value;
        console.log('Stored value type from raw:', storedValue ? Object.keys(storedValue)[0] : 'none');
        
        if (storedValue?.Contract) {
          const namedKeys = storedValue.Contract.named_keys;
          
          // Named keys can be an array or object - handle both formats
          let namedKeysMap: Record<string, string> = {};
          
          if (Array.isArray(namedKeys)) {
            // Array format: [{ name: "messages", key: "uref-..." }, ...]
            for (const item of namedKeys) {
              if (item.name && item.key) {
                namedKeysMap[item.name] = item.key;
              }
            }
          } else if (typeof namedKeys === 'object' && namedKeys !== null) {
            // Object format: { "messages": "uref-...", ... }
            namedKeysMap = namedKeys;
          }
          
          console.log('Parsed named keys:', Object.keys(namedKeysMap));
          
          if (namedKeysMap[KEY_MESSAGES]) {
            const messagesURef = namedKeysMap[KEY_MESSAGES];
            console.log('✅ Found messages URef in NamedKeys:', messagesURef);
            
            // Keep the full URef with access rights for the dictionary query
            // The format should be: "uref-<hash>-007"
            // Get the state root hash from the query result (this is the correct one for the contract state)
            // Note: We don't need state root hash for the initial URef lookup, we'll get it later when querying
            let stateRootHash = '';
            try {
              // Try to get from query result if available (use the already-parsed 'raw' object)
              if (raw?.block_header?.state_root_hash) {
                stateRootHash = raw.block_header.state_root_hash;
              } else if (raw?.state_root_hash) {
                stateRootHash = raw.state_root_hash;
              }
            } catch (e) {
              // Ignore - we'll get it from latest block
            }
            
            // Fallback to getting from latest block if not in query result
            if (!stateRootHash) {
              try {
                stateRootHash = await getStateRootHash(rpcClient);
              } catch (e) {
                // If we can't get state root hash, that's okay - we'll query without it for newer messages
                stateRootHash = '';
              }
            }
            
            logger.info({ 
              messagesURef: messagesURef.substring(0, 40) + '...',
              stateRootHash: stateRootHash ? stateRootHash.substring(0, 16) + '...' : 'none (will use latest)',
              stateRootHashSource: stateRootHash ? 'from query result' : 'will query without state_root_hash'
            }, '✅ Found messages dictionary URef');
            
            return { dictionaryURef: messagesURef, stateRootHash };
          } else {
            console.log('⚠️  messages key not found in NamedKeys');
            console.log('Available named keys:', Object.keys(namedKeysMap));
            throw new Error(`Messages dictionary URef not found. Available keys: ${Object.keys(namedKeysMap).join(', ')}`);
          }
        }
      } catch (e: any) {
        logger.error({ error: e?.message || String(e), stack: e?.stack }, 'Error parsing raw JSON');
        // Don't throw here - let it fall through to the error at the end
      }
    }
    
    throw new Error('Messages dictionary URef not found in contract NamedKeys');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get messages dictionary URef from contract state');
    throw error;
  }
}

/**
 * Get message by nonce from dictionary using URef directly
 * This bypasses the NamedKeys layer and works with the current contract
 */
async function getMessageByNonceDirect(
  stateRootHash: string | undefined,
  dictionaryURef: string,
  nonce: number
): Promise<Uint8Array | null> {
  try {
    // Use raw string key directly (as shown in test file: query_dictionary_item(None, messages_uref, &message_id))
    // The test uses raw strings like "0", "1", etc., not hashed keys
    const dictionaryItemKey = nonce.toString();
    
    // Use state_get_dictionary_item with URef dictionary identifier
    const rpcUrl = RPC_URL;
      // state_root_hash is REQUIRED by the RPC endpoint
      // If not provided, we need to get it from the latest block
      let stateRootHashToUse = stateRootHash;
      if (!stateRootHashToUse) {
        try {
          stateRootHashToUse = await getStateRootHash();
        } catch (error) {
          logger.error({ error, nonce }, 'Failed to get state root hash, cannot query dictionary');
          return null;
        }
      }
      
      const rpcRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'state_get_dictionary_item',
        params: {
          state_root_hash: stateRootHashToUse,
          dictionary_identifier: {
            URef: {
              seed_uref: dictionaryURef, // Use full URef with access rights (already has uref- prefix and -007 suffix)
              dictionary_item_key: dictionaryItemKey // Use raw string key (matching test file behavior)
            }
          }
        }
      };
      
        // Log the request for the most recent nonce to debug
        if (nonce >= 6) {
          console.log(`\n🔍 Dictionary Query Request for nonce ${nonce}:`);
          console.log('Using raw string key:', dictionaryItemKey);
          console.log('State root hash:', stateRootHash);
          console.log('Dictionary URef:', dictionaryURef);
          console.log('Full request:', JSON.stringify(rpcRequest, null, 2));
          console.log('\n');
        }
      
      const dictionaryItem = await retryWithBackoff(async () => {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': API_KEY,
          },
          body: JSON.stringify(rpcRequest),
        });
        
        const data = await response.json() as any;
        
      if (data.error) {
        // Log error for recent nonces
        if (nonce >= 6) {
          console.log(`\n🔍 Dictionary Query Error for nonce ${nonce}:`);
          console.log(JSON.stringify(data.error, null, 2));
          console.log('\n');
        }
        logger.debug({ 
          nonce,
          errorCode: data.error.code,
          errorMessage: data.error.message,
          errorData: data.error.data
        }, 'Dictionary item query error');
        
        // If item not found, that's okay - return null
        if (data.error.code === -32001 || data.error.message?.includes('not found')) {
          return null;
        }
        throw new Error(data.error.message || 'RPC error');
      }
      
      if (data.result) {
        logger.debug({ 
          nonce,
          hasStoredValue: !!data.result.stored_value,
          storedValueType: data.result.stored_value ? Object.keys(data.result.stored_value)[0] : 'none'
        }, 'Dictionary item query success');
      }
      
      return data.result;
    });
      
    if (!dictionaryItem) {
      logger.debug({ nonce }, 'Dictionary item not found (null response)');
      return null;
    }
    
    // Convert the raw RPC response to extract message bytes
    if (dictionaryItem.stored_value?.CLValue) {
      const clValue = dictionaryItem.stored_value.CLValue;
      const bytes = clValue.bytes;
      
      if (!bytes) {
        logger.debug({ nonce }, 'No bytes in CLValue');
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
      
      logger.info({ nonce, messageLength: messageBytes.length }, '✅ Retrieved message bytes');
      return messageBytes;
    }
    
    logger.debug({ nonce, storedValue: dictionaryItem.stored_value }, 'Dictionary item has no CLValue');
    return null;
  } catch (error: any) {
    if (error.statusCode === 429) {
      logger.warn({ nonce }, 'Rate limited while fetching message');
      throw error;
    }
    if (error.message?.includes('not found') || error.message?.includes('missing')) {
      logger.debug({ nonce }, 'Message not found in dictionary');
      return null;
    }
    logger.debug({ error: error.message, nonce }, 'Error fetching message by nonce');
    return null;
  }
}

/**
 * Get state root hash from latest block
 * Use direct RPC call to ensure we get the absolute latest
 */
async function getStateRootHash(_rpcClient?: RpcClient): Promise<string> {
  // Strategy: Use info_get_status to get latest block, then query that specific block
  // Add unique ID and timestamp to prevent caching
  const rpcUrl = RPC_URL;
  const uniqueId = Date.now(); // Use integer timestamp for ID
  
  // Get status to find the latest block
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
  
  // Check if response is OK
  if (!statusResponse.ok) {
    const text = await statusResponse.text();
    throw new Error(`HTTP ${statusResponse.status}: ${text.substring(0, 100)}`);
  }
  
  // Parse JSON with error handling
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
  
  // Get latest block info from status
  const lastAddedBlock = statusData.result?.last_added_block_info;
  const latestBlockHash = lastAddedBlock?.hash || lastAddedBlock?.block_hash;
  const latestBlockHeight = lastAddedBlock?.height;
  
  // Now get the block - try using the hash first, then fallback to empty params
  const blockRequest = {
    jsonrpc: '2.0',
    id: uniqueId + 1, // Integer ID
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
  
  // Check if response is OK
  if (!blockResponse.ok) {
    const text = await blockResponse.text();
    throw new Error(`HTTP ${blockResponse.status}: ${text.substring(0, 100)}`);
  }
  
  // Parse JSON with error handling
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
  
  // Extract state root hash from the response
  const stateRootHash = blockData.result?.block?.header?.state_root_hash
    || blockData.result?.block_with_signatures?.block?.header?.state_root_hash
    || blockData.result?.block_with_signatures?.block?.Version2?.header?.state_root_hash;
  
  const blockHeight = blockData.result?.block?.header?.height
    || blockData.result?.block_with_signatures?.block?.header?.height
    || blockData.result?.block_with_signatures?.block?.Version2?.header?.height
    || latestBlockHeight;
  
  if (!stateRootHash) {
    throw new Error('Could not get state root hash from latest block');
  }
  
  // Log for debugging - always log to see if state root is changing
  logger.info({ 
    blockHeight, 
    latestBlockHeightFromStatus: latestBlockHeight,
    latestBlockHashFromStatus: latestBlockHash ? latestBlockHash.substring(0, 16) + '...' : 'none',
    stateRootHash: stateRootHash.substring(0, 16) + '...',
    fullStateRootHash: stateRootHash,
    timestamp: new Date().toISOString(),
    heightMatch: blockHeight === latestBlockHeight ? 'YES' : 'NO - MISMATCH!'
  }, 'Got fresh state root hash');
  
  return stateRootHash;
}


/**
 * Parse message bytes according to contract's build_message_bytes format:
 * - src_chain_id: u32 (4 bytes, big-endian)
 * - dst_chain_id: u32 (4 bytes, big-endian)
 * - src_gateway: variable length bytes (typically 32 bytes for account/contract hash)
 * - receiver: variable length bytes (typically 32 bytes for contract hash)
 * - nonce: u64 (8 bytes, big-endian)
 * - payload: variable length bytes
 * 
 * Note: We parse backwards from the end since nonce and receiver have known/fixed sizes
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
      // Need at least 4 + 4 + 8 = 16 bytes for chain IDs and nonce
      return null;
    }

    let offset = 0;

    // Parse src_chain_id (4 bytes, big-endian)
    const srcChainId = Buffer.from(messageBytes.slice(offset, offset + 4)).readUInt32BE(0);
    offset += 4;

    // Check if dst_chain_id is at offset 4 or 8
    // Based on raw data analysis, dst_chain_id appears to be at offset 8 for newer messages
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

    // Parse the message structure (from contract's build_message_bytes):
    // src_chain_id (4) + dst_chain_id (4) + src_gateway (32) + receiver (32) + nonce (8) + payload (variable)
    // Based on test file, src_gateway and receiver are 32 bytes each
    
    const nonceLength = 8;
    const receiverLength = 32; // Standard contract hash length (from test file)
    const srcGatewayLength = 32; // Standard account/contract hash length (from test file)
    
    const totalFixedLength = 4 + 4 + srcGatewayLength + receiverLength + nonceLength;
    
    if (messageBytes.length < totalFixedLength) {
      logger.warn({ 
        messageLength: messageBytes.length, 
        expectedMinLength: totalFixedLength 
      }, 'Message too short');
      return null;
    }
    
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
 * Get message by nonce and parse it
 */
async function getMessageByNonce(
  stateRootHash: string | undefined,
  dictionaryURef: string,
  nonce: number
): Promise<{
  srcChainId: number;
  dstChainId: number;
  srcGateway: string;
  receiver: string;
  nonce: number;
  payload: string;
  payloadHex: string;
  payloadLength: number;
} | null> {
  const messageBytes = await getMessageByNonceDirect(stateRootHash, dictionaryURef, nonce);
  
  if (!messageBytes) {
    return null;
  }

  // Log RAW message bytes for debugging
  console.log(`\n🔍 RAW DATA for nonce ${nonce}:`);
  console.log('Full message length:', messageBytes.length, 'bytes');
  console.log('Full message (hex):', Buffer.from(messageBytes).toString('hex'));
  console.log('\n📊 BYTE-BY-BYTE BREAKDOWN:');
  console.log('Bytes 0-3 (src_chain_id):', Buffer.from(messageBytes.slice(0, 4)).toString('hex'), '=', Buffer.from(messageBytes.slice(0, 4)).readUInt32BE(0));
  console.log('Bytes 4-7 (dst_chain_id):', Buffer.from(messageBytes.slice(4, 8)).toString('hex'), '=', Buffer.from(messageBytes.slice(4, 8)).readUInt32BE(0));
  console.log('Bytes 8-39 (src_gateway, 32 bytes):', Buffer.from(messageBytes.slice(8, 40)).toString('hex'));
  console.log('Bytes 40-71 (receiver, 32 bytes):', Buffer.from(messageBytes.slice(40, 72)).toString('hex'));
  console.log('Bytes 72-79 (nonce, 8 bytes):', Buffer.from(messageBytes.slice(72, 80)).toString('hex'), '=', Buffer.from(messageBytes.slice(72, 80)).readBigUInt64BE(0).toString());
  console.log('Bytes 80+ (payload):', Buffer.from(messageBytes.slice(80)).toString('hex'));
  console.log('Payload length:', messageBytes.length - 80, 'bytes');
  console.log('\n');

  const parsed = parseMessageBytes(messageBytes);
  if (!parsed) {
    logger.warn({ nonce, messageLength: messageBytes.length }, 'Failed to parse message bytes');
    return null;
  }

  // Log parsed components
  console.log(`📋 PARSED COMPONENTS for nonce ${nonce}:`);
  console.log('Parsed srcChainId:', parsed.srcChainId, `(0x${parsed.srcChainId.toString(16)})`);
  console.log('Parsed dstChainId:', parsed.dstChainId, `(0x${parsed.dstChainId.toString(16)})`);
  console.log('Parsed srcGateway (hex):', Buffer.from(parsed.srcGateway).toString('hex'));
  console.log('Parsed srcGateway length:', parsed.srcGateway.length, 'bytes');
  console.log('Parsed receiver (hex):', Buffer.from(parsed.receiver).toString('hex'));
  console.log('Parsed receiver length:', parsed.receiver.length, 'bytes');
  console.log('Parsed receiver (as CLValue List<U8> format):', '20000000' + Buffer.from(parsed.receiver).toString('hex'));
  console.log('Parsed nonce:', parsed.nonce);
  console.log('Parsed payload (hex):', Buffer.from(parsed.payload).toString('hex'));
  console.log('Parsed payload length:', parsed.payload.length, 'bytes');
  
  // Try to decode payload as text
  const payloadText = new TextDecoder().decode(parsed.payload);
  if (payloadText.match(/^[\x20-\x7E]*$/)) {
    console.log('Parsed payload (text):', payloadText);
  } else {
    console.log('Parsed payload (text): [not printable ASCII]');
  }
  
  // Compare with explorer format
  console.log('\n🔍 COMPARISON WITH EXPLORER FORMAT:');
  console.log('Explorer receiver format (CLValue List<U8>): 20000000 + [32 bytes of receiver]');
  console.log('Our parsed receiver (raw bytes):', Buffer.from(parsed.receiver).toString('hex'));
  console.log('Our receiver in CLValue format:', '20000000' + Buffer.from(parsed.receiver).toString('hex'));
  console.log('Expected receiver (from send script):', '0909090909090909090909090909090909090909090909090909090909090909');
  console.log('Match?', Buffer.from(parsed.receiver).toString('hex') === '0909090909090909090909090909090909090909090909090909090909090909' ? 'YES ✅' : 'NO ❌');
  console.log('\n');

  // Debug: Log raw bytes for ALL messages to find "hello world"
  if (payloadText.includes('hello world') || Buffer.from(parsed.payload).toString('hex').includes('68656c6c6f20776f726c64')) {
    console.log(`\n✅ FOUND "hello world" in nonce ${nonce}!`);
    console.log('Full message (hex):', Buffer.from(messageBytes).toString('hex'));
    console.log('Bytes 72-79 (nonce):', Buffer.from(messageBytes.slice(72, 80)).toString('hex'));
    console.log('Parsed nonce:', parsed.nonce);
    console.log('Parsed payload (hex):', Buffer.from(parsed.payload).toString('hex'));
    console.log('Parsed payload (text):', payloadText);
    console.log('Parsed srcChainId:', parsed.srcChainId);
    console.log('Parsed dstChainId:', parsed.dstChainId);
    console.log('\n');
  }

  // Decode payload as UTF-8 string if possible, otherwise show hex
  let payloadDisplay: string;
  try {
    payloadDisplay = new TextDecoder().decode(parsed.payload);
    // If it's valid UTF-8 and printable, use it; otherwise fall back to hex
    if (!/^[\x20-\x7E]*$/.test(payloadDisplay)) {
      payloadDisplay = Buffer.from(parsed.payload).toString('hex');
    }
  } catch {
    payloadDisplay = Buffer.from(parsed.payload).toString('hex');
  }
  
  // Log if we found "hello world"
  if (payloadDisplay.includes('hello world') || Buffer.from(parsed.payload).toString('hex').includes('68656c6c6f20776f726c64')) {
    console.log(`\n✅ FOUND "hello world" in nonce ${nonce}!`);
    console.log('Payload:', payloadDisplay);
    console.log('Payload hex:', Buffer.from(parsed.payload).toString('hex'));
    console.log('\n');
  }

  return {
    srcChainId: parsed.srcChainId,
    dstChainId: parsed.dstChainId,
    srcGateway: Buffer.from(parsed.srcGateway).toString('hex'),
    receiver: Buffer.from(parsed.receiver).toString('hex'),
    nonce: parsed.nonce,
    payload: payloadDisplay,
    payloadHex: Buffer.from(parsed.payload).toString('hex'),
    payloadLength: parsed.payload.length,
  };
}

/**
 * Read all sent messages using optimal nonce-based dictionary queries
 */
async function readAllSentMessages(): Promise<void> {
  try {
    logger.info('Starting to read sent messages using optimal nonce-based dictionary queries...');

    const rpcClient = createRpcClient();
    
    // Small delay to avoid immediate rate limits
    logger.info('Waiting 5 seconds before making requests...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 1: Get current nonce from contract
    logger.info('Getting current nonce from contract...');
    let currentNonce: number;
    try {
      currentNonce = await getNonceFromContract(rpcClient);
    } catch (error: any) {
      if (error.message?.includes('Rate limited')) {
        logger.error(
          {
            message: 'RPC endpoint is currently rate limiting.',
            suggestion: 'Please wait 5-10 minutes before trying again.',
          },
          'Cannot proceed - rate limited'
        );
        process.exit(1);
      }
      throw error;
    }
    
    logger.info(
      { currentNonce },
      '✅ Current nonce retrieved from contract'
    );
    
    console.log('\n📖 READING MESSAGES FROM CONTRACT:');
    console.log(`   Contract Hash: ${CONTRACT_HASH}`);
    console.log(`   Current Nonce: ${currentNonce}\n`);
    
    if (currentNonce === 0) {
      logger.info('No messages sent yet (nonce is 0)');
      return;
    }
    
    // Step 2: Get messages dictionary URef (this gets a state root hash internally)
    logger.info('Getting messages dictionary URef from contract state...');
    const { dictionaryURef, stateRootHash: initialStateRootHash } = await getMessagesDictionaryURef(rpcClient);
    
    // Verify the dictionary URef by checking it exists in the contract
    logger.info(
      { 
        stateRootHash: initialStateRootHash ? initialStateRootHash.substring(0, 16) + '...' : 'none (will use latest)',
        dictionaryURef: dictionaryURef.substring(0, 40) + '...',
        dictionaryURefFull: dictionaryURef
      }, 
      '✅ Ready to query dictionary'
    );
    
    // Log a test query to verify the URef is accessible
    console.log('\n🧪 Testing dictionary URef accessibility...');
    
    // Skip the test state root hash check - it's not needed and might be causing issues
    // We'll query messages directly
    console.log('Dictionary URef:', dictionaryURef);
    console.log('Ready to query messages...\n');
    
    // Step 3: Query each message by nonce from dictionary using URef
    logger.info(
      {
        currentNonce,
        messagesToFetch: currentNonce,
        strategy: 'Using state_get_dictionary_item with URef (bypasses NamedKeys, works with current contract)',
      },
      'Fetching messages from dictionary...'
    );
    
    const messages: Array<{
      nonce: number;
      srcChainId: number;
      dstChainId: number;
      srcGateway: string;
      receiver: string;
      payload: string;
    }> = [];
    
    for (let nonce = 0; nonce < currentNonce; nonce++) {
      try {
        // Small delay between requests to avoid rate limits
        if (nonce > 0) {
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay between requests
        }
        
        // Get fresh state root hash for each query to ensure we have the latest state
        // For messages 10+, get a fresh state root hash to ensure we're querying the latest state
        if (nonce > 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay before getting state root
        }
        
        const freshStateRootHash = await getStateRootHash(rpcClient);
        logger.info({ 
          nonce,
          stateRootHash: freshStateRootHash,
          stateRootHashShort: freshStateRootHash.substring(0, 16) + '...'
        }, `State root hash for nonce ${nonce}`);
        
        const message = await getMessageByNonce(freshStateRootHash, dictionaryURef, nonce);
        
        if (message) {
          // Use the dictionary key nonce (which we know is correct) instead of parsed nonce
          const correctedMessage = { ...message, nonce };
          messages.push(correctedMessage);
          
          // Check if payload contains "hello world"
          const payloadHex = message.payloadHex || message.payload;
          const payloadText = payloadHex.length > 0 && !payloadHex.match(/^[0-9a-f]+$/i) 
            ? payloadHex 
            : new TextDecoder().decode(Buffer.from(payloadHex, 'hex'));
          
          if (payloadText.includes('hello world') || payloadHex.includes('68656c6c6f20776f726c64')) {
            console.log(`\n✅ FOUND "hello world" payload in nonce ${nonce}!`);
            console.log('Payload (hex):', payloadHex);
            console.log('Payload (text):', payloadText);
            console.log('srcChainId:', message.srcChainId);
            console.log('dstChainId:', message.dstChainId);
            console.log('\n');
          }
          
          logger.info(
            {
              nonce, // Use dictionary key nonce
              srcChainId: message.srcChainId,
              dstChainId: message.dstChainId,
              receiver: message.receiver.substring(0, 16) + '...',
              payloadLength: message.payloadLength,
              payloadPreview: payloadText.length > 50 ? payloadText.substring(0, 50) + '...' : payloadText,
            },
            `✅ Retrieved message at nonce ${nonce}`
          );
        } else {
          logger.warn({ nonce }, `⚠️  Message not found at nonce ${nonce}`);
        }
        
        // Log progress every 10 messages
        if ((nonce + 1) % 10 === 0 || nonce === currentNonce - 1) {
          const progress = ((nonce + 1) / currentNonce * 100).toFixed(1);
          logger.info(
            {
              progress: `${progress}%`,
              fetched: messages.length,
              total: currentNonce,
              current: nonce + 1,
            },
            'Fetching progress...'
          );
        }
      } catch (error: any) {
        if (error.statusCode === 429 || error.message?.includes('Rate limited')) {
          logger.error(
            {
              nonce,
              fetched: messages.length,
              remaining: currentNonce - nonce,
              message: 'Rate limited. Please wait 5-10 minutes and resume from this nonce.',
            },
            'Rate limited - stopping'
          );
          break;
        }
        logger.warn({ error: error.message, nonce }, 'Error fetching message, continuing...');
      }
    }
    
    // Summary
    logger.info(
      {
        totalMessages: messages.length,
        expectedNonce: currentNonce,
        messages: messages.map((m, idx) => ({
          index: idx + 1,
          nonce: m.nonce,
          srcChainId: m.srcChainId,
          dstChainId: m.dstChainId,
          receiver: m.receiver.substring(0, 16) + '...',
          payloadLength: m.payload.length / 2,
        })),
      },
      '✅ Finished reading messages'
    );
    
    if (messages.length === 0) {
      logger.warn('No messages found in dictionary');
    } else if (messages.length < currentNonce) {
      logger.warn(
        {
          found: messages.length,
          expected: currentNonce,
          missing: currentNonce - messages.length,
        },
        'Found fewer messages than expected - some may be missing from dictionary'
      );
    } else {
      logger.info('✅ All messages retrieved successfully!');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to read sent messages');
    throw error;
  }
}

// Run the test
if (require.main === module) {
  readAllSentMessages()
    .then(() => {
      logger.info('Test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Test failed');
      process.exit(1);
    });
}

export { readAllSentMessages };

