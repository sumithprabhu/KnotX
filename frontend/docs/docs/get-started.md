# Get Started

Get started with KnotX Messaging in minutes. This guide will walk you through setting up your first cross-chain message using contract interfaces and the relayer system.

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm installed
- Basic knowledge of smart contracts and blockchain development
- Access to supported blockchain networks (Ethereum Sepolia or Casper Testnet)
- Wallet with test tokens for gas fees
- Understanding of contract interfaces and ABI encoding

## How KnotX Works

KnotX uses a **gateway-based architecture** with a **relayer system**:

1. **Gateway Contracts**: Deployed on each supported chain, these contracts handle message sending and receiving
2. **Receiver Contracts**: Your contracts that implement `IKnotXReceiver` interface to receive messages
3. **Relayer**: A service that listens for messages on source chains and executes them on destination chains

## Contract Interfaces

### EVM Chains (Ethereum, Sepolia, etc.)

Your contracts interact with the KnotX Gateway using the following interface:

```solidity
interface IKnotXGateway {
    function sendMessage(
        uint32 dstChainId,
        bytes memory receiver,
        bytes memory payload
    ) external payable returns (bytes32 messageId);
    
    function executeMessage(
        uint32 srcChainId,
        bytes memory sender,
        bytes memory receiver,
        uint64 messageNonce,
        bytes memory payload,
        bytes memory relayerSignature
    ) external;
}

event MessageSent(
    bytes32 indexed messageId,
    uint32 dstChainId,
    bytes receiver,
    bytes sender,
    uint64 nonce,
    bytes payload
);
```

### Receiver Interface

Your receiver contracts must implement:

```solidity
interface IKnotXReceiver {
    function onCall(
        uint32 srcChainId,
        bytes memory sender,
        bytes memory payload
    ) external;
}
```

## Quick Example: Sending a Message

Here's how to send a message from Ethereum Sepolia to Casper Testnet using ethers.js:

```javascript
import { ethers } from "ethers";

// Initialize provider and signer
const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/YOUR_KEY");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Gateway contract address on Sepolia
const GATEWAY_ADDRESS = "0xe6F75A8E2d21EeFD33A5ecA76215bB20DbE0bb1F";

// Gateway ABI (simplified)
const GATEWAY_ABI = [
  "function sendMessage(uint32 dstChainId, bytes receiver, bytes payload) external payable returns (bytes32)",
  "event MessageSent(bytes32 indexed messageId, uint32 dstChainId, bytes receiver, bytes sender, uint64 nonce, bytes payload)"
];

const gateway = new ethers.Contract(GATEWAY_ADDRESS, GATEWAY_ABI, wallet);

// Destination chain ID (Casper Testnet = 3)
const DST_CHAIN_ID = 3;

// Receiver: Casper contract hash (32 bytes, remove "hash-" prefix)
const casperReceiverHash = "2ede3272d048e81c344c68f65db55141e1132d70da6443770ac0de443534d36e";
const receiver = ethers.hexlify(ethers.getBytes("0x" + casperReceiverHash));

// Payload: encode your data (e.g., a number)
const payload = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [42]);

// Send message with base fee (0.001 ETH)
const tx = await gateway.sendMessage(DST_CHAIN_ID, receiver, payload, {
  value: ethers.parseEther("0.001")
});

const receipt = await tx.wait();
console.log("Transaction hash:", receipt.hash);

// Get message ID from event
const event = receipt.logs.find(log => {
  try {
    return gateway.interface.parseLog(log).name === "MessageSent";
  } catch {
    return false;
  }
});

if (event) {
  const parsed = gateway.interface.parseLog(event);
  console.log("Message ID:", parsed.args.messageId);
  console.log("The relayer will process this message and execute it on Casper");
}
```

## What Happens Next?

1. **Your transaction** is sent to the gateway contract
2. **Gateway emits** a `MessageSent` event with your message
3. **Relayer listens** for the event and validates the message
4. **Relayer executes** the message on the destination chain
5. **Receiver contract** receives the message via `onCall()`

## Next Steps

- Learn about [message format](/docs/guides/message-format)
- See how to [receive messages](/docs/guides/receiving-messages)
- Try the [Universal Counter tutorial](/docs/tutorial)
- Check out [contract addresses](/docs/contracts)
