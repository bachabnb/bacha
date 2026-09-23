// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaVault} from "../src/BachaVault.sol";

/// @notice Approves reward assets and publishes the opening prize table.
/// @dev    Reads a JSON table so odds never live in Solidity source. Run with
///         BACHA_TABLE_FILE pointing at a file shaped like:
///
///         { "prizes": [ { "token": "0x..", "amount": "1200000000000000000",
///                         "weight": 6800, "rarity": 0 }, ... ],
///           "tiers":  [ { "id": 0, "label": "QUICK", "price": "2600000000000000" }, ... ] }
///
///         Rarity: 0 common, 1 uncommon, 2 rare, 3 epic.
contract PublishTable is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address gameAddr = vm.envAddress("BACHA_GAME_ADDRESS");
        address vaultAddr = vm.envAddress("BACHA_VAULT_ADDRESS");
        string memory path = vm.envString("BACHA_TABLE_FILE");

        string memory json = vm.readFile(path);
        address[] memory tokens = vm.parseJsonAddressArray(json, ".prizes[*].token");
        uint256[] memory amounts = vm.parseJsonUintArray(json, ".prizes[*].amount");
        uint256[] memory weights = vm.parseJsonUintArray(json, ".prizes[*].weight");
        uint256[] memory rarities = vm.parseJsonUintArray(json, ".prizes[*].rarity");

        require(tokens.length == amounts.length, "prizes: length mismatch");
        require(tokens.length == weights.length, "prizes: length mismatch");
        require(tokens.length == rarities.length, "prizes: length mismatch");

        BachaGame game = BachaGame(gameAddr);
        BachaVault vault = BachaVault(vaultAddr);

        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](tokens.length);
        uint256 totalWeight;
        for (uint256 i; i < tokens.length; ++i) {
            require(rarities[i] <= 3, "rarity out of range");
            require(amounts[i] <= type(uint128).max, "amount too large");
            require(weights[i] > 0 && weights[i] <= type(uint32).max, "bad weight");
            prizes[i] = BachaGame.Prize({
                token: tokens[i],
                amount: uint128(amounts[i]),
                weight: uint32(weights[i]),
                rarity: BachaGame.Rarity(uint8(rarities[i]))
            });
            totalWeight += weights[i];
        }

        vm.startBroadcast(pk);

        for (uint256 i; i < tokens.length; ++i) {
            if (!vault.approvedAsset(tokens[i])) {
                vault.setAssetApproved(tokens[i], true);
            }
        }

        uint64 versionId = game.publishPrizeTable(prizes);

        uint256[] memory tierIds = vm.parseJsonUintArray(json, ".tiers[*].id");
        uint256[] memory tierPrices = vm.parseJsonUintArray(json, ".tiers[*].price");
        string[] memory tierLabels = vm.parseJsonStringArray(json, ".tiers[*].label");
        for (uint256 i; i < tierIds.length; ++i) {
            game.configureTier(uint8(tierIds[i]), tierLabels[i], uint96(tierPrices[i]), versionId, true);
        }

        vm.stopBroadcast();

        console2.log("published version", versionId);
        console2.log("total weight     ", totalWeight);
        console2.log("funded spins left", game.remainingFundedSpins(versionId));
    }
}
