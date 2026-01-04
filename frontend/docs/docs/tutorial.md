# Universal Counter Tutorial

This tutorial demonstrates how to build a cross-chain counter application using KnotX Messaging. The counter can be incremented from any supported chain, and the value is synchronized across all chains.

## Overview

The Universal Counter is a simple but powerful example that shows:
- How to send messages from one chain to another
- How to receive and process messages on the destination chain
- How the relayer system bridges messages between chains

## Architecture

```
Source Chain (Sepolia)          Destination Chain (Casper)
┌─────────────────┐              ┌─────────────────┐
│  User Contract  │              │  Counter        │
│  (calls gateway)│              │  (receives msg)  │
└────────┬────────┘              └────────▲────────┘
         │                                 │
         │ sendMessage()                   │ onCall()
         ▼                                 │
┌─────────────────┐              ┌─────────┴─────────┐
│  Gateway        │              │  Gateway          │
│  (emits event)  │              │  (executes msg)   │
└────────┬────────┘              └───────────────────┘
         │
         │ MessageSent Event
         ▼
┌─────────────────┐
│  Relayer        │
│  (listens &     │
│   executes)     │
└─────────────────┘
```

## Receiver Contracts

### Sepolia (EVM) Receiver Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/interfaces/IKnotXReceiver.sol";

contract UniversalCounter is IKnotXReceiver {
    uint256 public counter;
    address public immutable gateway;

    mapping(uint32 => uint256) public incrementsByChain;
    mapping(uint32 => uint256) public valueByChain;

    modifier onlyGateway() {
        require(msg.sender == gateway, "Only gateway");
        _;
    }

    constructor(address _gateway) {
        gateway = _gateway;
    }

    function onCall(
        uint32 srcChainId,
        bytes memory sender,
        bytes memory payload
    ) external override onlyGateway {
        uint256 amount = abi.decode(payload, (uint256));

        counter += amount;
        incrementsByChain[srcChainId] += 1;
        valueByChain[srcChainId] += amount;
    }
}
```

**Contract Address (Sepolia Testnet):**
```
0xD3B1c72361f03d5F138C2c768AfdF700266bb39a
```

### Casper Receiver Contract

The Casper receiver contract implements the same logic in Rust:

```rust
#[contract]
mod universal_counter {
    use casper_types::{runtime_args, ContractHash, RuntimeArgs, U256};
    use casper_contract::contract_api::{runtime, storage};

    const COUNTER_KEY: &str = "count";
    const GATEWAY_KEY: &str = "gateway";

    #[init]
    fn init() {
        let gateway: ContractHash = runtime::get_named_arg("gateway");
        storage::new_dictionary(GATEWAY_KEY).unwrap();
        storage::dictionary_put(
            storage::dictionary_get(GATEWAY_KEY).unwrap(),
            "hash",
            gateway,
        );
        storage::new_uref(U256::zero()).into();
    }

    #[no_mangle]
    pub extern "C" fn on_call() {
        // Verify caller is gateway
        let gateway: ContractHash = storage::dictionary_get(
            storage::dictionary_get(GATEWAY_KEY).unwrap(),
            "hash",
        )
        .unwrap();
        
        // Decode payload (uint256)
        let amount: U256 = runtime::get_named_arg("amount");
        
        // Update counter
        let counter: U256 = storage::read_local(COUNTER_KEY)
            .unwrap()
            .unwrap();
        let new_counter = counter + amount;
        storage::write_local(COUNTER_KEY, new_counter);
    }
}
```

**Contract Hash (Casper Testnet):**
```
hash-2ede3272d048e81c344c68f65db55141e1132d70da6443770ac0de443534d36e
```

## Step-by-Step Guide

### Step 1: Connect Your Wallet

1. Connect your wallet to the source chain (e.g., Sepolia)
2. Ensure you have test tokens for gas fees

### Step 2: Prepare the Message

Encode the increment value as the payload:

```javascript
import { ethers } from "ethers";

// Encode the increment amount (e.g., increment by 5)
const incrementAmount = 5;
const payload = ethers.AbiCoder.defaultAbiCoder().encode(
  ["uint256"],
  [incrementAmount]
);
```

### Step 3: Send the Message

Call the gateway's `sendMessage` function:

```javascript
const gateway = new ethers.Contract(
  "0xe6F75A8E2d21EeFD33A5ecA76215bB20DbE0bb1F", // Sepolia Gateway
  GATEWAY_ABI,
  signer
);

// Destination: Casper Testnet (chain ID = 3)
const casperReceiverHash = "2ede3272d048e81c344c68f65db55141e1132d70da6443770ac0de443534d36e";
const receiver = ethers.hexlify(ethers.getBytes("0x" + casperReceiverHash));

const tx = await gateway.sendMessage(
  3, // Casper Testnet chain ID
  receiver,
  payload,
  { value: ethers.parseEther("0.001") } // Base fee
);

await tx.wait();
console.log("Message sent! The relayer will process it.");
```

### Step 4: Monitor the Result

The relayer will:
1. Detect the `MessageSent` event
2. Validate the message signature
3. Execute the message on Casper
4. Call the receiver's `onCall` function
5. Increment the counter

You can check the counter value on the destination chain:

```javascript
// On Casper, query the counter
const counter = await casperRpc.queryGlobalState(
  "hash-2ede3272d048e81c344c68f65db55141e1132d70da6443770ac0de443534d36e",
  ["count"]
);
```

## Testing the Counter

You can test the Universal Counter using our interactive demo:

<div className="text-center margin-vert--lg">
  <a 
    href="/demo" 
    className="button button--primary button--lg"
  >
    Try Universal Counter Demo →
  </a>
</div>

## Key Concepts

### Message Flow

1. **Source Chain**: Your contract calls `gateway.sendMessage()`
2. **Gateway**: Emits `MessageSent` event with message details
3. **Relayer**: Listens for events, validates, and routes messages
4. **Destination Gateway**: Verifies relayer signature
5. **Receiver**: Executes `onCall()` with the payload

### Payload Encoding

The payload must be ABI-encoded according to your receiver contract's expectations:

- **EVM**: Use `ethers.AbiCoder` or `web3.eth.abi.encodeParameter()`
- **Casper**: Use CLValue encoding from `casper-js-sdk`

### Security

- Messages are cryptographically signed by the relayer
- Gateways verify signatures before execution
- Only authorized gateways can call receiver contracts

## Next Steps

- Learn about [message format](/docs/guides/message-format)
- Understand [security model](/docs/concepts/security-model)
- Explore [architecture](/docs/concepts/architecture)
- Check [contract addresses](/docs/contracts)
