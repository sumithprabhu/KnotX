// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {KnotXGateway} from "../src/gateway/KnotXGateway.sol";

contract DeployKnotXGateway is Script {
    KnotXGateway public gateway;

    // update before deployment
    address public RELAYER = 0x1111111111111111111111111111111111111111;
    address public TREASURY = 0x2222222222222222222222222222222222222222;
    uint256 public BASE_FEE = 0.0001 ether;

    // example chain ids
    uint32 public SOLANA_CHAIN_ID = 2;
    uint32 public CASPER_CHAIN_ID = 3;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // deploy gateway
        gateway = new KnotXGateway(
            RELAYER,
            TREASURY,
            BASE_FEE
        );

        // configure supported chains
        gateway.setSupportedChain(SOLANA_CHAIN_ID, true);
        gateway.setSupportedChain(CASPER_CHAIN_ID, true);

        vm.stopBroadcast();
    }
}
