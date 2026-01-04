# Comparison: Relayer Script vs Frontend

## Relayer Script (test-send-message-casper.ts) - WORKING ✅

```typescript
// Inputs
const DST_CHAIN_ID = 11155111; // Sepolia
const RECEIVER_HEX = '12345678910987654321'; // 20 bytes hex
const receiverBytes = Buffer.from(RECEIVER_HEX, 'hex'); // 20 bytes
const RECEIVER = new Uint8Array(32);
RECEIVER.set(receiverBytes, 0); // 32 bytes: 20 bytes at start, 12 zeros
const PAYLOAD = new TextEncoder().encode('hello world');

// CLValues
const receiverList = Array.from(RECEIVER).map(byte => CLValue.newCLUint8(byte));
const payloadList = Array.from(PAYLOAD).map(byte => CLValue.newCLUint8(byte));
const listU8Type = new CLTypeList(CLTypeUInt8);

// Runtime Args
const runtimeArgs = Args.fromMap({
  dst_chain_id: CLValue.newCLUInt32(DST_CHAIN_ID),
  receiver: CLValue.newCLList(listU8Type, receiverList),
  payload: CLValue.newCLList(listU8Type, payloadList),
});

// Transaction
const transaction = new ContractCallBuilder()
  .from(publicKey)
  .byHash(contractHashStr)
  .entryPoint('send_message')
  .runtimeArgs(runtimeArgs)
  .chainName('casper-test')
  .payment(3_000_000_000)
  .buildFor1_5();

// Sign and send
transaction.sign(privateKey);
await rpcClient.putTransaction(transaction);
```

## Frontend (universal-counter-swap.tsx) - CURRENT ❌

```typescript
// Inputs (when toNetwork === "sepolia")
const dstChainId = SEPOLIA_CHAIN_ID; // 11155111 ✅
const addressHex = SEPOLIA_RECEIVER_ADDRESS.replace("0x", ""); // 20 bytes hex ✅
const addressBytes = Buffer.from(addressHex, "hex"); // 20 bytes ✅
receiverBytes = new Uint8Array(32); // 32 bytes ✅
receiverBytes.set(addressBytes, 0); // 32 bytes: 20 bytes at start, 12 zeros ✅
const payloadBytes = new TextEncoder().encode(value.toString()); ✅

// CLValues
const receiverList = Array.from(receiverBytes).map(byte => CLValue.newCLUint8(byte)); ✅
const payloadList = Array.from(payloadBytes).map(byte => CLValue.newCLUint8(byte)); ✅
const listU8Type = new CLTypeList(CLTypeUInt8); ✅

// Runtime Args
const runtimeArgs = Args.fromMap({
  dst_chain_id: dstChainIdCL, // CLValue.newCLUInt32(dstChainId) ✅
  receiver: receiverCL, // CLValue.newCLList(listU8Type, receiverList) ✅
  payload: payloadCL, // CLValue.newCLList(listU8Type, payloadList) ✅
});

// Transaction
const transaction = new ContractCallBuilder()
  .from(publicKey) ✅
  .byHash(contractHashStr) ✅
  .entryPoint('send_message') ✅
  .runtimeArgs(runtimeArgs) ✅
  .chainName('casper-test') ✅
  .payment(3_000_000_000) ✅
  .buildFor1_5(); ✅

// Get deploy and convert to JSON
const deploy = transaction.getDeploy();
let deployJson = Deploy.toJSON(deploy);
// Fix cl_type for List args
// Remove hash, approvals, body_hash
// Send to wallet.sign()
```

## Key Differences

1. **Relayer signs directly**: `transaction.sign(privateKey)` then `putTransaction(transaction)`
2. **Frontend converts to JSON**: `Deploy.toJSON(deploy)` then `wallet.sign(deployJsonString)`

## Potential Issues

The frontend is doing extra steps that might be causing issues:
- Converting deploy to JSON with `Deploy.toJSON()`
- Fixing `cl_type` structure
- Removing `hash`, `approvals`, `body_hash`

The relayer doesn't do any of these - it just signs the transaction directly.

