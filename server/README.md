# Cross-Chain Relayer Server

Production-grade TypeScript relayer server for cross-chain messaging between Ethereum Sepolia, Solana Devnet, and Casper Testnet.

## 🏗️ Architecture

### High-Level Flow

```
Source Chain → Listener → Message Router → Destination Sender → Destination Chain
                     ↓
              MongoDB (Message & Stats)
```

### Component Overview

1. **Chain Listeners** (`chains/*/listener.ts`)
   - Monitor source chains for `MessageSent` events
   - Parse and normalize messages into `RelayMessage` format
   - Emit messages to the relayer executor

2. **Message Router** (`relayer/message.router.ts`)
   - Routes messages to the appropriate destination chain sender
   - Handles chain-specific sender initialization

3. **Chain Senders** (`chains/*/sender.ts`)
   - Send messages to destination gateway contracts
   - Implement retry logic with exponential backoff
   - Return relay results with transaction hashes

4. **Relay Executor** (`relayer/relay.executor.ts`)
   - Validates incoming messages
   - Stores messages in MongoDB
   - Coordinates routing and status updates
   - Tracks metrics

5. **Database Models**
   - **Message**: Stores all relayed messages with status tracking
   - **Stats**: Aggregates relayer statistics for explorer UI

6. **Services**
   - **Metrics Service**: Tracks successful/failed relays and per-chain statistics
   - **Explorer Service**: Provides query interface for explorer UI

## 📁 Project Structure

```
server/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── app.ts                   # Main application class
│   ├── config/
│   │   ├── env.ts              # Environment variable validation (zod)
│   │   ├── mongo.ts            # MongoDB connection
│   │   └── chains.ts          # Chain configurations
│   ├── chains/
│   │   ├── evm/
│   │   │   ├── sepolia.listener.ts
│   │   │   └── sepolia.sender.ts
│   │   ├── solana/
│   │   │   ├── solana.listener.ts
│   │   │   └── solana.sender.ts
│   │   └── casper/
│   │       ├── casper.listener.ts
│   │       └── casper.sender.ts
│   ├── relayer/
│   │   ├── message.router.ts   # Routes messages to destination chains
│   │   ├── relay.executor.ts  # Executes end-to-end relay
│   │   └── relay.validator.ts # Validates relay messages
│   ├── db/
│   │   ├── models/
│   │   │   ├── Message.ts     # Message schema
│   │   │   └── Stats.ts       # Statistics schema
│   │   └── index.ts
│   ├── services/
│   │   ├── metrics.service.ts # Metrics tracking
│   │   └── explorer.service.ts # Explorer data queries
│   ├── types/
│   │   ├── message.ts         # Message types
│   │   └── chains.ts          # Chain types
│   ├── utils/
│   │   ├── logger.ts          # Pino logger
│   │   ├── retry.ts           # Retry utility
│   │   └── sleep.ts           # Sleep utility
│   └── constants/
│       └── chains.ts          # Chain constants
├── .env.example
├── package.json
├── tsconfig.json
├── eslint.config.js
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB instance
- RPC endpoints for supported chains

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - `MONGODB_URI`: MongoDB connection string
   - `ETHEREUM_SEPOLIA_RPC_URL`: Ethereum Sepolia RPC endpoint
   - `SOLANA_DEVNET_RPC_URL`: Solana Devnet RPC endpoint
   - `CASPER_TESTNET_RPC_URL`: Casper Testnet RPC endpoint
   - Optional: Private keys for each chain (if sending transactions)

### Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

## 🔧 Configuration

### Environment Variables

All environment variables are validated using Zod schema. Required variables:

- `MONGODB_URI`: MongoDB connection string
- `ETHEREUM_SEPOLIA_RPC_URL`: Ethereum Sepolia RPC URL
- `SOLANA_DEVNET_RPC_URL`: Solana Devnet RPC URL
- `CASPER_TESTNET_RPC_URL`: Casper Testnet RPC URL

Optional variables:
- `NODE_ENV`: Environment (development/production/test)
- `PORT`: Server port (default: 3000)
- `LOG_LEVEL`: Logging level (default: info)
- Private keys for each chain (if sending transactions)

## 📊 Data Models

### Message Schema

```typescript
{
  messageId: string;          // Unique message identifier
  nonce: number;              // Message nonce
  sourceChain: string;        // Source chain ID
  destinationChain: string;   // Destination chain ID
  sourceGateway: string;      // Source gateway address
  destinationGateway: string; // Destination gateway address
  payload: string;            // Hex-encoded payload
  payloadHash: string;        // Hash of payload
  status: MessageStatus;      // PENDING | DELIVERED | FAILED
  transactionHash?: string;   // Destination chain tx hash
  error?: string;             // Error message if failed
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
}
```

### Stats Schema

```typescript
{
  totalMessages: number;
  successfulRelays: number;
  failedRelays: number;
  perChainCounts: {
    [chainId: string]: {
      sent: number;
      received: number;
      successful: number;
      failed: number;
    };
  };
  lastUpdated: Date;
}
```

## 🔌 Integration Points (TODO)

The following areas are stubbed and need contract integration:

### Chain Listeners

1. **Ethereum Sepolia** (`chains/evm/sepolia.listener.ts`)
   - TODO: Add contract ABI
   - TODO: Implement `MessageSent` event listener
   - TODO: Parse event arguments (sourceChain, destChain, gateway, payload, nonce)

2. **Solana Devnet** (`chains/solana/solana.listener.ts`)
   - TODO: Add program ID
   - TODO: Implement account monitoring or log subscription
   - TODO: Parse account/log data for message details

3. **Casper Testnet** (`chains/casper/casper.listener.ts`)
   - TODO: Add contract package hash
   - TODO: Implement block monitoring or SSE subscription
   - TODO: Parse deploy results for message events

### Chain Senders

1. **Ethereum Sepolia** (`chains/evm/sepolia.sender.ts`)
   - TODO: Add gateway contract ABI
   - TODO: Implement `receiveMessage` contract call
   - TODO: Handle gas estimation and transaction confirmation

2. **Solana Devnet** (`chains/solana/solana.sender.ts`)
   - TODO: Add program instruction building
   - TODO: Implement transaction creation and signing
   - TODO: Handle transaction confirmation

3. **Casper Testnet** (`chains/casper/casper.sender.ts`)
   - TODO: Add contract entry point details
   - TODO: Implement deploy creation with runtime args
   - TODO: Handle deploy signing and submission

## 🛡️ Error Handling

- All chain operations use retry logic with exponential backoff
- Failed messages are stored with error details
- Metrics track success/failure rates
- Graceful shutdown on SIGTERM/SIGINT

## 📝 Logging

Uses Pino for structured logging with:
- JSON output in production
- Pretty-printed output in development
- Configurable log levels
- Contextual information (messageId, chain, etc.)

## 🔍 Monitoring

The relayer tracks:
- Total messages processed
- Successful vs failed relays
- Per-chain statistics (sent/received/successful/failed)
- Message status distribution

Use `explorerService` to query statistics for UI dashboards.

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test
```

## 📄 License

MIT
