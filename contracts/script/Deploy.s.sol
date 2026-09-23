// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaVault} from "../src/BachaVault.sol";

/// @notice Deploys the Bacha machine and wires the vault to it.
/// @dev    Deliberately stops short of publishing a prize table or activating
///         tiers. Odds and inventory are an operational decision made against
///         a funded vault — see `PublishTable.s.sol` and DEPLOYMENT.md.
///
///         Required environment:
///           PRIVATE_KEY            deployer key
///           BACHA_ADMIN            address that receives admin/operator/treasurer
///                                  roles — use a multisig on mainnet
///           VRF_COORDINATOR        Chainlink VRF v2.5 coordinator for the chain
///           VRF_KEY_HASH           gas-lane key hash
///           VRF_SUBSCRIPTION_ID    funded VRF v2.5 subscription
///         Optional:
///           VRF_CALLBACK_GAS_LIMIT (default 500000)
///           VRF_CONFIRMATIONS      (default 3)
///           VRF_NATIVE_PAYMENT     (default false — pay in LINK)
contract Deploy is Script {
    function run() external returns (BachaVault vault, BachaGame game) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("BACHA_ADMIN");
        address coordinator = vm.envAddress("VRF_COORDINATOR");
        bytes32 keyHash = vm.envBytes32("VRF_KEY_HASH");
        uint256 subId = vm.envUint("VRF_SUBSCRIPTION_ID");
        uint32 callbackGasLimit = uint32(vm.envOr("VRF_CALLBACK_GAS_LIMIT", uint256(500_000)));
        uint16 confirmations = uint16(vm.envOr("VRF_CONFIRMATIONS", uint256(3)));
        bool nativePayment = vm.envOr("VRF_NATIVE_PAYMENT", false);

        address deployer = vm.addr(pk);
        console2.log("deployer     ", deployer);
        console2.log("admin        ", admin);
        console2.log("coordinator  ", coordinator);
        console2.log("chain id     ", block.chainid);

        vm.startBroadcast(pk);

        // The deployer holds admin briefly so it can call setGame, then hands
        // every role to `admin` and steps out of the way.
        vault = new BachaVault(deployer);

        game = new BachaGame(
            admin,
            address(vault),
            coordinator,
            BachaGame.VrfConfig({
                keyHash: keyHash,
                subId: subId,
                requestConfirmations: confirmations,
                callbackGasLimit: callbackGasLimit,
                nativePayment: nativePayment
            })
        );

        vault.setGame(address(game));

        vault.grantRole(vault.DEFAULT_ADMIN_ROLE(), admin);
        vault.grantRole(vault.TREASURER_ROLE(), admin);
        if (admin != deployer) {
            vault.renounceRole(vault.TREASURER_ROLE(), deployer);
            vault.renounceRole(vault.DEFAULT_ADMIN_ROLE(), deployer);
        }

        vm.stopBroadcast();

        console2.log("BACHA_VAULT_ADDRESS", address(vault));
        console2.log("BACHA_GAME_ADDRESS ", address(game));
        console2.log("");
        console2.log("Next: add BACHA_GAME_ADDRESS as a consumer on VRF subscription", subId);
        console2.log("Then: approve reward assets, fund the vault, publish a table, activate tiers.");
    }
}
