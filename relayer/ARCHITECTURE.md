# Relayer Architecture

## Overview

The relayer is a cross-chain message relay system that listens to gateway contracts on multiple blockchains and executes messages on destination chains. It currently supports **Casper Testnet** and **Ethereum Sepolia**.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Application                          │
│  Sends message via gateway contract (Casper or Sepolia)         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway Contracts                           │
│  ┌──────────────┐              ┌──────────────┐                 │
│  │ Casper       │              │ Sepolia      │                 │
│  │ Gateway      │              │ Gateway      │                 │
│  │ Contract     │              │ Contract     │                 │
│  └──────┬───────┘              └──────┬───────┘                 │
│         │                              │                          │
│         │ Stores in dictionary        │ Emits MessageSent event │
│         │ (keyed by nonce)            │                          │
└─────────┼──────────────────────────────┼──────────────────────────┘
          │                              │
          ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Relayer Service                         │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────┐         │
│  │  Casper Listener     │    │  Sepolia Listener    │         │
│  │  (Nonce Polling)     │    │  (WebSocket Events)  │         │
│  │                      │    │                      │         │
│  │  • Polls every 1 min │    │  • Real-time events  │         │
│  │  • Checks nonce > DB │    │  • WebSocket conn    │         │
│  │  • Fetches messages  │    │  • Auto-reconnect    │         │
│  └──────────┬───────────┘    └──────────┬───────────┘         │
│             │                            │                      │
│             └────────────┬───────────────┘                      │
│                          ▼                                      │
│              ┌──────────────────────┐                           │
│              │   Message Router     │                           │
│              │  (Route to executor) │                           │
│              └──────────┬───────────┘                           │
│                         │                                       │
│         ┌────────────────┴────────────────┐                    │
│         ▼                                  ▼                     │
│  ┌──────────────┐                  ┌──────────────┐            │
│  │   Casper     │                  │   Sepolia    │            │
│  │   Executor   │                  │   Executor   │            │
│  │              │                  │              │            │
│  │ • Sign msg   │                  │ • Sign msg   │            │
│  │ • Call       │                  │ • Call       │            │
│  │   execute_   │                  │   execute    │            │
│  │   message    │                  │   Message    │            │
│  └──────┬───────┘                  └──────┬───────┘            │
│         │                                  │                     │
└─────────┼──────────────────────────────────┼─────────────────────┘
          │                                  │
          ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Destination Gateway Contracts                │
│  ┌──────────────┐              ┌──────────────┐                │
│  │ Casper       │              │ Sepolia      │                │
│  │ Gateway      │              │ Gateway      │                │
│  │              │              │              │                │
│  │ Calls        │              │ Calls        │                │
│  │ receiver.    │              │ receiver.    │                │
│  │ on_call()    │              │ on_call()    │                │
│  └──────┬───────┘              └──────┬───────┘                │
│         │                              │                        │
│         ▼                              ▼                        │
│  ┌──────────────┐              ┌──────────────┐                │
│  │   Receiver   │              │   Receiver   │                │
│  │   Contract   │              │   Contract   │                │
│  │   (on_call)  │              │   (on_call)  │                │
│  └──────────────┘              └──────────────┘                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         MongoDB Database                         │
│  • Messages: All relayed messages with status                    │
│  • ChainState: Last processed nonce/block per chain              │
│  • RelayerMetrics: Aggregated statistics                         │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Listeners

#### Casper Listener (`casper.listener.ts`)
- **Strategy**: Nonce-based polling
- **Interval**: Polls every **1 minute**
- **Process**:
  1. Gets current nonce from contract
  2. Compares with last processed nonce in DB
  3. If `currentNonce > lastProcessedNonce`, fetches and processes new messages
  4. Updates DB with last processed nonce
- **Why polling?**: Casper doesn't have native event system like EVM, so we poll the nonce counter
- **Efficiency**: Only processes messages when nonce increases (skips if no new messages)

#### Sepolia Listener (`sepolia.listener.ts`)
- **Strategy**: WebSocket-based real-time event listening
- **Connection**: Uses `WebSocketProvider` for persistent connection
- **Process**:
  1. Connects via WebSocket to Infura RPC
  2. Listens to `MessageSent` events in real-time
  3. Processes historical events on startup (from last processed block)
  4. Updates DB with last processed block
- **Why WebSocket?**: Real-time, efficient, no polling overhead
- **Features**: Auto-reconnect on connection loss

### 2. Executors

#### Casper Executor (`casper.executor.ts`)
- **Function**: Executes messages on Casper gateway
- **Process**:
  1. Builds message bytes (srcChainId, dstChainId, srcGateway, receiver, nonce, payload)
  2. Signs message with Secp256k1 private key (from `casper_keys/secret_key.pem`)
  3. Calls `execute_message` entry point on Casper gateway
  4. Waits for transaction confirmation
- **Signature**: 65-byte Secp256k1 signature (r, s, v)

#### Sepolia Executor (`sepolia.executor.ts`)
- **Function**: Executes messages on Sepolia gateway
- **Process**:
  1. Computes message hash (keccak256 of encoded parameters)
  2. Signs message hash with relayer's private key (EIP-191)
  3. Calls `executeMessage` function on Sepolia gateway
  4. Waits for transaction receipt
- **Signature**: EIP-191 personal sign format

### 3. Message Router (`message.router.ts`)
- Routes messages to appropriate executor based on destination chain
- Sets destination gateway address if not provided
- Handles routing errors

### 4. Relay Executor (`relay.executor.ts`)
- Orchestrates the entire relay process:
  1. Validates message
  2. Checks if message already exists (prevents duplicates)
  3. Stores message in DB as PENDING
  4. Routes message to executor
  5. Updates message status (DELIVERED or FAILED)
  6. Records metrics

### 5. Database Models

#### Message
- Stores all relayed messages
- Fields: messageId, nonce, sourceChain, destinationChain, payload, status, transactionHash
- Status: PENDING → DELIVERED or FAILED

#### ChainState
- Tracks last processed state per chain
- **Casper**: `lastProcessedNonce` (prevents reprocessing)
- **Sepolia**: `lastProcessedBlock` (prevents reprocessing)

#### RelayerMetrics
- Aggregated statistics
- Total messages processed/delivered/failed
- Messages by source/destination chain

## Message Flow

### 1. User Sends Message
```
User → Gateway Contract → sendMessage(dstChainId, receiver, payload)
```

### 2. Gateway Stores/Emits
- **Casper**: Stores in dictionary with nonce as key
- **Sepolia**: Emits `MessageSent` event

### 3. Relayer Detects
- **Casper**: Polls nonce, if increased → fetch message
- **Sepolia**: WebSocket receives event → process immediately

### 4. Relayer Executes
- Routes to appropriate executor
- Executor signs and calls `execute_message` on destination gateway
- Gateway internally calls `receiver.on_call()`

### 5. Status Tracking
- Message stored in DB
- Status updated (PENDING → DELIVERED/FAILED)
- Metrics recorded

## Configuration

### Environment Variables (`.env`)
```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Ethereum Sepolia
ETHEREUM_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
ETHEREUM_SEPOLIA_PRIVATE_KEY=0x...
ETHEREUM_SEPOLIA_GATEWAY=0x...

# Casper Testnet
CASPER_TESTNET_RPC_URL=https://node.testnet.cspr.cloud/rpc
CASPER_GATEWAY=hash-...
CASPER_API_KEY=...
```

### Key Files
- **Casper Private Key**: `src/casper_keys/secret_key.pem` (ED25519, also used as Secp256k1 seed)
- **Gateway Contracts**: Configured in `.env`

## Performance Optimizations

1. **Casper**: Only polls when nonce increases (skips if no new messages)
2. **Sepolia**: WebSocket eliminates polling overhead
3. **Database**: Indexes on messageId, sourceChain, destinationChain, status
4. **State Tracking**: Prevents duplicate processing via ChainState

## Error Handling

- **Connection Loss**: WebSocket auto-reconnects
- **Transaction Failures**: Message status set to FAILED, error logged
- **Duplicate Messages**: Skipped if already in DB
- **Rate Limiting**: Retry with exponential backoff

## Future Enhancements

- [ ] Add more chains (Solana, etc.)
- [ ] Add message retry mechanism
- [ ] Add health check endpoints
- [ ] Add metrics API
- [ ] Add explorer UI integration
