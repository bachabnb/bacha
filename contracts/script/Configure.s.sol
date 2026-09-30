// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {console2} from "forge-std/Script.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaRandomness} from "../src/BachaRandomness.sol";
import {CliSigner} from "./CliSigner.sol";

/// @notice The admin's one-time setup after Deploy, before PublishTable:
///         connect the game to the beacon, approve the table's assets and the
///         USDT route hop, cap prize size, and let the settlement bot deliver.
/// @dev    Required environment:
///           BACHA_GAME_ADDRESS        game printed by Deploy
///           BACHA_RANDOMNESS_ADDRESS  the beacon it draws from
///           BACHA_TABLE_FILE          the table about to be published
///           BACHA_COMMITTER           the reveal worker's address — it also
///                                     delivers prizes, so it gets SETTLER_ROLE
///         Optional:
///           BACHA_OLD_GAME_ADDRESS    a retired game to cut off from the beacon
///           BACHA_PRIZE_CAP_MULTIPLE  cap = this × the table's biggest prize (default 2)
///
///         Signer: the admin, via `--account` or `--ledger`.
contract Configure is CliSigner {
    address internal constant USDT = 0x55d398326f99059fF775485246999027B3197955;

    function run() external {
        BachaGame game = BachaGame(payable(vm.envAddress("BACHA_GAME_ADDRESS")));
        BachaRandomness randomness = BachaRandomness(vm.envAddress("BACHA_RANDOMNESS_ADDRESS"));
        address settler = vm.envAddress("BACHA_COMMITTER");
        address oldGame = vm.envOr("BACHA_OLD_GAME_ADDRESS", address(0));
        uint256 multiple = vm.envOr("BACHA_PRIZE_CAP_MULTIPLE", uint256(2));
        require(multiple >= 1 && multiple <= 10, "cap multiple out of range");

        string memory json = vm.readFile(vm.envString("BACHA_TABLE_FILE"));
        address[] memory tokens = new address[](64);
        uint256 distinct;
        uint256 maxValue;
        for (uint256 i; vm.keyExistsJson(json, string.concat(".prizes[", vm.toString(i), "]")); ++i) {
            string memory at = string.concat(".prizes[", vm.toString(i), "]");
            address token = vm.parseJsonAddress(json, string.concat(at, ".token"));
            uint256 value = vm.parseJsonUint(json, string.concat(at, ".value"));
            if (value > maxValue) maxValue = value;
            uint256 j;
            while (j < distinct && tokens[j] != token) ++j;
            if (j == distinct) tokens[distinct++] = token;
        }
        require(distinct > 0, "table has no prizes");
        uint256 cap = maxValue * multiple;
        require(cap <= type(uint96).max, "cap too large");

        _startBroadcast();

        randomness.grantRole(randomness.CONSUMER_ROLE(), address(game));
        if (oldGame != address(0) && randomness.hasRole(randomness.CONSUMER_ROLE(), oldGame)) {
            randomness.revokeRole(randomness.CONSUMER_ROLE(), oldGame);
            console2.log("revoked beacon access from old game", oldGame);
        }
        for (uint256 j; j < distinct; ++j) {
            game.setAssetApproved(tokens[j], true);
        }
        game.setRouteHop(USDT, true);
        game.setMaxPrizeValue(uint96(cap));
        game.grantRole(game.SETTLER_ROLE(), settler);

        vm.stopBroadcast();

        console2.log("assets approved  ", distinct);
        console2.log("max prize (wei)  ", cap);
        console2.log("settler          ", settler);
    }
}
