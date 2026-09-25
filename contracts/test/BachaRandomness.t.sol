// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
import {BachaRandomness} from "../src/BachaRandomness.sol";
import {IRandomnessConsumer} from "../src/interfaces/IRandomnessConsumer.sol";

/// @dev Records what it is handed. Stands in for the game so the beacon can be
///      tested without dragging the whole machine in.
contract RecordingConsumer is IRandomnessConsumer {
    mapping(uint256 => uint256) public wordOf;
    uint256 public deliveries;

    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata words) external {
        wordOf[requestId] = words[0];
        deliveries++;
    }
}

/// @dev Reverts on delivery, to prove a broken consumer cannot strand a reveal.
contract RevertingConsumer is IRandomnessConsumer {
    bool public armed = true;
    uint256 public lastWord;

    function disarm() external {
        armed = false;
    }

    function rawFulfillRandomWords(uint256, uint256[] calldata words) external {
        require(!armed, "consumer down");
        lastWord = words[0];
    }
}

contract BachaRandomnessTest is Test {
    BachaRandomness internal beacon;
    RecordingConsumer internal consumer;

    address internal admin = makeAddr("admin");
    address internal committer = makeAddr("committer");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        vm.prank(admin);
        beacon = new BachaRandomness(admin, committer);
        consumer = new RecordingConsumer();

        // Read the role first: as an argument it would consume the prank.
        bytes32 consumerRole = beacon.CONSUMER_ROLE();
        vm.prank(admin);
        beacon.grantRole(consumerRole, address(consumer));

        // blockhash(0) is zero; start somewhere real.
        vm.roll(1000);
    }

    function _seed(uint256 i) internal pure returns (bytes32) {
        return keccak256(abi.encode("seed", i));
    }

    function _commit(uint256 count) internal {
        uint256 start = beacon.commitmentCount();
        bytes32[] memory hashes = new bytes32[](count);
        for (uint256 i; i < count; ++i) {
            hashes[i] = keccak256(abi.encode(_seed(start + i)));
        }
        vm.prank(committer);
        beacon.commit(hashes);
    }

    function _request() internal returns (uint256 requestId) {
        vm.prank(address(consumer));
        requestId = beacon.requestRandomWords(1);
    }

    // ------------------------------------------------------------- commits

    function test_commitAppendsAndCountsAvailable() public {
        _commit(3);
        assertEq(beacon.commitmentCount(), 3);
        assertEq(beacon.availableCommitments(), 3);
        assertFalse(beacon.getCommitment(0).consumed);
    }

    function test_onlyCommitterMayCommit() public {
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256("x");
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, beacon.COMMITTER_ROLE()
            )
        );
        vm.prank(stranger);
        beacon.commit(hashes);
    }

    function test_rejectsEmptyBatchAndZeroCommitment() public {
        bytes32[] memory empty = new bytes32[](0);
        vm.expectRevert(BachaRandomness.EmptyCommitBatch.selector);
        vm.prank(committer);
        beacon.commit(empty);

        bytes32[] memory zero = new bytes32[](1);
        vm.expectRevert(abi.encodeWithSelector(BachaRandomness.ZeroCommitment.selector, 0));
        vm.prank(committer);
        beacon.commit(zero);
    }

    // ------------------------------------------------------------ requests

    function test_requestConsumesQueueInOrder() public {
        _commit(2);
        uint256 r1 = _request();
        uint256 r2 = _request();

        assertEq(beacon.getRequest(r1).commitmentIndex, 0);
        assertEq(beacon.getRequest(r2).commitmentIndex, 1);
        assertEq(beacon.availableCommitments(), 0);
        assertTrue(beacon.getCommitment(0).consumed);
    }

    function test_requestRevertsWhenBeaconIsDry() public {
        vm.expectRevert(BachaRandomness.NoCommitmentAvailable.selector);
        _request();
    }

    function test_onlyConsumerMayRequest() public {
        _commit(1);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, beacon.CONSUMER_ROLE()
            )
        );
        vm.prank(stranger);
        beacon.requestRandomWords(1);
    }

    /// @dev The whole premise: the seed that settles a spin is already fixed
    ///      and publicly hashed before the spin exists.
    function test_revealBlockIsAlwaysInTheFuture() public {
        _commit(1);
        uint256 requestId = _request();
        assertGt(beacon.getRequest(requestId).revealBlock, block.number - 1);
        assertEq(beacon.getRequest(requestId).revealBlock, block.number + beacon.revealDelay());
    }

    // ------------------------------------------------------------- reveals

    function test_revealDerivesWordAndDelivers() public {
        _commit(1);
        uint256 requestId = _request();
        uint64 revealBlock = beacon.getRequest(requestId).revealBlock;

        vm.roll(revealBlock + 1);
        bytes32 bh = blockhash(revealBlock);

        vm.prank(committer);
        beacon.reveal(requestId, _seed(0));

        uint256 expected = beacon.deriveWord(_seed(0), bh, requestId, address(consumer));
        assertEq(beacon.getRequest(requestId).word, expected);
        assertEq(consumer.wordOf(requestId), expected);
        assertEq(consumer.deliveries(), 1);
        assertTrue(beacon.getRequest(requestId).delivered);
    }

    /// @dev Anyone can recompute the result from the published inputs. This is
    ///      what the fairness page's verifier does.
    function test_anyoneCanReproduceTheWord() public {
        _commit(1);
        uint256 requestId = _request();
        uint64 revealBlock = beacon.getRequest(requestId).revealBlock;
        vm.roll(revealBlock + 1);
        bytes32 bh = blockhash(revealBlock);

        vm.prank(committer);
        beacon.reveal(requestId, _seed(0));

        BachaRandomness.Request memory req = beacon.getRequest(requestId);
        uint256 recomputed = uint256(keccak256(abi.encode(req.seed, bh, requestId, req.consumer)));
        assertEq(recomputed, req.word);
    }

    function test_revealRejectsWrongSeed() public {
        _commit(1);
        uint256 requestId = _request();
        vm.roll(beacon.getRequest(requestId).revealBlock + 1);

        vm.expectRevert(BachaRandomness.SeedMismatch.selector);
        vm.prank(committer);
        beacon.reveal(requestId, _seed(99));
    }

    function test_revealRejectsBeforeRevealBlock() public {
        _commit(1);
        uint256 requestId = _request();
        uint64 revealBlock = beacon.getRequest(requestId).revealBlock;

        vm.expectRevert(abi.encodeWithSelector(BachaRandomness.TooEarly.selector, revealBlock, block.number));
        vm.prank(committer);
        beacon.reveal(requestId, _seed(0));
    }

    function test_revealRejectedOutsideBlockhashWindow() public {
        _commit(1);
        uint256 requestId = _request();
        uint64 revealBlock = beacon.getRequest(requestId).revealBlock;

        vm.roll(revealBlock + beacon.BLOCKHASH_WINDOW() + 2);
        assertFalse(beacon.revealable(requestId));

        vm.expectRevert(
            abi.encodeWithSelector(BachaRandomness.RevealWindowClosed.selector, revealBlock, block.number)
        );
        vm.prank(committer);
        beacon.reveal(requestId, _seed(0));
    }

    function test_cannotRevealTwice() public {
        _commit(1);
        uint256 requestId = _request();
        vm.roll(beacon.getRequest(requestId).revealBlock + 1);

        vm.prank(committer);
        beacon.reveal(requestId, _seed(0));

        vm.expectRevert(abi.encodeWithSelector(BachaRandomness.AlreadyRevealed.selector, requestId));
        vm.prank(committer);
        beacon.reveal(requestId, _seed(0));
    }

    function test_onlyCommitterMayReveal() public {
        _commit(1);
        uint256 requestId = _request();
        vm.roll(beacon.getRequest(requestId).revealBlock + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, beacon.COMMITTER_ROLE()
            )
        );
        vm.prank(stranger);
        beacon.reveal(requestId, _seed(0));
    }

    // ------------------------------------------------------------ delivery

    /// @dev A consumer that reverts must not burn the seed. The word is fixed
    ///      at reveal time, so the retry cannot produce a different number —
    ///      there is nothing to grind for.
    function test_failedDeliveryIsRetryableWithTheSameWord() public {
        RevertingConsumer broken = new RevertingConsumer();
        bytes32 consumerRole = beacon.CONSUMER_ROLE();
        vm.prank(admin);
        beacon.grantRole(consumerRole, address(broken));

        _commit(1);
        vm.prank(address(broken));
        uint256 requestId = beacon.requestRandomWords(1);

        vm.roll(beacon.getRequest(requestId).revealBlock + 1);
        vm.prank(committer);
        beacon.reveal(requestId, _seed(0));

        BachaRandomness.Request memory req = beacon.getRequest(requestId);
        assertTrue(req.revealed, "seed must be recorded even when delivery fails");
        assertFalse(req.delivered);

        broken.disarm();
        beacon.deliver(requestId); // permissionless

        assertTrue(beacon.getRequest(requestId).delivered);
        assertEq(broken.lastWord(), req.word, "retry must deliver the same word");
        assertEq(beacon.getRequest(requestId).word, req.word);
    }

    function test_cannotDeliverTwice() public {
        _commit(1);
        uint256 requestId = _request();
        vm.roll(beacon.getRequest(requestId).revealBlock + 1);
        vm.prank(committer);
        beacon.reveal(requestId, _seed(0));

        vm.expectRevert(abi.encodeWithSelector(BachaRandomness.AlreadyDelivered.selector, requestId));
        beacon.deliver(requestId);
    }

    function test_cannotDeliverBeforeReveal() public {
        _commit(1);
        uint256 requestId = _request();
        vm.expectRevert(abi.encodeWithSelector(BachaRandomness.NotRevealed.selector, requestId));
        beacon.deliver(requestId);
    }

    // --------------------------------------------------------------- admin

    function test_revealDelayBounds() public {
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(BachaRandomness.InvalidRevealDelay.selector, uint8(0)));
        beacon.setRevealDelay(0);

        vm.expectRevert(abi.encodeWithSelector(BachaRandomness.InvalidRevealDelay.selector, uint8(65)));
        beacon.setRevealDelay(65);

        beacon.setRevealDelay(8);
        assertEq(beacon.revealDelay(), 8);
        vm.stopPrank();
    }

    /// @dev Different requests must not collide on the same word even when the
    ///      same block hash is mixed in, because requestId is part of the hash.
    function testFuzz_distinctRequestsProduceDistinctWords(bytes32 seedA, bytes32 seedB) public view {
        vm.assume(seedA != seedB);
        bytes32 bh = blockhash(block.number - 1);
        uint256 a = beacon.deriveWord(seedA, bh, 1, address(consumer));
        uint256 b = beacon.deriveWord(seedB, bh, 1, address(consumer));
        uint256 c = beacon.deriveWord(seedA, bh, 2, address(consumer));
        assertTrue(a != b);
        assertTrue(a != c);
    }
}
