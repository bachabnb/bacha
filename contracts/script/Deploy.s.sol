// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaRandomness} from "../src/BachaRandomness.sol";
import {CliSigner} from "./CliSigner.sol";

/// @notice Deploys the Bacha game — and the randomness beacon too, unless an
///         existing one is given — wired to PancakeSwap on BNB Chain.
/// @dev    Stops short of approving assets, publishing a table or funding the
///         bankroll: those are the admin's, in Configure and PublishTable.
///
///         Signer: `--account <keystore>` or `--ledger` on the command line.
///
///         Required environment:
///           BACHA_ADMIN               receives every game role — a multisig or
///                                     cold wallet, never the deployer
///           BACHA_RANDOMNESS_ADDRESS  an existing beacon to reuse; leave unset
///                                     to deploy a new one (then BACHA_COMMITTER
///                                     is required)
contract Deploy is CliSigner {
    // PancakeSwap on BNB Smart Chain.
    address internal constant V2_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address internal constant V3_SMART_ROUTER = 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4;
    address internal constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    function run() external returns (BachaGame game, BachaRandomness randomness) {
        address admin = vm.envAddress("BACHA_ADMIN");
        address existing = vm.envOr("BACHA_RANDOMNESS_ADDRESS", address(0));
        require(block.chainid == 56, "PancakeSwap addresses are for BNB Smart Chain (56)");

        address deployer = _startBroadcast();
        console2.log("deployer     ", deployer);
        console2.log("admin        ", admin);

        if (existing == address(0)) {
            address committer = vm.envAddress("BACHA_COMMITTER");
            randomness = new BachaRandomness(deployer, committer);
            randomness.grantRole(randomness.DEFAULT_ADMIN_ROLE(), admin);
            if (admin != deployer) randomness.renounceRole(randomness.DEFAULT_ADMIN_ROLE(), deployer);
            console2.log("new beacon    committer", committer);
        } else {
            randomness = BachaRandomness(existing);
            console2.log("reusing beacon");
        }

        game = new BachaGame(admin, address(randomness), V2_ROUTER, V3_SMART_ROUTER, WBNB);

        vm.stopBroadcast();

        console2.log("BACHA_GAME_ADDRESS      ", address(game));
        console2.log("BACHA_RANDOMNESS_ADDRESS", address(randomness));
        console2.log("");
        console2.log("Next (admin): Configure, then PublishTable, then fund the bankroll.");
    }
}
