# Messaging Overview

KnotX Messaging enables secure, trustless communication between different blockchain networks. Send messages, data, and execute cross-chain operations with cryptographic guarantees and enterprise-grade reliability.

## How It Works

1. **Message Initiation**: Your application calls the source chain gateway contract with a message payload and destination chain ID.

2. **Event Emission**: The gateway emits a MessageSent event with a unique message ID and nonce.

3. **Relayer Processing**: The relayer listens for events, validates the message, and routes it to the destination chain.

4. **Destination Execution**: The destination gateway verifies the relayer signature and executes the message on the receiver contract.

## Key Features

### Universal Protocol

Works across EVM chains, Solana, Casper, and traditional systems with a unified interface.

### Cryptographic Security

Every message is cryptographically verified with signature-based authentication.


