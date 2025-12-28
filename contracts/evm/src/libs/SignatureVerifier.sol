// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../gateway/KnotXGatewayErrors.sol";

library SignatureVerifier {
    function verify(address expectedSigner, bytes32 messageId, bytes calldata signature) internal pure {
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageId));

        (bytes32 r, bytes32 s, uint8 v) = _split(signature);
        address recovered = ecrecover(ethHash, v, r, s);

        if (recovered != expectedSigner) revert InvalidSignature();
    }

    function _split(bytes calldata sig) private pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
    }
}
