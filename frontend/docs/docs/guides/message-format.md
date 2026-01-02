# Message Format

Messages in KnotX follow a standardized format to ensure compatibility across all supported chains.

## Message Structure

```typescript
interface RelayMessage {
  messageId: string;        // Unique identifier: keccak256(chainId, dstChainId, gateway, receiver, nonce, payload)
  nonce: number;            // Sequential nonce per source chain
  sourceChain: string;      // Source chain identifier
  destinationChain: string; // Destination chain identifier
  sourceGateway: string;    // Gateway contract address on source chain
  destinationGateway: string; // Gateway contract address on destination chain
  payload: string;          // Hex-encoded message payload
  payloadHash: string;      // Hash of payload for verification
  timestamp: Date;          // Message creation timestamp
}
```

## Message ID Calculation

The message ID is computed using a deterministic hash function to ensure uniqueness and prevent replay attacks:

```solidity
// Solidity
bytes32 messageId = keccak256(
    abi.encodePacked(
        srcChainId,
        dstChainId,
        srcGateway,
        receiver,
        nonce,
        payload
    )
);
```

```javascript
// JavaScript
import { ethers } from "ethers";

const messageId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint32", "uint32", "address", "bytes", "uint64", "bytes"],
        [srcChainId, dstChainId, srcGateway, receiver, nonce, payload]
    )
);
```

## Payload Encoding

Payloads can contain any arbitrary data. Common patterns include:

```javascript
// Encoding a simple string
const payload = ethers.toUtf8Bytes("Hello, Cross-Chain!");

// Encoding structured data
const payload = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "string"],
    [tokenAddress, amount, "transfer"]
);

// Encoding complex struct
struct TransferData {
    address recipient;
    uint256 amount;
    bytes32 tokenId;
}
const payload = abi.encode(transferData);
```


