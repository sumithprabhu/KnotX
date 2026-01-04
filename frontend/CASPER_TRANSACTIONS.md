# Sending Transactions on Casper Network

This guide walks you through the steps required to send transactions to the Casper network from your React/Next.js application using the `casper-js-sdk` library and Casper Wallet extension.

## Prerequisites

Before you begin, ensure you have:

- Node.js (version 18 or later)
- A React or Next.js application
- Casper Wallet browser extension installed
- Basic understanding of TypeScript/JavaScript

## Installation

Install the required dependencies:

```bash
npm install casper-js-sdk
```

## Setup

### 1. Import Required Modules

```typescript
import {
  CLValue,
  CLTypeList,
  CLTypeUInt8,
} from 'casper-js-sdk';
```

### 2. Connect to Casper Wallet

First, ensure your application can connect to the Casper Wallet extension. See the `CasperWalletProvider` component for wallet connection setup.

## Sending a Transaction

### Step 1: Prepare Your Data

Prepare the data you want to send in your transaction:

```typescript
// Example: Sending a message to a gateway contract
const dstChainId = 11155111; // Destination chain ID (e.g., Sepolia)
const receiverAddress = "0x1234567890123456789012345678901234567890"; // EVM address
const payload = "your message data"; // Your payload as string
```

### Step 2: Encode Receiver Address

Encode the receiver address based on the destination chain:

```typescript
let receiverBytes: Uint8Array;

if (toNetwork === "sepolia") {
  // For EVM chains: 20-byte address
  const addressHex = receiverAddress.replace("0x", "");
  receiverBytes = new Uint8Array(Buffer.from(addressHex, "hex"));
} else {
  // For Casper chains: 32-byte contract hash
  const hashHex = contractHash.replace("hash-", "").trim();
  receiverBytes = new Uint8Array(Buffer.from(hashHex, "hex"));
}
```

### Step 3: Encode Payload

Convert your payload to bytes:

```typescript
const payloadBytes = new TextEncoder().encode(payload);
```

### Step 4: Build CLValues

Create CLValue instances for all arguments:

```typescript
// Build CLValues for proper encoding
const dstChainIdCL = CLValue.newCLUInt32(dstChainId);
const receiverList = Array.from(receiverBytes).map(byte => CLValue.newCLUint8(byte));
const payloadList = Array.from(payloadBytes).map(byte => CLValue.newCLUint8(byte));
const listU8Type = new CLTypeList(CLTypeUInt8);
const receiverCL = CLValue.newCLList(listU8Type, receiverList);
const payloadCL = CLValue.newCLList(listU8Type, payloadList);
const paymentCL = CLValue.newCLUInt512(BigInt(3000000000)); // 3 CSPR in motes
```

### Step 5: Serialize CLValues to Bytes

Extract the serialized bytes from CLValues:

```typescript
// Get serialized bytes from CLValues
const dstChainIdBytesHex = Buffer.from(dstChainIdCL.bytes()).toString('hex');
const receiverBytesHex = Buffer.from(receiverCL.bytes()).toString('hex');
const payloadBytesHex = Buffer.from(payloadCL.bytes()).toString('hex');
const paymentBytesHex = Buffer.from(paymentCL.bytes()).toString('hex');
```

### Step 6: Construct Deploy JSON

Build the deploy JSON structure:

```typescript
// Parse contract hash (remove 'hash-' prefix)
const contractHashStr = CONTRACT_HASH.replace('hash-', '');

if (contractHashStr.length !== 64) {
  throw new Error(`Invalid contract hash length: expected 64 hex chars, got ${contractHashStr.length}`);
}

// Create deploy JSON matching the format expected by Casper Wallet
const deployJson = {
  session: {
    StoredContractByHash: {
      hash: contractHashStr,
      entry_point: "send_message",
      args: [
        [
          "dst_chain_id",
          {
            cl_type: "U32",
            bytes: dstChainIdBytesHex,
            parsed: dstChainId
          }
        ],
        [
          "receiver",
          {
            cl_type: {
              List: "U8"
            },
            bytes: receiverBytesHex,
            parsed: Array.from(receiverBytes)
          }
        ],
        [
          "payload",
          {
            cl_type: {
              List: "U8"
            },
            bytes: payloadBytesHex,
            parsed: Array.from(payloadBytes)
          }
        ]
      ]
    }
  },
  payment: {
    ModuleBytes: {
      module_bytes: "",
      args: [
        [
          "amount",
          {
            cl_type: "U512",
            bytes: paymentBytesHex,
            parsed: "3000000000"
          }
        ]
      ]
    }
  },
  header: {
    account: publicKeyHex, // From connected wallet
    timestamp: new Date().toISOString(),
    ttl: "30m",
    gas_price: 1,
    body_hash: "", // Computed by wallet
    dependencies: [],
    chain_name: "casper-test"
  }
};
```

### Step 7: Sign the Deploy

Request the user to sign the deploy using Casper Wallet:

```typescript
// Sign deploy using Casper Wallet
const signedDeploy = await casperWallet.sign(JSON.stringify(deployJson), publicKey);

if (!signedDeploy) {
  throw new Error("Failed to sign deploy");
}
```

### Step 8: Send to Network

Send the signed deploy to the Casper network:

```typescript
// Send deploy to Casper network using RPC
const response = await fetch(RPC_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "account_put_deploy",
    params: [signedDeploy],
  }),
});

const result = await response.json();

if (result.error) {
  throw new Error(result.error.message || "Failed to send deploy");
}

const deployHash = result.result?.deploy_hash;
console.log(`Transaction sent! Deploy hash: ${deployHash}`);
```

## Complete Example

Here's a complete example of sending a transaction:

```typescript
import {
  CLValue,
  CLTypeList,
  CLTypeUInt8,
} from 'casper-js-sdk';

async function sendMessage(
  casperWallet: any,
  dstChainId: number,
  receiverAddress: string,
  payload: string,
  contractHash: string,
  rpcUrl: string
) {
  // 1. Encode receiver
  const addressHex = receiverAddress.replace("0x", "");
  const receiverBytes = new Uint8Array(Buffer.from(addressHex, "hex"));
  
  // 2. Encode payload
  const payloadBytes = new TextEncoder().encode(payload);
  
  // 3. Build CLValues
  const dstChainIdCL = CLValue.newCLUInt32(dstChainId);
  const receiverList = Array.from(receiverBytes).map(byte => CLValue.newCLUint8(byte));
  const payloadList = Array.from(payloadBytes).map(byte => CLValue.newCLUint8(byte));
  const listU8Type = new CLTypeList(CLTypeUInt8);
  const receiverCL = CLValue.newCLList(listU8Type, receiverList);
  const payloadCL = CLValue.newCLList(listU8Type, payloadList);
  const paymentCL = CLValue.newCLUInt512(BigInt(3000000000));
  
  // 4. Serialize to bytes
  const dstChainIdBytesHex = Buffer.from(dstChainIdCL.bytes()).toString('hex');
  const receiverBytesHex = Buffer.from(receiverCL.bytes()).toString('hex');
  const payloadBytesHex = Buffer.from(payloadCL.bytes()).toString('hex');
  const paymentBytesHex = Buffer.from(paymentCL.bytes()).toString('hex');
  
  // 5. Construct deploy JSON
  const contractHashStr = contractHash.replace('hash-', '');
  const deployJson = {
    session: {
      StoredContractByHash: {
        hash: contractHashStr,
        entry_point: "send_message",
        args: [
          ["dst_chain_id", { cl_type: "U32", bytes: dstChainIdBytesHex, parsed: dstChainId }],
          ["receiver", { cl_type: { List: "U8" }, bytes: receiverBytesHex, parsed: Array.from(receiverBytes) }],
          ["payload", { cl_type: { List: "U8" }, bytes: payloadBytesHex, parsed: Array.from(payloadBytes) }]
        ]
      }
    },
    payment: {
      ModuleBytes: {
        module_bytes: "",
        args: [["amount", { cl_type: "U512", bytes: paymentBytesHex, parsed: "3000000000" }]]
      }
    },
    header: {
      account: casperWallet.publicKey,
      timestamp: new Date().toISOString(),
      ttl: "30m",
      gas_price: 1,
      body_hash: "",
      dependencies: [],
      chain_name: "casper-test"
    }
  };
  
  // 6. Sign
  const signedDeploy = await casperWallet.sign(JSON.stringify(deployJson), casperWallet.publicKey);
  
  // 7. Send
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "account_put_deploy",
      params: [signedDeploy],
    }),
  });
  
  const result = await response.json();
  return result.result?.deploy_hash;
}
```

## CLValue Types Reference

### Common CLValue Types

| Type | Description | Creation Method |
|------|-------------|----------------|
| `U32` | 32-bit unsigned integer | `CLValue.newCLUInt32(value)` |
| `U64` | 64-bit unsigned integer | `CLValue.newCLUInt64(BigInt(value))` |
| `U512` | 512-bit unsigned integer | `CLValue.newCLUInt512(BigInt(value))` |
| `List<U8>` | List of bytes | `CLValue.newCLList(listU8Type, byteList)` |
| `String` | UTF-8 string | `CLValue.newCLString("text")` |
| `ByteArray` | Fixed-size byte array | `CLValue.newCLByteArray(bytes)` |

### Encoding List<U8>

For encoding byte arrays as `List<U8>`:

```typescript
const byteArray = new Uint8Array([1, 2, 3, 4]);
const byteList = Array.from(byteArray).map(byte => CLValue.newCLUint8(byte));
const listU8Type = new CLTypeList(CLTypeUInt8);
const clValue = CLValue.newCLList(listU8Type, byteList);
const bytesHex = Buffer.from(clValue.bytes()).toString('hex');
```

## Troubleshooting

### Error: "arg not valid, got:undefined"

**Cause:** The deploy JSON format is incorrect or CLValues are not properly encoded.

**Solution:**
- Ensure all args have `cl_type` and `bytes` fields
- Use CLValue types to encode values, then extract bytes using `.bytes()`
- Verify contract hash is 64 hex chars (remove 'hash-' prefix)
- Check that receiver and payload are `List<U8>`, not `ByteArray`

### Error: "Transaction data provided is invalid"

**Cause:** The deploy structure doesn't match what the wallet expects.

**Solution:**
- Use `ModuleBytes` for payment, not `StandardPayment`
- Ensure header fields are correct (account, timestamp, ttl, etc.)
- Verify `chain_name` matches the network ("casper-test" for testnet)

### Error: Encoding Mismatch

**Cause:** Manual byte encoding doesn't match CLValue serialization.

**Solution:**
- Always use CLValue types to encode, then extract bytes
- Don't manually encode bytes unless you understand the exact format
- Use `CLValue.bytes()` method to get serialized bytes

## What's Next

At this point, you should be able to send transactions to the Casper network. From here, you can:

- Handle transaction status updates by polling the RPC endpoint
- Listen for transaction completion events
- Implement error handling and retry logic
- Add transaction history tracking

## Reference Implementation

See the complete implementation in:
- `components/universal-counter-swap.tsx` - Frontend transaction sending
- `relayer/src/scripts/test-send-message-casper.ts` - Backend/relayer example

## Additional Resources

- [Casper JS SDK Documentation](https://docs.casperlabs.io/dapp-dev-guide/sdk/casper-js-sdk/)
- [Casper Deploy Format](https://docs.casperlabs.io/concepts/design/casper-design/#deploys)
- [CLValue Types](https://docs.casperlabs.io/concepts/design/casper-design/#clvalue)
- [Casper Wallet Extension](https://www.casperwallet.io/)
