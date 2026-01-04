<div align="center">
  <img src="frontend/public/logo.png" alt="KnotX Logo" width="120" height="120" />
  
  # KnotX
  
  **Connecting value across networks**
</div>

## What is KnotX?

KnotX is a cross-chain messaging protocol that enables secure, trustless communication between different blockchain networks. Built on a gateway-based architecture with a decentralized relayer system, KnotX provides a unified interface for sending messages, data, and executing cross-chain operations across EVM chains, Casper, and other blockchain networks.

KnotX uses gateway contracts deployed on each supported chain to handle message sending and receiving. A relayer network listens for messages on source chains, validates them cryptographically, and executes them on destination chains, ensuring secure and reliable cross-chain communication without trusted intermediaries.

## Features

- **Universal Protocol** - Works across EVM chains, Casper, and other blockchain networks with a unified interface
- **Cryptographic Security** - Every message is cryptographically verified with signature-based authentication
- **Trustless & Decentralized** - No trusted intermediaries required; gateway contracts are open-source and auditable
- **Replay Protection** - Built-in message ID tracking prevents duplicate execution
- **Cost Efficient** - Pay only for what you use with minimal protocol fees
- **Contract Interfaces** - Simple integration using standard contract interfaces (`IKnotXGateway` and `IKnotXReceiver`)
- **Relayer Network** - Decentralized relayer system handles message routing between chains

## Future Scope

- **Multi-Node Setup** - Distributed relayer network with multiple nodes for increased redundancy and reliability
- **Support for More Non-EVM Chains** - Expansion to Solana, Cosmos, Polkadot, and other non-EVM blockchain networks
- **Mainnet Deployment** - Production-ready deployments on Ethereum Mainnet, Casper Mainnet, and other mainnet networks
- **Advanced Features** - Cross-chain token transfers, data synchronization, and governance operations
- **Enterprise Solutions** - Enhanced monitoring, analytics, and enterprise-grade support tools
- **Developer Tools** - Enhanced tooling and libraries for easier integration and development

## Folder Structure

```
casper-hack/
├── contracts/          # Smart contracts (Gateway & Receiver)
│   ├── evm/            # EVM contracts (Solidity)
│   └── casper/         # Casper contracts (Rust)
│
├── relayer/            # Relayer service for cross-chain message routing
│
└── frontend/           # Next.js web application
    ├── app/            # Next.js app router pages
    ├── components/     # React components
    └── docs/           # Documentation (Docusaurus)
```

### 📁 [contracts/](./contracts/)

Smart contracts for the KnotX protocol:
- **Gateway Contracts** - Handle message sending and receiving
- **Receiver Contracts** - Implement `IKnotXReceiver` interface

[View Contracts README →](./contracts/README.md)

### 📁 [relayer/](./relayer/)

Production-grade cross-chain message relay service:
- Listens to gateway contracts on source chains
- Validates and routes messages to destination chains
- Handles cryptographic signatures and message verification

[View Relayer README →](./relayer/README.md)

### 📁 [frontend/](./frontend/)

Next.js web application providing:
- User interface for cross-chain operations
- Interactive Universal Counter demo
- Comprehensive documentation

[View Frontend README →](./frontend/README.md)

## Getting Started

1. **Explore the Frontend**: Visit the [demo page](http://localhost:3000/demo) to try the Universal Counter
2. **Read the Documentation**: Check out the [docs](http://localhost:3000/docs/overview) for detailed guides
3. **Deploy Contracts**: See the [contracts folder](./contracts/) for smart contract code
4. **Run the Relayer**: Follow the [relayer README](./relayer/README.md) to set up the message relay service

## Links

- **Frontend Demo**: [http://localhost:3000/demo](http://localhost:3000/demo)
- **Documentation**: [http://localhost:3000/docs/overview](http://localhost:3000/docs/overview)
- **Contract Addresses**: See [contracts README](./contracts/README.md)

---

**Built for the future of cross-chain interoperability**

