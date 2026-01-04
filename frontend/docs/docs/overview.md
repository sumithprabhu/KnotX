# Messaging Overview

KnotX Messaging enables secure, trustless communication between different blockchain networks. Send messages, data, and execute cross-chain operations with cryptographic guarantees and enterprise-grade reliability.

## What is KnotX?

KnotX is a cross-chain messaging protocol that connects value and data across blockchain networks. Built on a gateway-based architecture with a decentralized relayer system, KnotX provides a unified interface for cross-chain communication.

## Core Architecture

KnotX uses three main components:

### 1. Gateway Contracts

Gateway contracts are deployed on each supported blockchain network. They serve as the entry and exit points for cross-chain messages:

- **Send Messages**: Your contracts call the gateway to send messages to other chains
- **Receive Messages**: Gateways execute incoming messages on destination chains
- **Event Emission**: Gateways emit events that relayers monitor
- **Replay Protection**: Built-in message ID tracking prevents duplicate execution

### 2. Relayer Network

The relayer is a service that bridges messages between chains:

- **Event Listening**: Monitors `MessageSent` events on source chains
- **Message Validation**: Verifies message integrity and structure
- **Signature Generation**: Cryptographically signs messages for security
- **Cross-Chain Execution**: Submits messages to destination gateways

### 3. Receiver Contracts

Your application contracts implement the `IKnotXReceiver` interface:

- **Message Reception**: Receive messages via the `onCall` function
- **Custom Logic**: Process messages according to your application needs
- **Security**: Only callable by authorized gateway contracts

## How It Works

The complete message flow follows these steps:

```
┌─────────────────┐
│  Source Chain   │
│                 │
│  1. Your App    │
│     calls       │
│     gateway     │
│     .sendMsg()  │
└────────┬────────┘
         │
         │ 2. Gateway emits
         │    MessageSent event
         ▼
┌─────────────────┐
│    Relayer      │
│                 │
│  3. Listens for │
│     events      │
│  4. Validates   │
│  5. Signs msg   │
└────────┬────────┘
         │
         │ 6. Executes on
         │    destination
         ▼
┌─────────────────┐
│ Destination     │
│ Chain           │
│                 │
│  7. Gateway     │
│     verifies    │
│  8. Calls your  │
│     receiver    │
│     .onCall()   │
└─────────────────┘
```

### Step-by-Step Process

1. **Message Initiation**: Your application calls the source chain gateway contract with a message payload and destination chain ID.

2. **Event Emission**: The gateway emits a `MessageSent` event with a unique message ID, nonce, and all message details.

3. **Relayer Processing**: The relayer listens for events, validates the message structure, and computes a cryptographic signature.

4. **Destination Execution**: The relayer submits the message to the destination gateway with its signature.

5. **Verification**: The destination gateway verifies the relayer signature and checks for replay attacks.

6. **Receiver Callback**: Upon successful validation, the gateway calls your receiver contract's `onCall` function with the payload.

## Key Features

### 🔒 Cryptographic Security

Every message is cryptographically verified with signature-based authentication. The relayer signs messages, and destination gateways verify these signatures before execution.

### 🌐 Universal Protocol

Works across multiple blockchain networks with a unified interface:
- **EVM Chains**: Ethereum, Sepolia, and other EVM-compatible networks
- **Casper Network**: Native support with contract hash-based addressing
- **Coming Soon**: Solana, Polygon, Arbitrum, and more

### ⚡ Trustless & Decentralized

- No trusted intermediaries required
- Gateway contracts are open-source and auditable
- Relayer network can be run by anyone
- Message integrity guaranteed by cryptography

### 🛡️ Replay Protection

Built-in message ID tracking prevents duplicate execution. Each message has a unique ID computed from all message parameters.

### 💰 Cost Efficient

Pay only for what you use. Base fees are minimal, and you only pay for successful message delivery.

## Use Cases

### Cross-Chain Token Transfers

Transfer tokens from one chain to another with atomic execution guarantees.

### Cross-Chain Data Synchronization

Keep data synchronized across multiple chains, enabling multi-chain applications.

### Cross-Chain Governance

Execute governance decisions across multiple networks from a single interface.

### Universal Counter Example

Our [Universal Counter tutorial](/docs/tutorial) demonstrates a simple but powerful use case: a counter that can be incremented from any supported chain, with the value synchronized across all chains.

## Supported Networks

### Currently Available

- ✅ **Ethereum Sepolia** (Testnet)
- ✅ **Casper Testnet**

### Coming Soon

- 🔜 Ethereum Mainnet
- 🔜 Casper Mainnet
- 🔜 Solana
- 🔜 Polygon
- 🔜 Arbitrum
- 🔜 Optimism

## Getting Started

Ready to build cross-chain applications? Here's how to get started:

1. **[Get Started Guide](/docs/get-started)**: Learn the basics of sending and receiving messages
2. **[Tutorial](/docs/tutorial)**: Build a Universal Counter application
3. **[Contract Addresses](/docs/contracts)**: Find deployed gateway addresses
4. **[Message Format](/docs/guides/message-format)**: Understand message structure
5. **[Architecture](/docs/concepts/architecture)**: Deep dive into system design

## Security Model

KnotX uses multiple layers of security:

- **Cryptographic Signatures**: All messages are signed by relayers
- **Signature Verification**: Destination gateways verify signatures before execution
- **Replay Protection**: Message IDs prevent duplicate execution
- **Access Control**: Only authorized gateways can call receiver contracts
- **Open Source**: All contracts are open-source and auditable

Learn more about our [security model](/docs/concepts/security-model).

## Next Steps

- Read the [Get Started guide](/docs/get-started) to send your first message
- Explore the [Universal Counter tutorial](/docs/tutorial) for a complete example
- Check out [contract addresses](/docs/contracts) for deployed gateways
- Understand the [message flow](/docs/concepts/message-flow) in detail

---

**Ready to connect value across networks?** Start building with KnotX today!
