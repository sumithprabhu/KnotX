// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/interfaces/IKnotXReceiver.sol";

contract UniversalCounter is IKnotXReceiver {
    uint256 public counter;
    address public immutable gateway;

    // how many messages came from each source chain
    mapping(uint32 => uint256) public incrementsByChain;

    // total value added by each source chain
    mapping(uint32 => uint256) public valueByChain;

    modifier onlyGateway() {
        require(msg.sender == gateway, "Only gateway");
        _;
    }

    constructor(address _gateway) {
        gateway = _gateway;
    }

    function onCall(
        uint32 srcChainId,
        address,
        bytes calldata payload
    ) external override onlyGateway {
        uint256 amount = abi.decode(payload, (uint256));

        counter += amount;
        incrementsByChain[srcChainId] += 1;
        valueByChain[srcChainId] += amount;
    }
}
