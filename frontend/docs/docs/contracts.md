# Contract Addresses

This page contains all deployed KnotX contract addresses across different networks.

## Gateway Contracts

| Mainnet | Testnet | Network | Address | Solidity/Event |
|---------|---------|---------|---------|----------------|
| Coming Soon | ✅ | Ethereum Sepolia | `0xe6F75A8E2d21EeFD33A5ecA76215bB20DbE0bb1F` | [Interface](/docs/guides/sending-messages) |
| Coming Soon | ✅ | Casper Testnet | `hash-4ce6b9ec80fde0158f7ab13f37cff883660048c1d457e9e48130cc884ce83073` | [Interface](/docs/guides/sending-messages) |

## Contract Interfaces

### Gateway Interface (EVM)

```solidity
interface IKnotXGateway {
    function sendMessage(
        uint32 dstChainId,
        bytes memory receiver,
        bytes memory payload
    ) external payable returns (bytes32 messageId);
    
    function executeMessage(
        uint32 srcChainId,
        bytes memory sender,
        bytes memory receiver,
        uint64 messageNonce,
        bytes memory payload,
        bytes memory relayerSignature
    ) external;
}

event MessageSent(
    bytes32 indexed messageId,
    uint32 dstChainId,
    bytes receiver,
    bytes sender,
    uint64 nonce,
    bytes payload
);
```

### Receiver Interface

```solidity
interface IKnotXReceiver {
    function onCall(
        uint32 srcChainId,
        bytes memory sender,
        bytes memory payload
    ) external;
}
```

## Chain IDs

| Chain | Chain ID |
|-------|----------|
| Ethereum Sepolia | `11155111` |
| Casper Testnet | `3` |
| Ethereum Mainnet | `1` (Coming Soon) |
| Casper Mainnet | `2` (Coming Soon) |

## Verification

All contracts are verified on their respective block explorers:

- **Sepolia**: [Etherscan](https://sepolia.etherscan.io)
- **Casper**: [Casper Explorer](https://testnet.cspr.live)

## Getting Started

To interact with these contracts:

1. Import the contract interfaces into your project
2. Connect to the appropriate network RPC endpoint
3. Use the contract addresses above
4. Follow the [Get Started guide](/docs/get-started)

For detailed examples, see the [Universal Counter Tutorial](/docs/tutorial).

