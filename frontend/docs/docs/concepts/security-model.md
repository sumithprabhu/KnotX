# Security Model

KnotX implements multiple layers of security to ensure message integrity and prevent attacks.

## Cryptographic Verification

Every message execution requires a valid signature from a trusted relayer. The destination gateway verifies the signature before executing the message:

```solidity
// Signature verification in gateway
function executeMessage(...) external {
    bytes32 messageId = MessageHash.compute(...);
    
    // Verify relayer signature
    SignatureVerifier.verify(relayer, messageId, relayerSignature);
    
    // Check for replay attacks
    require(!executedMessages[messageId], "AlreadyExecuted");
    executedMessages[messageId] = true;
    
    // Execute message
    IKnotXReceiver(receiver).onCall(...);
}
```

## Replay Protection

Each message has a unique ID computed from all message parameters. Once executed, the message ID is stored in the executedMessages mapping, preventing duplicate executions:

```solidity
mapping(bytes32 => bool) public executedMessages;

function executeMessage(...) external {
    bytes32 messageId = MessageHash.compute(
        srcChainId,
        dstChainId,
        srcGateway,
        receiver,
        nonce,
        payload
    );
    
    require(!executedMessages[messageId], "AlreadyExecuted");
    executedMessages[messageId] = true;
    // ... rest of execution
}
```

## Access Control

- Only the owner can modify gateway configuration (supported chains, relayer address, fees)
- Receiver contracts must verify the caller is the gateway contract
- Relayer addresses are set by the owner and can be updated for security
- Fee collection goes to a treasury address controlled by the owner

## Chain Validation

Before sending a message, the gateway checks if the destination chain is supported. This prevents sending messages to unsupported or malicious chains.


