// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {console2} from "forge-std/Script.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {CliSigner} from "./CliSigner.sol";

/// @notice The admin's one-time setup after Deploy: prize ceilings and the two
///         worker roles. Run before PublishTable.
/// @dev    Ceilings are what bound a stolen operator key — it can publish a
///         table, but never one with a prize above the ceiling for that asset.
///         They are set at BACHA_CEILING_MULTIPLE (default 2) times the largest
///         entry for each asset in BACHA_TABLE_FILE: room for the solvency
///         governor to scale prizes up, and no more.
///
///         Required environment:
///           BACHA_GAME_ADDRESS   game printed by Deploy
///           BACHA_TABLE_FILE     the table about to be published
///           BACHA_TREASURY       treasury worker address — gets game TREASURER_ROLE
///           BACHA_OPERATOR       solvency governor address — gets game OPERATOR_ROLE
///
///         Signer: the admin, via `--account` or `--ledger`.
contract Configure is CliSigner {
    function run() external {
        BachaGame game = BachaGame(vm.envAddress("BACHA_GAME_ADDRESS"));
        address treasury = vm.envAddress("BACHA_TREASURY");
        address operator = vm.envAddress("BACHA_OPERATOR");
        uint256 multiple = vm.envOr("BACHA_CEILING_MULTIPLE", uint256(2));
        require(multiple >= 1 && multiple <= 10, "ceiling multiple out of range");

        string memory json = vm.readFile(vm.envString("BACHA_TABLE_FILE"));

        // Largest amount per distinct asset.
        address[] memory tokens = new address[](64);
        uint256[] memory maxima = new uint256[](64);
        uint256 distinct;
        for (uint256 i; vm.keyExistsJson(json, string.concat(".prizes[", vm.toString(i), "]")); ++i) {
            string memory at = string.concat(".prizes[", vm.toString(i), "]");
            address token = vm.parseJsonAddress(json, string.concat(at, ".token"));
            uint256 amount = vm.parseJsonUint(json, string.concat(at, ".amount"));
            uint256 j;
            while (j < distinct && tokens[j] != token) ++j;
            if (j == distinct) tokens[distinct++] = token;
            if (amount > maxima[j]) maxima[j] = amount;
        }
        require(distinct > 0, "table has no prizes");

        _startBroadcast();

        for (uint256 j; j < distinct; ++j) {
            game.setPrizeCeiling(tokens[j], maxima[j] * multiple);
            console2.log("ceiling", tokens[j], maxima[j] * multiple);
        }
        game.grantRole(game.TREASURER_ROLE(), treasury);
        game.grantRole(game.OPERATOR_ROLE(), operator);

        vm.stopBroadcast();

        console2.log("treasurer role ->", treasury);
        console2.log("operator role  ->", operator);
    }
}
