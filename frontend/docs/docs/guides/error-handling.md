# Error Handling

Proper error handling is crucial for reliable cross-chain messaging. KnotX provides clear error codes and validation mechanisms.

## Common Errors

### UnsupportedChain

The destination chain ID is not supported by the gateway.

### InsufficientFee

The provided fee is less than the required base fee.

### AlreadyExecuted

The message has already been executed on the destination chain.

### InvalidSignature

The relayer signature verification failed.

## Error Handling Best Practices

```solidity
// Always check return values
try {
    bytes32 messageId = gateway.sendMessage(...);
    require(messageId != bytes32(0), "Message send failed");
} catch (error) {
    if (error.message.contains("UnsupportedChain")) {
        // Handle unsupported chain
    } else if (error.message.contains("InsufficientFee")) {
        // Handle insufficient fee
    }
    // Log and handle other errors
}

// On receiver side, validate inputs
function onCall(...) external {
    require(msg.sender == gateway, "Unauthorized");
    require(payload.length > 0, "Empty payload");
    
    // Use try-catch for payload decoding
    try {
        (address recipient, uint256 amount) = abi.decode(payload, (address, uint256));
        // Process message
    } catch {
        // Handle decoding errors
        emit InvalidPayload(payload);
    }
}
```


