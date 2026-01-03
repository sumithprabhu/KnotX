# Relayer Setup Guide

## Overview

The relayer listens to gateway contracts on Casper Testnet and Ethereum Sepolia, and executes messages on the destination chain.

## Architecture

1. **Listeners**: Monitor source chains for new messages
   - **Casper Listener**: Polls by nonce (every 10 seconds)
   - **Sepolia Listener**: Listens to `MessageSent` events

2. **Executors**: Execute messages on destination chains
   - **Casper Executor**: Calls `execute_message` on Casper gateway
   - **Sepolia Executor**: Calls `executeMessage` on Sepolia gateway

3. **Database**: MongoDB stores:
   - Messages (all relayed messages)
   - ChainState (last processed nonce/block per chain)
   - RelayerMetrics (aggregated statistics)

## Configuration

### Environment Variables

Create a `.env` file in the `relayer/` directory:

```env
# MongoDB
MONGODB_URI=mongodb+srv://sumith:sumith@cluster0.qzdukwu.mongodb.net/?appName=Cluster0

# Ethereum Sepolia
ETHEREUM_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ETHEREUM_SEPOLIA_PRIVATE_KEY=ecdf0c859964a95b2bcc7dc5835b1dbb89e04173a530fe397c7fa3f5dca6fcf9
ETHEREUM_SEPOLIA_GATEWAY=0xD3B1c72361f03d5F138C2c768AfdF700266bb39a

# Casper Testnet
CASPER_TESTNET_RPC_URL=https://node.testnet.cspr.cloud/rpc
CASPER_PRIVATE_KEY=
CASPER_GATEWAY=hash-4ce6b9ec80fde0158f7ab13f37cff883660048c1d457e9e48130cc884ce83073
CASPER_API_KEY=019b7cfa-8db3-7a21-89b3-e3a0bc3f3340
```

### Gateway Contracts

- **Casper Gateway**: `hash-4ce6b9ec80fde0158f7ab13f37cff883660048c1d457e9e48130cc884ce83073`
- **Sepolia Gateway**: `0xD3B1c72361f03d5F138C2c768AfdF700266bb39a`

## How It Works

### Flow

1. **User sends message** via gateway contract:
   - Defines: `dst_chain_id`, `receiver`, `payload`
   - Gateway emits event (Sepolia) or stores in dictionary (Casper)

2. **Relayer listens**:
   - **Casper**: Polls nonce, reads messages from dictionary
   - **Sepolia**: Listens to `MessageSent` events

3. **Relayer executes**:
   - Calls `execute_message` on destination gateway
   - Gateway internally calls `on_call` on receiver contract

### Message Format

Messages are stored as:
```
src_chain_id (4 bytes) + dst_chain_id (4 bytes) + src_gateway (32 bytes) + receiver (32 bytes) + nonce (8 bytes) + payload (variable)
```

## Running the Relayer

```bash
cd relayer
npm install
npm run dev
```

Or in production:
```bash
npm run build
npm start
```

## Database Models

### ChainState
- Tracks last processed nonce (Casper) or block (Sepolia) per chain
- Prevents duplicate processing

### RelayerMetrics
- Total messages processed/delivered/failed
- Messages by source/destination chain

### Message
- All relayed messages with status tracking
- Used for explorer UI and debugging

## Notes

- Casper listener polls every 10 seconds
- Sepolia listener processes historical events on startup
- Both listeners update database state after processing
- Executors sign messages with relayer private keys
- Signature verification is currently commented out in contracts
