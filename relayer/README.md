<div align="center">

# KnotX Relayer

**Cross-Chain Message Relay Service**

</div>

## What Is It?

KnotX Relayer is a production-grade cross-chain message relay service that enables seamless communication between different blockchain networks. It acts as a trusted middleware that listens to gateway contracts on source chains and automatically executes messages on destination chains.

The relayer currently supports **Casper Testnet** and **Ethereum Sepolia**, enabling users to send messages from one chain to another through gateway contracts.

### How It Works

1. **User sends message** via gateway contract on source chain
2. **Relayer detects** the message (via polling or events)
3. **Relayer routes** message to destination chain
4. **Relayer executes** message on destination gateway contract
5. **Gateway calls** receiver contract's `onCall` function

The relayer handles all the complexity of cross-chain communication, including message signing, routing, and execution.

## Features

### Multi-Chain Support
- ✅ **Casper Testnet**: Nonce-based polling for message detection
- ✅ **Ethereum Sepolia**: Real-time WebSocket event listening
- ✅ Easy to extend to additional chains

### Efficient Message Processing
- ✅ **Smart Polling**: Casper listener only processes when nonce increases
- ✅ **Real-Time Events**: Sepolia uses WebSocket for instant message detection
- ✅ **Duplicate Prevention**: Database state tracking prevents reprocessing

### Reliability & Security
- ✅ **Message Signing**: Cryptographic signatures for authentication
- ✅ **Error Handling**: Retry logic with exponential backoff
- ✅ **State Tracking**: MongoDB stores all messages and processing state
- ✅ **Comprehensive Logging**: Structured logging for debugging

### Monitoring & Metrics
- ✅ **Message Tracking**: All relayed messages stored with status
- ✅ **Metrics Collection**: Aggregated statistics per chain
- ✅ **Health Monitoring**: Track success/failure rates

## Future Scope

### Multiple Node Support

The relayer is designed to support multiple nodes for improved reliability, performance, and scalability.

#### Distributed Architecture
- **Multiple Relayer Instances**: Run multiple relayer nodes for redundancy and load distribution
- **Load Balancing**: Distribute message processing across nodes
- **Fault Tolerance**: Automatic failover if a node goes down

#### Node Coordination
- **Leader Election**: Elect a leader node for coordination tasks
- **Consensus Mechanism**: Ensure all nodes agree on message processing
- **State Synchronization**: Keep all nodes in sync with latest state

#### Database & Infrastructure
- **Database Sharding**: Horizontal scaling with sharded MongoDB collections
- **Distributed Locking**: Use Redis for distributed locks to prevent duplicate processing
- **Message Queue**: Implement message queue (RabbitMQ/Kafka) for load distribution

#### Monitoring & Operations
- **Node Health Endpoints**: REST API for checking node status
- **Distributed Metrics**: Aggregate metrics from all nodes
- **Alerting System**: Notify when nodes are down or unhealthy
- **Monitoring Dashboard**: Real-time view of all nodes and their status

#### Implementation Phases

**Phase 1: Multi-Node Foundation**
- Node identifier and configuration
- Distributed locking (Redis)
- Node health check endpoints
- Basic node coordination

**Phase 2: Load Distribution**
- Message queue implementation (RabbitMQ/Kafka)
- Load balancing logic
- Leader election mechanism
- Node discovery

**Phase 3: High Availability**
- Automatic failover
- State replication between nodes
- Monitoring dashboard
- Alerting system

**Phase 4: Advanced Features**
- Database sharding
- Cross-chain message prioritization
- Dynamic node scaling
- Performance optimization

### Additional Enhancements

- [ ] **More Chains**: Add support for Solana, Polygon, and other blockchains
- [ ] **Message Retry**: Automatic retry mechanism with exponential backoff
- [ ] **REST API**: Query messages and metrics via REST endpoints
- [ ] **WebSocket API**: Real-time updates for message status
- [ ] **Explorer UI**: Web interface for viewing messages and statistics
- [ ] **Message Encryption**: Support for encrypted cross-chain messages
- [ ] **Rate Limiting**: Per-chain rate limiting for message processing
- [ ] **Gas Optimization**: Smart gas price management and transaction batching
- [ ] **Custom Formats**: Support for custom message formats and protocols

## Project Structure

```
relayer/
├── src/
│   ├── chains/          # Chain-specific listeners and executors
│   ├── relayer/         # Core relay logic (router, executor, validator)
│   ├── db/              # Database models (Message, ChainState, Metrics)
│   ├── services/        # Metrics and explorer services
│   ├── config/          # Configuration (env, chains, mongo)
│   └── utils/           # Utilities (logger, retry, etc.)
├── ARCHITECTURE.md      # Detailed architecture documentation
└── README.md            # This file
```

## Documentation

- **Architecture Details**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation
- **Debugging Guide**: See [DEBUG.md](./DEBUG.md) for troubleshooting and debugging with cast commands

## License

MIT
