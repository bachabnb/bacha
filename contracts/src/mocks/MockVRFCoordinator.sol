// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {VRFV2PlusClient} from "../vendor/VRFV2PlusClient.sol";

interface IRawConsumer {
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}

/// @notice Test double for the Chainlink VRF v2.5 coordinator.
/// @dev    TEST ONLY. Randomness is supplied explicitly by the test, never
///         derived here. This contract is not deployed to any live network and
///         is not on the production randomness path.
contract MockVRFCoordinator {
    struct Request {
        address consumer;
        bytes32 keyHash;
        uint256 subId;
        uint32 callbackGasLimit;
        uint32 numWords;
        bool fulfilled;
    }

    uint256 public nextRequestId = 1;
    mapping(uint256 => Request) public requests;
    bool public shouldRevertOnRequest;

    event RandomWordsRequested(uint256 indexed requestId, address indexed consumer);

    function setShouldRevertOnRequest(bool value) external {
        shouldRevertOnRequest = value;
    }

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req)
        external
        returns (uint256 requestId)
    {
        require(!shouldRevertOnRequest, "coordinator down");
        requestId = nextRequestId++;
        requests[requestId] = Request({
            consumer: msg.sender,
            keyHash: req.keyHash,
            subId: req.subId,
            callbackGasLimit: req.callbackGasLimit,
            numWords: req.numWords,
            fulfilled: false
        });
        emit RandomWordsRequested(requestId, msg.sender);
    }

    /// @notice Deliver a specific random word chosen by the test.
    function fulfill(uint256 requestId, uint256 word) external {
        Request storage r = requests[requestId];
        require(r.consumer != address(0), "unknown request");
        r.fulfilled = true;
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        IRawConsumer(r.consumer).rawFulfillRandomWords(requestId, words);
    }

    /// @notice Deliver the same request twice, to prove the consumer is idempotent.
    function fulfillAgain(uint256 requestId, uint256 word) external {
        Request storage r = requests[requestId];
        require(r.consumer != address(0), "unknown request");
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        IRawConsumer(r.consumer).rawFulfillRandomWords(requestId, words);
    }
}
