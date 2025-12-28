// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

event MessageSent(bytes32 indexed messageId, uint32 indexed dstChainId, bytes receiver, uint64 nonce, bytes payload);

event MessageExecuted(bytes32 indexed messageId, uint32 indexed srcChainId, bytes receiver);
