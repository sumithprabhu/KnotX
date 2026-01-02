# Sending Messages

Sending messages across chains is straightforward. You need to call the gateway contract on your source chain with the destination chain ID, receiver address, and payload.

## EVM Chains (Solidity)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@knotx/contracts/KnotXGateway.sol";

contract MyContract {
    KnotXGateway public gateway;
    
    constructor(address _gateway) {
        gateway = KnotXGateway(_gateway);
    }
    
    function sendCrossChainMessage(
        uint32 dstChainId,
        address receiver,
        bytes calldata payload
    ) external payable {
        bytes memory receiverBytes = abi.encode(receiver);
        
        bytes32 messageId = gateway.sendMessage{value: msg.value}(
            dstChainId,
            receiverBytes,
            payload
        );
        
        emit MessageSent(messageId, dstChainId);
    }
    
    event MessageSent(bytes32 indexed messageId, uint32 dstChainId);
}
```

## Casper (Rust)

```rust
#[no_mangle]
pub extern "C" fn send_message() {
    let dst_chain_id: u32 = runtime::get_named_arg("dst_chain_id");
    let receiver: Vec<u8> = runtime::get_named_arg("receiver");
    let payload: Vec<u8> = runtime::get_named_arg("payload");
    
    // Get gateway contract hash
    let gateway_hash: ContractHash = runtime::get_named_arg("gateway_hash");
    
    // Call gateway's send_message entry point
    runtime::call_contract(
        gateway_hash,
        "send_message",
        runtime_args! {
            "dst_chain_id" => dst_chain_id,
            "receiver" => receiver,
            "payload" => payload,
        },
    );
}
```

## JavaScript/TypeScript

```javascript
import { ethers } from "ethers";
import { KnotXGateway__factory } from "@knotx/contracts";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const gateway = KnotXGateway__factory.connect(GATEWAY_ADDRESS, wallet);

// Encode receiver address
const receiverBytes = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address"],
  [RECEIVER_ADDRESS]
);

// Send message
const tx = await gateway.sendMessage(
  DESTINATION_CHAIN_ID,
  receiverBytes,
  PAYLOAD,
  { value: ethers.parseEther("0.001") }
);

const receipt = await tx.wait();
const messageId = receipt.logs[0].args.messageId;

console.log("Message ID:", messageId);
```


