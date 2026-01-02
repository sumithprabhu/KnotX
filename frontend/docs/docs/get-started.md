# Get Started

Get started with KnotX Messaging in minutes. This guide will walk you through setting up your first cross-chain message.

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm installed
- Basic knowledge of smart contracts and blockchain development
- Access to supported blockchain networks (Ethereum Sepolia, Solana Devnet, or Casper Testnet)
- Wallet with test tokens for gas fees

## Installation

```bash
# Install KnotX SDK
npm install @knotx/sdk

# Or with yarn
yarn add @knotx/sdk

# Or with pnpm
pnpm add @knotx/sdk
```

## Quick Example

Here's a simple example of sending a message from Ethereum to Casper:

```javascript
import { KnotXGateway } from "@knotx/sdk";

// Initialize gateway
const gateway = new KnotXGateway({
  chainId: 11155111, // Ethereum Sepolia
  rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
  privateKey: process.env.PRIVATE_KEY,
});

// Send message
const messageId = await gateway.sendMessage({
  destinationChainId: 3, // Casper Testnet
  receiver: "contract-hash-on-casper",
  payload: ethers.utils.toUtf8Bytes("Hello from Ethereum!"),
  value: ethers.utils.parseEther("0.001"), // Fee
});

console.log("Message sent:", messageId);
```


