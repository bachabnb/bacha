// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaVault} from "../src/BachaVault.sol";
import {CliSigner} from "./CliSigner.sol";

/// @notice Approves reward assets and publishes the opening prize table.
/// @dev    Reads a JSON table so odds never live in Solidity source. Run with
///         BACHA_TABLE_FILE pointing at a file shaped like:
///
///         { "prizes": [ { "token": "0x..", "amount": "1200000000000000000",
///                         "weight": 6800, "rarity": 0 }, ... ],
///           "tiers":  [ { "id": 0, "label": "QUICK", "price": "2600000000000000" }, ... ] }
///
///         Rarity: 0 common, 1 uncommon, 2 rare, 3 epic.
///
///         The signer must hold vault admin and game OPERATOR_ROLE — the admin.
contract PublishTable is CliSigner {
    function run() external {
        address gameAddr = vm.envAddress("BACHA_GAME_ADDRESS");
        address vaultAddr = vm.envAddress("BACHA_VAULT_ADDRESS");
        string memory path = vm.envString("BACHA_TABLE_FILE");

        string memory json = vm.readFile(path);

        // Read entry by entry. A `[*]` wildcard path yields several values,
        // which current forge refuses to decode as a single array.
        uint256 n = _count(json, ".prizes");
        uint256 t = _count(json, ".tiers");
        require(n > 0, "prizes: empty");

        BachaGame game = BachaGame(gameAddr);
        BachaVault vault = BachaVault(vaultAddr);

        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](n);
        address[] memory tokens = new address[](n);
        uint256 totalWeight;
        for (uint256 i; i < n; ++i) {
            string memory at = string.concat(".prizes[", vm.toString(i), "]");
            tokens[i] = vm.parseJsonAddress(json, string.concat(at, ".token"));
            uint256 amount = vm.parseJsonUint(json, string.concat(at, ".amount"));
            uint256 weight = vm.parseJsonUint(json, string.concat(at, ".weight"));
            uint256 rarity = vm.parseJsonUint(json, string.concat(at, ".rarity"));

            require(rarity <= 3, "rarity out of range");
            require(amount > 0 && amount <= type(uint128).max, "bad amount");
            require(weight > 0 && weight <= type(uint32).max, "bad weight");
            prizes[i] = BachaGame.Prize({
                token: tokens[i],
                amount: uint128(amount),
                weight: uint32(weight),
                rarity: BachaGame.Rarity(uint8(rarity))
            });
            totalWeight += weight;
        }

        _startBroadcast();

        for (uint256 i; i < tokens.length; ++i) {
            if (!vault.approvedAsset(tokens[i])) {
                vault.setAssetApproved(tokens[i], true);
            }
        }

        uint64 versionId = game.publishPrizeTable(prizes);

        for (uint256 i; i < t; ++i) {
            string memory at = string.concat(".tiers[", vm.toString(i), "]");
            uint256 id = vm.parseJsonUint(json, string.concat(at, ".id"));
            uint256 price = vm.parseJsonUint(json, string.concat(at, ".price"));
            require(id <= type(uint8).max && price <= type(uint96).max, "bad tier");
            game.configureTier(uint8(id), vm.parseJsonString(json, string.concat(at, ".label")), uint96(price), versionId, true);
        }

        vm.stopBroadcast();

        console2.log("published version", versionId);
        console2.log("total weight     ", totalWeight);
        console2.log("tiers activated  ", t);
        console2.log("funded spins left", game.remainingFundedSpins(versionId));
    }

    function _count(string memory json, string memory key) private view returns (uint256 i) {
        while (vm.keyExistsJson(json, string.concat(key, "[", vm.toString(i), "]"))) ++i;
    }
}
