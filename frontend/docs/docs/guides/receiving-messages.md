# Receiving Messages

To receive messages, your contract must implement the IKnotXReceiver interface. The gateway will call your contract's onCall function when a message arrives.

## EVM Receiver Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@knotx/contracts/interfaces/IKnotXReceiver.sol";

contract MyReceiver is IKnotXReceiver {
    event MessageReceived(
        uint32 indexed srcChainId,
        address indexed srcGateway,
        bytes payload
    );
    
    function onCall(
        uint32 srcChainId,
        address srcGateway,
        bytes calldata payload
    ) external override {
        // Verify caller is the gateway
        require(msg.sender == GATEWAY_ADDRESS, "Unauthorized");
        
        // Process the message
        // Decode payload and execute your logic
        (string memory message) = abi.decode(payload, (string));
        
        emit MessageReceived(srcChainId, srcGateway, payload);
        
        // Your custom logic here
        processMessage(message);
    }
    
    function processMessage(string memory message) internal {
        // Handle the received message
    }
}
```

## Casper Receiver Contract

```rust
#[no_mangle]
pub extern "C" fn on_call() {
    let src_chain_id: u32 = runtime::get_named_arg("src_chain_id");
    let src_gateway: Vec<u8> = runtime::get_named_arg("src_gateway");
    let payload: Vec<u8> = runtime::get_named_arg("payload");
    
    // Verify caller is the gateway
    let gateway_hash: ContractHash = runtime::get_named_arg("gateway_hash");
    let caller = runtime::get_caller();
    runtime::revert_if(caller != gateway_hash, Error::Unauthorized);
    
    // Process the message
    process_message(src_chain_id, &src_gateway, &payload);
}

fn process_message(src_chain_id: u32, src_gateway: &[u8], payload: &[u8]) {
    // Your custom logic here
    // Decode payload and execute business logic
}
```


