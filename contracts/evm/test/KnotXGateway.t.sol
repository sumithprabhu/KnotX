// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {KnotXGateway} from "../src/gateway/KnotXGateway.sol";
import "../src/gateway/KnotXGatewayEvents.sol";
import {IKnotXReceiver} from "../src/interfaces/IKnotXReceiver.sol";
import {MessageHash} from "../src/libs/MessageHash.sol";

// Mock receiver used to verify onCall execution
contract MockReceiver is IKnotXReceiver {
    uint256 public counter;
    uint32 public lastSrcChain;
    address public lastSrcGateway;

    function onCall(uint32 srcChainId, address srcGateway, bytes calldata payload) external override {
        lastSrcChain = srcChainId;
        lastSrcGateway = srcGateway;

        uint256 amount = abi.decode(payload, (uint256));
        counter += amount;
    }
}

contract KnotXGatewayTest is Test {
    KnotXGateway public gateway;
    MockReceiver public receiver;

    address relayer;
    uint256 relayerPk;
    address treasury;

    uint32 constant DST_CHAIN_ID = 999;

    function setUp() public {
        relayerPk = 0xA11CE;
        relayer = vm.addr(relayerPk);
        treasury = makeAddr("treasury");

        gateway = new KnotXGateway(relayer, treasury, 0.01 ether);

        receiver = new MockReceiver();

        gateway.setSupportedChain(DST_CHAIN_ID, true);
    }

    // sendMessage should emit event, increment nonce and transfer fee
    function test_sendMessage_emitsEventAndPaysFee() public {
        bytes memory receiverBytes = abi.encode(address(receiver));
        bytes memory payload = abi.encode(uint256(1));

        uint256 treasuryBalanceBefore = treasury.balance;

        bytes32 expectedMessageId =
            MessageHash.compute(uint32(block.chainid), DST_CHAIN_ID, address(gateway), receiverBytes, 1, payload);

        vm.expectEmit(true, true, false, true);
        emit MessageSent(expectedMessageId, DST_CHAIN_ID, receiverBytes, 1, payload);

        gateway.sendMessage{value: 0.01 ether}(DST_CHAIN_ID, receiverBytes, payload);

        assertEq(treasury.balance, treasuryBalanceBefore + 0.01 ether);
        assertEq(gateway.nonce(), 1);
    }

    // executeMessage should verify signature and call receiver
    function test_executeMessage_success() public {
        bytes memory receiverBytes = abi.encode(address(receiver));
        bytes memory payload = abi.encode(uint256(5));
        uint64 nonce = 1;

        bytes32 messageId =
            MessageHash.compute(uint32(1), uint32(block.chainid), address(0xBEEF), receiverBytes, nonce, payload);

        bytes memory sig = _sign(messageId);

        gateway.executeMessage(1, address(0xBEEF), receiverBytes, nonce, payload, sig);

        assertEq(receiver.counter(), 5);
        assertTrue(gateway.executedMessages(messageId));
    }

    // executeMessage should revert on replayed message
    function test_executeMessage_revertOnReplay() public {
        bytes memory receiverBytes = abi.encode(address(receiver));
        bytes memory payload = abi.encode(uint256(1));
        uint64 nonce = 1;

        bytes32 messageId =
            MessageHash.compute(1, uint32(block.chainid), address(0xCAFE), receiverBytes, nonce, payload);

        bytes memory sig = _sign(messageId);

        gateway.executeMessage(1, address(0xCAFE), receiverBytes, nonce, payload, sig);

        vm.expectRevert();
        gateway.executeMessage(1, address(0xCAFE), receiverBytes, nonce, payload, sig);
    }

    // executeMessage should revert if relayer signature is invalid
    function test_executeMessage_revertOnInvalidSignature() public {
        bytes memory receiverBytes = abi.encode(address(receiver));
        bytes memory payload = abi.encode(uint256(1));
        uint64 nonce = 1;

        bytes32 messageId =
            MessageHash.compute(1, uint32(block.chainid), address(0xDEAD), receiverBytes, nonce, payload);

        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageId));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert();
        gateway.executeMessage(1, address(0xDEAD), receiverBytes, nonce, payload, badSig);
    }

    // helper to sign messageId with relayer key
    function _sign(bytes32 messageId) internal returns (bytes memory) {
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageId));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(relayerPk, ethHash);
        return abi.encodePacked(r, s, v);
    }
}
