# Message Flow

Understanding the complete message flow helps you build reliable cross-chain applications. Here's the step-by-step process:

## 1. Message Initiation

Your contract calls the source gateway's sendMessage function with destination chain ID, receiver address, and payload. The gateway increments its nonce and computes a unique message ID using keccak256 hash of all message parameters.

## 2. Event Emission

The gateway emits a MessageSent event containing messageId, destinationChain, receiver, nonce, and payload. This event is indexed by the relayer for processing.

## 3. Relayer Processing

The relayer listens for MessageSent events, validates the message structure, checks destination chain support, and computes the message hash. It then signs the message with its private key to create a relayer signature.

## 4. Destination Execution

The relayer calls executeMessage on the destination gateway with source chain ID, source gateway address, receiver, nonce, payload, and relayer signature. The gateway verifies the signature and checks for replay attacks using the message ID.

## 5. Receiver Callback

Upon successful validation, the gateway decodes the receiver address and calls the onCall function on your receiver contract, passing source chain ID, source gateway, and payload. Your contract can then process the message according to your business logic.


