// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaVault} from "../src/BachaVault.sol";
import {BachaRandomness} from "../src/BachaRandomness.sol";

/// @notice Deploys the Bacha machine — beacon, vault, game — and wires them.
/// @dev    Deliberately stops short of publishing a prize table, activating
///         tiers or pushing seed commitments. Odds and inventory are an
///         operational decision made against a funded vault, and commitments
///         come from the reveal worker's key, never from a deploy script —
///         see `PublishTable.s.sol`, `scripts/randomness-worker.mjs` and
///         DEPLOYMENT.md.
///
///         Required environment:
///           PRIVATE_KEY       deployer key
///           BACHA_ADMIN       address that receives admin/operator/treasurer
///                             roles — use a multisig on mainnet
///           BACHA_COMMITTER   address that commits and reveals seeds. This is
///                             a hot key held by the reveal worker; keep it
///                             separate from admin, and fund it with gas only.
contract Deploy is Script {
    function run() external returns (BachaVault vault, BachaGame game, BachaRandomness randomness) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("BACHA_ADMIN");
        address committer = vm.envAddress("BACHA_COMMITTER");

        address deployer = vm.addr(pk);
        console2.log("deployer     ", deployer);
        console2.log("admin        ", admin);
        console2.log("committer    ", committer);
        console2.log("chain id     ", block.chainid);

        vm.startBroadcast(pk);

        // The deployer holds admin briefly so it can call setGame and grant
        // the consumer role, then hands every role to `admin` and steps out.
        vault = new BachaVault(deployer);
        randomness = new BachaRandomness(deployer, committer);

        game = new BachaGame(admin, address(vault), address(randomness));

        vault.setGame(address(game));
        randomness.grantRole(randomness.CONSUMER_ROLE(), address(game));

        vault.grantRole(vault.DEFAULT_ADMIN_ROLE(), admin);
        vault.grantRole(vault.TREASURER_ROLE(), admin);
        randomness.grantRole(randomness.DEFAULT_ADMIN_ROLE(), admin);
        if (admin != deployer) {
            vault.renounceRole(vault.TREASURER_ROLE(), deployer);
            vault.renounceRole(vault.DEFAULT_ADMIN_ROLE(), deployer);
            randomness.renounceRole(randomness.DEFAULT_ADMIN_ROLE(), deployer);
        }

        vm.stopBroadcast();

        console2.log("BACHA_VAULT_ADDRESS     ", address(vault));
        console2.log("BACHA_GAME_ADDRESS      ", address(game));
        console2.log("BACHA_RANDOMNESS_ADDRESS", address(randomness));
        console2.log("");
        console2.log("Next: start the reveal worker so the beacon has committed seeds.");
        console2.log("      A spin reverts with NoCommitmentAvailable until it does.");
        console2.log("Then: approve reward assets, fund the vault, publish a table, activate tiers.");
    }
}
