// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IKnotXReceiver {
    function onCall(uint32 srcChainId, bytes memory sender, bytes memory payload) external;
}
