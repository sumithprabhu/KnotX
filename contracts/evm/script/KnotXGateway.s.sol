// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {KnotXGateway} from "../src/gateway/KnotXGateway.sol";
import {UniversalCounter} from "../apps/UniversalCounter.sol";

contract DeployKnotXGateway is Script {
    KnotXGateway public gateway;
    UniversalCounter public universalCounter;

    // update before deployment
    address public RELAYER = 0x12Fa3607c56ec2cccA5984a8ad7D844D199D315f;
    address public TREASURY = 0x12Fa3607c56ec2cccA5984a8ad7D844D199D315f;
    uint256 public BASE_FEE = 0.0001 ether;

    // example chain ids
    // uint32 public SOLANA_CHAIN_ID = 2;
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
        // gateway.setSupportedChain(SOLANA_CHAIN_ID, true);
        gateway.setSupportedChain(CASPER_CHAIN_ID, true);

        universalCounter = new UniversalCounter(address(gateway));

        vm.stopBroadcast();
    }
}
