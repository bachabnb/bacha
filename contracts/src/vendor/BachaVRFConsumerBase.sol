// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BachaVRFConsumerBase
/// @notice Consumer half of the Chainlink VRF v2.5 handshake.
/// @dev    The coordinator calls `rawFulfillRandomWords`; only the recorded
///         coordinator address may do so. Implementations override
///         `fulfillRandomWords`. Mirrors Chainlink's `VRFConsumerBaseV2Plus`
///         callback surface without pulling in its ownership machinery — Bacha
///         uses OpenZeppelin `AccessControl` for that instead.
abstract contract BachaVRFConsumerBase {
    error OnlyCoordinatorCanFulfill(address have, address want);

    address private immutable _vrfCoordinator;

    constructor(address coordinator) {
        _vrfCoordinator = coordinator;
    }

    function vrfCoordinator() public view returns (address) {
        return _vrfCoordinator;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal virtual;

    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != _vrfCoordinator) {
            revert OnlyCoordinatorCanFulfill(msg.sender, _vrfCoordinator);
        }
        fulfillRandomWords(requestId, randomWords);
    }
}
