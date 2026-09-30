// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {console2} from "forge-std/Script.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {CliSigner} from "./CliSigner.sol";

/// @notice Publishes a prize table and points its tiers at it.
/// @dev    Reads a JSON table so odds never live in Solidity source — the file
///         `npm run table:export` writes:
///
///         { "prizes": [ { "token": "0x..", "value": "1200000000000000",
///                         "weight": 2600, "rarity": 0 }, ... ],
///           "tiers":  [ { "id": 0, "label": "BACHA", "price": "2600000000000000" } ] }
///
///         `value` is the BNB, in wei, spent on the token when that prize is
///         won. Rarity: 0 common, 1 uncommon, 2 rare, 3 epic. Run Configure
///         first — every token must be approved and every value under the cap.
///
///         Signer: the admin (it holds OPERATOR_ROLE), via `--account` or `--ledger`.
contract PublishTable is CliSigner {
    function run() external {
        BachaGame game = BachaGame(payable(vm.envAddress("BACHA_GAME_ADDRESS")));
        string memory json = vm.readFile(vm.envString("BACHA_TABLE_FILE"));

        // Read entry by entry. A `[*]` wildcard path yields several values,
        // which current forge refuses to decode as a single array.
        uint256 n = _count(json, ".prizes");
        uint256 t = _count(json, ".tiers");
        require(n > 0, "prizes: empty");

        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](n);
        uint256 totalWeight;
        for (uint256 i; i < n; ++i) {
            string memory at = string.concat(".prizes[", vm.toString(i), "]");
            uint256 value = vm.parseJsonUint(json, string.concat(at, ".value"));
            uint256 weight = vm.parseJsonUint(json, string.concat(at, ".weight"));
            uint256 rarity = vm.parseJsonUint(json, string.concat(at, ".rarity"));
            require(rarity <= 3, "rarity out of range");
            require(value > 0 && value <= type(uint96).max, "bad value");
            require(weight > 0 && weight <= type(uint32).max, "bad weight");
            prizes[i] = BachaGame.Prize({
                token: vm.parseJsonAddress(json, string.concat(at, ".token")),
                value: uint96(value),
                weight: uint32(weight),
                rarity: BachaGame.Rarity(uint8(rarity))
            });
            totalWeight += weight;
        }

        _startBroadcast();

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
