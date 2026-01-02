# Relayer System

The relayer is a critical component that bridges messages between chains. It operates as a service that monitors source chains and delivers messages to destination chains.

## Relayer Responsibilities

### Event Listening

Continuously monitors source chain gateways for MessageSent events using WebSocket or polling mechanisms. Maintains connection health and handles reconnection logic.

### Message Validation

Validates message structure, checks destination chain support, verifies payload integrity, and ensures nonce ordering. Rejects invalid or duplicate messages.

### Message Routing

Routes validated messages to the appropriate destination chain sender (EVM, Solana, or Casper) based on the destination chain ID. Handles chain-specific encoding and transaction submission.

### Signature Generation

Signs each message with the relayer's private key before submission. The signature proves the message was processed by an authorized relayer and prevents tampering.

## Relayer Architecture

```typescript
// Relayer execution flow
class RelayExecutor {
  async execute(message: RelayMessage): Promise<RelayResult> {
    // 1. Validate message
    const validation = RelayValidator.validate(message);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // 2. Check for duplicates
    const existing = await Message.findOne({ messageId });
    if (existing) {
      return existing.status === DELIVERED 
        ? { success: true } 
        : { success: false };
    }
    
    // 3. Store as PENDING
    await Message.create({ ...message, status: PENDING });
    
    // 4. Route to destination chain
    const result = await this.router.route(message);
    
    // 5. Update status
    if (result.success) {
      message.status = DELIVERED;
      message.transactionHash = result.txHash;
    } else {
      message.status = FAILED;
      message.error = result.error;
    }
    
    return result;
  }
}
```

## Running Your Own Relayer

You can run your own relayer for better control and reliability. Here's how to set it up:

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Set RELAYER_PRIVATE_KEY, RPC_URLs, MONGODB_URI, etc.

# Start the relayer
npm run start

# Or in development mode
npm run dev
```

The relayer will automatically start listening for messages on all configured source chains and route them to their destinations. Monitor logs and metrics to ensure reliable operation.


