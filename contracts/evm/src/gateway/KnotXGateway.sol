// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IKnotXReceiver.sol";
import "../libs/MessageHash.sol";
import "../libs/SignatureVerifier.sol";
import "./KnotXGatewayErrors.sol";
import "./KnotXGatewayEvents.sol";

contract KnotXGateway is Ownable {
    // STORAGE
    uint64 public nonce;
    uint256 public baseFee;

    address public relayer;
    address public treasury;

    mapping(uint32 => bool) public supportedChains;
    mapping(bytes32 => bool) public executedMessages;

    // CONSTRUCTOR
    constructor(
        address _relayer,
        address _treasury,
        uint256 _baseFee
    ) Ownable(msg.sender) {
        relayer = _relayer;
        treasury = _treasury;
        baseFee = _baseFee;
    }

    // ADMIN FUNCTIONS
    function setSupportedChain(uint32 chainId, bool supported) external onlyOwner {
        supportedChains[chainId] = supported;
    }

    function setRelayer(address newRelayer) external onlyOwner {
        relayer = newRelayer;
    }

    function setBaseFee(uint256 newFee) external onlyOwner {
        baseFee = newFee;
    }

    // SOURCE CHAIN LOGIC
    function sendMessage(
        uint32 dstChainId,
        bytes calldata receiver,
        bytes calldata payload
    )
        external
        payable
        returns (bytes32 messageId)
    {
        if (!supportedChains[dstChainId]) revert UnsupportedChain();
        if (msg.value < baseFee) revert InsufficientFee();

        uint64 currentNonce = ++nonce;

        messageId = MessageHash.compute(
            uint32(block.chainid),
            dstChainId,
            abi.encodePacked(msg.sender),
            receiver,
            currentNonce,
            payload
        );

        emit MessageSent(
            messageId,
            dstChainId,
            receiver,
            abi.encodePacked(msg.sender),
            currentNonce,
            payload
        );

        (bool sent,) = treasury.call{value: msg.value}("");
        require(sent, "Fee transfer failed");
    }

    // DESTINATION CHAIN LOGIC
    function executeMessage(
        uint32 srcChainId,
        bytes calldata sender,
        bytes calldata receiver,
        uint64 messageNonce,
        bytes calldata payload,
        bytes calldata relayerSignature
    ) external {
        bytes32 messageId = MessageHash.compute(
            srcChainId,
            uint32(block.chainid),
            sender,
            receiver,
            messageNonce,
            payload
        );

        if (executedMessages[messageId]) revert AlreadyExecuted();

        SignatureVerifier.verify(relayer, messageId, relayerSignature);

        executedMessages[messageId] = true;

        // EVM-SPECIFIC DECODING (ONLY HERE)
        address receiverAddress = abi.decode(receiver, (address));

        IKnotXReceiver(receiverAddress).onCall(
            srcChainId,
            sender,
            payload
        );

        emit MessageExecuted(
            messageId,
            srcChainId,
            receiver
        );
    }
}
