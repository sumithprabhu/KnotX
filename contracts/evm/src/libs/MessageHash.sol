// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library MessageHash {
    function compute(
        uint32 srcChainId,
        uint32 dstChainId,
        address srcGateway,
        bytes memory receiver,
        uint64 nonce,
        bytes memory payload
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(srcChainId, dstChainId, srcGateway, keccak256(receiver), nonce, keccak256(payload)));
    }
}
