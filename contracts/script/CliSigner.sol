// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";

/// @dev Broadcast as PRIVATE_KEY when set (local rehearsal), otherwise as the
///      signer given on the command line. Returns the broadcasting address.
abstract contract CliSigner is Script {
    function _startBroadcast() internal returns (address signer) {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk != 0) {
            vm.startBroadcast(pk);
            return vm.addr(pk);
        }
        vm.startBroadcast();
        (, signer,) = vm.readCallers();
    }
}
