# Architecture

KnotX uses a gateway-based architecture where each supported chain has a gateway contract that handles message sending and receiving. A decentralized relayer network ensures message delivery between chains.

## Core Components

### Gateway Contracts

Deployed on each supported chain, gateway contracts manage message lifecycle. They emit events when messages are sent and execute messages when received, with built-in replay protection via message ID tracking.

### Relayer Network

The relayer listens for MessageSent events on source chains, validates messages, and submits them to destination chain gateways with cryptographic signatures. Multiple relayers can operate for redundancy.

### Receiver Contracts

Your application contracts implement the IKnotXReceiver interface to receive and process cross-chain messages. The gateway calls your contract's onCall function with the message payload.

## Supported Chains

### EVM Chains

Ethereum, Polygon, Arbitrum, Optimism, and other EVM-compatible networks.

### Solana

Full support for Solana mainnet and devnet with program-based messaging.

### Casper

Native support for Casper Network with contract hash-based addressing.


