// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IRandomnessConsumer
/// @notice The callback surface BachaRandomness delivers into.
/// @dev    Deliberately identical in shape to the Chainlink VRF v2.5 consumer
///         callback, so the game's settlement path did not have to change when
///         the randomness source did.
interface IRandomnessConsumer {
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}
