// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VRFV2PlusClient
/// @notice Minimal, self-contained re-declaration of the request struct and
///         `extraArgs` encoding used by Chainlink VRF v2.5 (`VRFV2PlusClient`).
/// @dev    This is intentionally vendored rather than imported so the Bacha
///         contracts build from a small, reviewable dependency set. The layout
///         and the `EXTRA_ARGS_V1_TAG` below match Chainlink's published
///         `VRFV2PlusClient` library byte-for-byte; changing either would break
///         compatibility with the live coordinator.
library VRFV2PlusClient {
    // bytes4(keccak256("VRF ExtraArgsV1"))
    bytes4 public constant EXTRA_ARGS_V1_TAG = 0x92fd1338;

    struct ExtraArgsV1 {
        bool nativePayment;
    }

    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }

    function _argsToBytes(ExtraArgsV1 memory extraArgs) internal pure returns (bytes memory bts) {
        return abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, extraArgs);
    }
}
