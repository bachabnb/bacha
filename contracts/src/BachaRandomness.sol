// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {IRandomnessConsumer} from "./interfaces/IRandomnessConsumer.sol";

/// @title BachaRandomness
/// @notice Commit–reveal randomness for the Bacha machine.
///
/// @dev    WHY THIS EXISTS, AND WHAT IT DOES NOT CLAIM
///
///         This contract replaces an external VRF. It is not a verifiable
///         random function: there is no cryptographic proof that a beacon
///         operator behaved. What it does provide is that the operator cannot
///         *choose* a spin's outcome, and that anyone can check after the fact
///         that the recorded result follows from the recorded inputs.
///
///         Two independent inputs produce every word:
///
///           1. A seed the operator committed to BEFORE the spin existed.
///              Commitments are pushed in batches and consumed strictly in
///              order. By the time a player pays, the seed that will settle
///              their spin is already fixed and publicly hashed.
///
///           2. The hash of a block mined AFTER the spin was paid for. Neither
///              the operator nor the player knows it at request time.
///
///         Neither party can move the result:
///           - The operator cannot change the seed; it is hashed on chain.
///           - The operator cannot pick which seed a spin gets; the queue is
///             FIFO and consumed at request time.
///           - Neither can pick the block hash; it does not exist yet.
///           - The player cannot grind requests, because the seed is already
///             committed and the block hash is not yet known.
///
///         THE HONEST LIMITATION
///
///         The operator learns the outcome the moment the reveal block is
///         mined — it holds the seed — and could withhold the reveal on a
///         result it dislikes. It cannot turn that spin into a different
///         result: the word is already determined. Withholding is therefore
///         griefing, not theft, and the game's refund path bounds it — after
///         the timeout, anyone can refund the spin and the player is made
///         whole in BNB. A withheld reveal is also permanently visible: the
///         commitment is consumed and never opened.
///
///         A validator colluding with the operator could try to grind the
///         reveal block's hash. That requires both the seed and control of
///         that specific block, and gains at most a re-roll of one spin.
///
///         This is a weaker guarantee than a VRF with an on-chain proof. It is
///         stated plainly here, on the fairness page and in the whitepaper,
///         rather than described as something it is not.
contract BachaRandomness is AccessControl {
    bytes32 public constant COMMITTER_ROLE = keccak256("COMMITTER_ROLE");
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");

    /// @dev `blockhash` only reaches back 256 blocks. A reveal later than that
    ///      cannot be completed and the spin falls through to the refund path.
    uint256 public constant BLOCKHASH_WINDOW = 256;

    uint8 public constant MIN_REVEAL_DELAY = 1;
    /// @dev Bounded well inside the blockhash window so a configured delay can
    ///      never make reveals impossible.
    uint8 public constant MAX_REVEAL_DELAY = 64;

    struct Commitment {
        bytes32 hash;
        uint64 committedAt;
        bool consumed;
    }

    struct Request {
        address consumer;
        uint64 commitmentIndex;
        /// @dev The block whose hash is mixed into the word. Always in the
        ///      future at request time.
        uint64 revealBlock;
        bool revealed;
        bool delivered;
        bytes32 seed;
        uint256 word;
    }

    Commitment[] private _commitments;

    /// @notice FIFO cursor into the commitment queue.
    uint256 public nextCommitment;

    mapping(uint256 requestId => Request) private _requests;
    uint256 public requestCount;

    /// @notice Blocks between a request and the block whose hash settles it.
    uint8 public revealDelay = 2;

    error NoCommitmentAvailable();
    error UnknownRequest(uint256 requestId);
    error AlreadyRevealed(uint256 requestId);
    error NotRevealed(uint256 requestId);
    error AlreadyDelivered(uint256 requestId);
    error TooEarly(uint64 revealBlock, uint256 currentBlock);
    error RevealWindowClosed(uint64 revealBlock, uint256 currentBlock);
    error SeedMismatch();
    error InvalidRevealDelay(uint8 delay);
    error EmptyCommitBatch();
    error ZeroCommitment(uint256 index);
    error ZeroAddress();

    event Committed(uint256 indexed index, bytes32 commitment, uint64 committedAt);
    event RandomnessRequested(
        uint256 indexed requestId, address indexed consumer, uint256 indexed commitmentIndex, uint64 revealBlock
    );
    event Revealed(uint256 indexed requestId, bytes32 seed, bytes32 revealBlockHash, uint256 word);
    event Delivered(uint256 indexed requestId, address indexed consumer);
    event DeliveryFailed(uint256 indexed requestId, address indexed consumer);
    event RevealDelayUpdated(uint8 delay);

    constructor(address admin, address committer) {
        if (admin == address(0) || committer == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMMITTER_ROLE, committer);
    }

    // ------------------------------------------------------------- commits

    /// @notice Publish seed commitments for spins that have not happened yet.
    /// @param hashes keccak256 of each 32-byte seed. Seeds must come from a
    ///        CSPRNG and must never be reused — a repeated seed would make a
    ///        later spin's word predictable from the earlier reveal.
    function commit(bytes32[] calldata hashes) external onlyRole(COMMITTER_ROLE) {
        if (hashes.length == 0) revert EmptyCommitBatch();

        uint64 nowTs = uint64(block.timestamp);
        uint256 start = _commitments.length;

        for (uint256 i; i < hashes.length; ++i) {
            if (hashes[i] == bytes32(0)) revert ZeroCommitment(i);
            _commitments.push(Commitment({hash: hashes[i], committedAt: nowTs, consumed: false}));
            emit Committed(start + i, hashes[i], nowTs);
        }
    }

    /// @notice How many committed seeds are still unspent.
    function availableCommitments() public view returns (uint256) {
        return _commitments.length - nextCommitment;
    }

    function commitmentCount() external view returns (uint256) {
        return _commitments.length;
    }

    function getCommitment(uint256 index) external view returns (Commitment memory) {
        return _commitments[index];
    }

    // ------------------------------------------------------------ requests

    /// @notice Bind the next committed seed to a new request.
    /// @dev    Signature mirrors the VRF coordinator's so the game's call site
    ///         is a one-line change. `numWords` is accepted and ignored: one
    ///         spin resolves against exactly one word.
    function requestRandomWords(uint32) external onlyRole(CONSUMER_ROLE) returns (uint256 requestId) {
        uint256 index = nextCommitment;
        if (index >= _commitments.length) revert NoCommitmentAvailable();

        _commitments[index].consumed = true;
        nextCommitment = index + 1;

        requestId = ++requestCount;
        uint64 revealBlock = uint64(block.number) + revealDelay;

        _requests[requestId] = Request({
            consumer: msg.sender,
            commitmentIndex: uint64(index),
            revealBlock: revealBlock,
            revealed: false,
            delivered: false,
            seed: bytes32(0),
            word: 0
        });

        emit RandomnessRequested(requestId, msg.sender, index, revealBlock);
    }

    // ------------------------------------------------------------- reveals

    /// @notice Open the committed seed and settle the request.
    /// @dev    The word is written to storage before it is delivered, so a
    ///         consumer whose callback reverts can be retried with the exact
    ///         same word. There is no second roll to grind for.
    function reveal(uint256 requestId, bytes32 seed) external onlyRole(COMMITTER_ROLE) {
        Request storage req = _requests[requestId];
        if (req.consumer == address(0)) revert UnknownRequest(requestId);
        if (req.revealed) revert AlreadyRevealed(requestId);
        if (block.number <= req.revealBlock) revert TooEarly(req.revealBlock, block.number);

        bytes32 blockHash = blockhash(req.revealBlock);
        // Outside the 256-block window the hash reads as zero and the word
        // would lose its second input entirely. Refuse rather than settle on
        // the seed alone; the spin falls through to the refund path.
        if (blockHash == bytes32(0)) revert RevealWindowClosed(req.revealBlock, block.number);

        if (keccak256(abi.encode(seed)) != _commitments[req.commitmentIndex].hash) revert SeedMismatch();

        uint256 word = uint256(keccak256(abi.encode(seed, blockHash, requestId, req.consumer)));

        req.revealed = true;
        req.seed = seed;
        req.word = word;

        emit Revealed(requestId, seed, blockHash, word);

        _deliver(requestId, req);
    }

    /// @notice Re-attempt delivery of an already-revealed word.
    /// @dev    Permissionless. The word cannot change, so anyone may push it.
    function deliver(uint256 requestId) external {
        Request storage req = _requests[requestId];
        if (req.consumer == address(0)) revert UnknownRequest(requestId);
        if (!req.revealed) revert NotRevealed(requestId);
        if (req.delivered) revert AlreadyDelivered(requestId);
        _deliver(requestId, req);
    }

    /// @dev Delivery failure is recorded, not thrown. A consumer that reverts
    ///      must not be able to strand the reveal — the word is already fixed
    ///      in storage and `deliver` can push it again.
    function _deliver(uint256 requestId, Request storage req) private {
        uint256[] memory words = new uint256[](1);
        words[0] = req.word;

        address consumer = req.consumer;
        try IRandomnessConsumer(consumer).rawFulfillRandomWords(requestId, words) {
            req.delivered = true;
            emit Delivered(requestId, consumer);
        } catch {
            emit DeliveryFailed(requestId, consumer);
        }
    }

    // --------------------------------------------------------------- views

    function getRequest(uint256 requestId) external view returns (Request memory) {
        return _requests[requestId];
    }

    /// @notice True once the reveal block exists and is still inside the
    ///         blockhash window — the interval in which a reveal can succeed.
    function revealable(uint256 requestId) external view returns (bool) {
        Request storage req = _requests[requestId];
        if (req.consumer == address(0) || req.revealed) return false;
        if (block.number <= req.revealBlock) return false;
        return block.number - req.revealBlock <= BLOCKHASH_WINDOW;
    }

    /// @notice Recompute a settled word from its public inputs.
    /// @dev    The whole point of the design: anyone can run this against the
    ///         revealed seed and the reveal block's hash and get the same
    ///         number the contract recorded.
    function deriveWord(bytes32 seed, bytes32 blockHash, uint256 requestId, address consumer)
        external
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encode(seed, blockHash, requestId, consumer)));
    }

    // --------------------------------------------------------------- admin

    function setRevealDelay(uint8 delay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (delay < MIN_REVEAL_DELAY || delay > MAX_REVEAL_DELAY) revert InvalidRevealDelay(delay);
        revealDelay = delay;
        emit RevealDelayUpdated(delay);
    }
}
