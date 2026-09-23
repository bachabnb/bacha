// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFV2PlusClient} from "../vendor/VRFV2PlusClient.sol";

/// @notice The subset of the Chainlink VRF v2.5 coordinator interface Bacha uses.
interface IVRFCoordinatorV2Plus {
    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req)
        external
        returns (uint256 requestId);
}
