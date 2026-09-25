// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "openzeppelin-contracts/contracts/utils/structs/EnumerableSet.sol";

import {BachaVault} from "./BachaVault.sol";
import {BachaRandomness} from "./BachaRandomness.sol";

/// @title BachaGame
/// @notice The Bacha machine: take payment for a spin, ask BachaRandomness for
///         a random word, and turn that word into exactly one reward from a
///         prize table that was frozen the moment the player paid.
///
/// @dev    Three invariants shape the whole design.
///
///         1. A spin's odds cannot move under it. `spin()` stamps the spin with
///            a `versionId` and the `prizeTableHash` of that version. Published
///            versions are append-only — no function in this contract can edit
///            one — so an operator publishing new odds mid-flight cannot touch
///            a spin already in the air.
///
///         2. The machine never promises a reward it cannot pay. `spin()`
///            refuses unless the vault holds enough of *every* asset in the
///            table to cover the worst case for this spin on top of everything
///            already owed.
///
///         3. The randomness callback cannot be made to fail. It writes storage and
///            nothing else — no transfers, no external calls, no loops over
///            untrusted input. Moving the prize is a separate, permissionless
///            `claimFor` whose destination was fixed before randomness existed.
contract BachaGame is AccessControl, Pausable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    uint256 public constant MAX_PRIZES_PER_TABLE = 64;
    uint256 public constant MAX_ACTIVE_VERSIONS = 32;
    uint64 public constant MIN_REVEAL_TIMEOUT = 30 minutes;
    uint64 public constant MAX_REVEAL_TIMEOUT = 7 days;

    enum Rarity {
        Common,
        Uncommon,
        Rare,
        Epic
    }

    enum SpinStatus {
        None,
        Pending,
        Settled,
        Claimed,
        Refunded
    }

    struct Prize {
        address token;
        uint128 amount;
        uint32 weight;
        Rarity rarity;
    }

    struct Version {
        bool published;
        uint32 totalWeight;
        uint64 publishedAt;
        bytes32 prizeTableHash;
    }

    struct Tier {
        bool exists;
        bool active;
        uint96 price;
        uint64 versionId;
        string label;
    }

    struct Spin {
        address player;
        uint8 tier;
        SpinStatus status;
        Rarity rarity;
        uint64 versionId;
        uint64 requestedAt;
        uint64 settledAt;
        uint96 payment;
        address rewardToken;
        uint128 rewardAmount;
        uint256 requestId;
        uint256 randomWord;
        bytes32 prizeTableHash;
    }

    // ------------------------------------------------------------ storage

    BachaVault public immutable vault;

    /// @notice The commit–reveal beacon this machine draws from.
    /// @dev    Mutable so a provider can be replaced without redeploying the
    ///         game. Spins already in flight keep the request ids they were
    ///         issued, so a swap must only happen with the machine paused and
    ///         the queue drained.
    BachaRandomness public randomness;

    /// @notice How long a pending spin waits before anyone may refund it.
    uint64 public revealTimeout = 3 hours;

    uint64 public versionCount;
    mapping(uint64 versionId => Version) private _versions;
    mapping(uint64 versionId => Prize[]) private _versionPrizes;
    mapping(uint64 versionId => address[]) private _versionTokens;
    mapping(uint64 versionId => mapping(address token => uint256)) private _versionMaxPerToken;

    mapping(uint8 tierId => Tier) private _tiers;
    uint8[] private _tierIds;

    uint256 public spinCount;
    mapping(uint256 spinId => Spin) private _spins;
    mapping(uint256 requestId => uint256 spinId) public spinIdByRequest;
    mapping(address player => uint256[]) private _spinsByPlayer;

    /// @notice Unsettled spins per version, used for worst-case liability.
    mapping(uint64 versionId => uint256) public pendingSpins;
    EnumerableSet.UintSet private _activeVersions;

    /// @notice Settled prizes not yet claimed, per token.
    mapping(address token => uint256) public settledOwed;

    /// @notice BNB taken for spins that could still be refunded.
    uint256 public refundablePayments;

    // ------------------------------------------------------------- events

    event PrizeTablePublished(
        uint64 indexed versionId, bytes32 indexed prizeTableHash, uint32 totalWeight, uint256 prizeCount
    );
    event TierConfigured(uint8 indexed tierId, string label, uint96 price, uint64 versionId, bool active);
    event RandomnessUpdated(address indexed randomness);
    event RevealTimeoutUpdated(uint64 timeout);

    event SpinRequested(
        uint256 indexed spinId,
        address indexed player,
        uint8 indexed tier,
        uint64 versionId,
        bytes32 prizeTableHash,
        uint96 payment,
        uint256 requestId,
        uint64 requestedAt
    );
    event SpinSettled(
        uint256 indexed spinId,
        address indexed player,
        address indexed rewardToken,
        uint128 rewardAmount,
        Rarity rarity,
        uint16 prizeIndex,
        uint256 randomWord,
        uint64 settledAt
    );
    event SpinClaimed(
        uint256 indexed spinId, address indexed player, address indexed rewardToken, uint128 rewardAmount, address caller
    );
    event SpinRefunded(uint256 indexed spinId, address indexed player, uint96 amount);
    event UnknownRequestFulfilled(uint256 indexed requestId);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ------------------------------------------------------------- errors

    error ZeroAddress();
    error EmptyPrizeTable();
    error TooManyPrizes();
    error InvalidWeight();
    error InvalidAmount();
    error AssetNotApprovedByVault(address token);
    error UnknownVersion(uint64 versionId);
    error UnknownTier(uint8 tierId);
    error TierInactive(uint8 tierId);
    error IncorrectPayment(uint256 sent, uint256 required);
    error InsufficientInventory(address token, uint256 required, uint256 available);
    error TooManyActiveVersions();
    error UnknownSpin(uint256 spinId);
    error SpinNotSettled(uint256 spinId, SpinStatus status);
    error SpinNotPending(uint256 spinId, SpinStatus status);
    error RefundTooEarly(uint256 spinId, uint64 claimableAt);
    error InvalidTimeout();
    error NothingToWithdraw();
    error TransferFailed();
    error OnlyRandomness(address caller, address expected);

    // -------------------------------------------------------- construction

    constructor(address admin, address vaultAddress, address randomnessAddress) {
        if (admin == address(0) || vaultAddress == address(0) || randomnessAddress == address(0)) {
            revert ZeroAddress();
        }
        vault = BachaVault(vaultAddress);
        randomness = BachaRandomness(randomnessAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);

        emit RandomnessUpdated(randomnessAddress);
    }

    // ---------------------------------------------------- prize table admin

    /// @notice Publish a new, permanently immutable prize table.
    /// @dev    There is no edit path by design. Changing odds means publishing
    ///         a new version and repointing a tier at it; spins already stamped
    ///         with an older version keep resolving against that older table.
    function publishPrizeTable(Prize[] calldata prizes)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint64 versionId)
    {
        uint256 n = prizes.length;
        if (n == 0) revert EmptyPrizeTable();
        if (n > MAX_PRIZES_PER_TABLE) revert TooManyPrizes();

        versionId = ++versionCount;

        uint256 totalWeight;
        Prize[] storage stored = _versionPrizes[versionId];
        address[] storage tokens = _versionTokens[versionId];
        mapping(address => uint256) storage maxPerToken = _versionMaxPerToken[versionId];

        for (uint256 i; i < n; ++i) {
            Prize calldata p = prizes[i];
            if (p.token == address(0)) revert ZeroAddress();
            if (p.weight == 0) revert InvalidWeight();
            if (p.amount == 0) revert InvalidAmount();
            if (!vault.approvedAsset(p.token)) revert AssetNotApprovedByVault(p.token);

            totalWeight += p.weight;
            stored.push(p);

            uint256 current = maxPerToken[p.token];
            if (current == 0) tokens.push(p.token);
            if (p.amount > current) maxPerToken[p.token] = p.amount;
        }

        if (totalWeight == 0 || totalWeight > type(uint32).max) revert InvalidWeight();

        bytes32 hash = keccak256(abi.encode(block.chainid, address(this), versionId, prizes));
        _versions[versionId] =
            Version({published: true, totalWeight: uint32(totalWeight), publishedAt: uint64(block.timestamp), prizeTableHash: hash});

        emit PrizeTablePublished(versionId, hash, uint32(totalWeight), n);
    }

    function configureTier(uint8 tierId, string calldata label, uint96 price, uint64 versionId, bool active)
        external
        onlyRole(OPERATOR_ROLE)
    {
        if (!_versions[versionId].published) revert UnknownVersion(versionId);

        Tier storage tier = _tiers[tierId];
        if (!tier.exists) {
            tier.exists = true;
            _tierIds.push(tierId);
        }
        tier.label = label;
        tier.price = price;
        tier.versionId = versionId;
        tier.active = active;

        emit TierConfigured(tierId, label, price, versionId, active);
    }

    /// @dev Admin rather than operator: pointing the machine at a different
    ///      beacon is a trust decision, not a tuning knob.
    function setRandomness(address randomnessAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (randomnessAddress == address(0)) revert ZeroAddress();
        randomness = BachaRandomness(randomnessAddress);
        emit RandomnessUpdated(randomnessAddress);
    }

    function setRevealTimeout(uint64 timeout) external onlyRole(OPERATOR_ROLE) {
        if (timeout < MIN_REVEAL_TIMEOUT || timeout > MAX_REVEAL_TIMEOUT) revert InvalidTimeout();
        revealTimeout = timeout;
        emit RevealTimeoutUpdated(timeout);
    }

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------- spin

    /// @notice Pay for one spin on `tierId` and request randomness for it.
    function spin(uint8 tierId) external payable nonReentrant whenNotPaused returns (uint256 spinId) {
        Tier memory tier = _tiers[tierId];
        if (!tier.exists) revert UnknownTier(tierId);
        if (!tier.active) revert TierInactive(tierId);
        if (msg.value != tier.price) revert IncorrectPayment(msg.value, tier.price);

        uint64 versionId = tier.versionId;
        Version memory version = _versions[versionId];
        if (!version.published) revert UnknownVersion(versionId);

        _requireInventoryForOneMore(versionId);

        if (pendingSpins[versionId] == 0 && _activeVersions.length() >= MAX_ACTIVE_VERSIONS) {
            revert TooManyActiveVersions();
        }

        spinId = ++spinCount;
        uint64 nowTs = uint64(block.timestamp);

        pendingSpins[versionId] += 1;
        _activeVersions.add(versionId);
        refundablePayments += msg.value;

        // Consumes the next committed seed. Reverts if the beacon has run
        // dry, which refuses the spin rather than selling one that cannot
        // settle.
        uint256 requestId = randomness.requestRandomWords(1);

        _spins[spinId] = Spin({
            player: msg.sender,
            tier: tierId,
            status: SpinStatus.Pending,
            rarity: Rarity.Common,
            versionId: versionId,
            requestedAt: nowTs,
            settledAt: 0,
            payment: uint96(msg.value),
            rewardToken: address(0),
            rewardAmount: 0,
            requestId: requestId,
            randomWord: 0,
            prizeTableHash: version.prizeTableHash
        });
        spinIdByRequest[requestId] = spinId;
        _spinsByPlayer[msg.sender].push(spinId);

        emit SpinRequested(
            spinId, msg.sender, tierId, versionId, version.prizeTableHash, uint96(msg.value), requestId, nowTs
        );
    }

    /// @notice Delivery point for a revealed word.
    /// @dev    Only the configured beacon may call it.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(randomness)) revert OnlyRandomness(msg.sender, address(randomness));
        _fulfillRandomWords(requestId, randomWords);
    }

    /// @dev Storage-only. No transfers, no calls into other contracts, no
    ///      unbounded work — the callback must never be the thing that fails.
    function _fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal {
        uint256 spinId = spinIdByRequest[requestId];
        if (spinId == 0) {
            emit UnknownRequestFulfilled(requestId);
            return;
        }

        Spin storage s = _spins[spinId];
        // A second delivery for the same request is ignored rather than
        // reverted, so a retry can never brick the beacon.
        if (s.status != SpinStatus.Pending) return;

        uint256 word = randomWords.length > 0 ? randomWords[0] : 0;
        uint64 versionId = s.versionId;

        (uint16 prizeIndex, address token, uint128 amount, Rarity rarity) = _selectPrize(versionId, word);

        s.status = SpinStatus.Settled;
        s.settledAt = uint64(block.timestamp);
        s.randomWord = word;
        s.rewardToken = token;
        s.rewardAmount = amount;
        s.rarity = rarity;

        uint256 pending = pendingSpins[versionId];
        if (pending > 0) {
            unchecked {
                pending -= 1;
            }
            pendingSpins[versionId] = pending;
            if (pending == 0) _activeVersions.remove(versionId);
        }

        settledOwed[token] += amount;

        uint256 payment = s.payment;
        if (refundablePayments >= payment) {
            unchecked {
                refundablePayments -= payment;
            }
        } else {
            refundablePayments = 0;
        }

        emit SpinSettled(spinId, s.player, token, amount, rarity, prizeIndex, word, s.settledAt);
    }

    /// @notice Deliver a settled prize to the wallet that paid for the spin.
    /// @dev    Permissionless. The recipient is read from spin state written
    ///         before randomness was requested, so a settlement bot calling
    ///         this on a player's behalf takes no custody and cannot redirect
    ///         anything. The player can always call it themselves.
    function claimFor(uint256 spinId) public nonReentrant {
        Spin storage s = _spins[spinId];
        if (s.status == SpinStatus.None) revert UnknownSpin(spinId);
        if (s.status != SpinStatus.Settled) revert SpinNotSettled(spinId, s.status);

        address token = s.rewardToken;
        uint128 amount = s.rewardAmount;
        address player = s.player;

        // Effects before interaction: the status flip is what makes a second
        // claim impossible, so it happens before the vault is touched.
        s.status = SpinStatus.Claimed;

        uint256 owed = settledOwed[token];
        settledOwed[token] = owed > amount ? owed - amount : 0;

        vault.payout(token, player, amount);

        emit SpinClaimed(spinId, player, token, amount, msg.sender);
    }

    function claimMany(uint256[] calldata spinIds) external {
        for (uint256 i; i < spinIds.length; ++i) {
            claimFor(spinIds[i]);
        }
    }

    /// @notice Take the spin price back if randomness never arrived.
    /// @dev    The only escape hatch for a spin stuck Pending. Settling later
    ///         is impossible for a refunded spin because the status check in
    ///         the callback no longer matches.
    function refundExpiredSpin(uint256 spinId) external nonReentrant {
        Spin storage s = _spins[spinId];
        if (s.status == SpinStatus.None) revert UnknownSpin(spinId);
        if (s.status != SpinStatus.Pending) revert SpinNotPending(spinId, s.status);

        uint64 claimableAt = s.requestedAt + revealTimeout;
        if (block.timestamp < claimableAt) revert RefundTooEarly(spinId, claimableAt);

        uint96 amount = s.payment;
        address player = s.player;
        uint64 versionId = s.versionId;

        s.status = SpinStatus.Refunded;
        s.settledAt = uint64(block.timestamp);

        uint256 pending = pendingSpins[versionId];
        if (pending > 0) {
            unchecked {
                pending -= 1;
            }
            pendingSpins[versionId] = pending;
            if (pending == 0) _activeVersions.remove(versionId);
        }

        if (refundablePayments >= amount) {
            unchecked {
                refundablePayments -= amount;
            }
        } else {
            refundablePayments = 0;
        }

        emit SpinRefunded(spinId, player, amount);

        (bool ok,) = payable(player).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ----------------------------------------------------------- liability

    /// @notice Everything the machine could still owe in `token`.
    /// @dev    Settled-unclaimed prizes, plus the worst case for every spin
    ///         still waiting on randomness — that is, every pending spin
    ///         landing on this token's largest entry at once. The vault reads
    ///         this before allowing any withdrawal.
    function pendingLiabilityOf(address token) public view returns (uint256 total) {
        total = settledOwed[token];
        uint256 n = _activeVersions.length();
        for (uint256 i; i < n; ++i) {
            uint64 versionId = uint64(_activeVersions.at(i));
            uint256 max = _versionMaxPerToken[versionId][token];
            if (max != 0) {
                total += max * pendingSpins[versionId];
            }
        }
    }

    function _requireInventoryForOneMore(uint64 versionId) private view {
        address[] storage tokens = _versionTokens[versionId];
        uint256 n = tokens.length;
        for (uint256 i; i < n; ++i) {
            address token = tokens[i];
            uint256 required = pendingLiabilityOf(token) + _versionMaxPerToken[versionId][token];
            uint256 held = vault.balanceOfAsset(token);
            if (held < required) revert InsufficientInventory(token, required, held);
        }
    }

    /// @notice How many more spins this version can safely accept right now.
    function remainingFundedSpins(uint64 versionId) external view returns (uint256 remaining) {
        if (!_versions[versionId].published) return 0;
        address[] storage tokens = _versionTokens[versionId];
        uint256 n = tokens.length;
        if (n == 0) return 0;

        remaining = type(uint256).max;
        for (uint256 i; i < n; ++i) {
            address token = tokens[i];
            uint256 held = vault.balanceOfAsset(token);
            uint256 owed = pendingLiabilityOf(token);
            uint256 free = held > owed ? held - owed : 0;
            uint256 perSpin = _versionMaxPerToken[versionId][token];
            uint256 fits = perSpin == 0 ? type(uint256).max : free / perSpin;
            if (fits < remaining) remaining = fits;
        }
    }

    // -------------------------------------------------------- prize picking

    /// @dev Weighted walk over the frozen table. Deterministic given the
    ///      version and the random word, so anyone can reproduce a result.
    function _selectPrize(uint64 versionId, uint256 randomWord)
        private
        view
        returns (uint16 index, address token, uint128 amount, Rarity rarity)
    {
        Prize[] storage prizes = _versionPrizes[versionId];
        uint256 roll = randomWord % _versions[versionId].totalWeight;

        uint256 cumulative;
        uint256 n = prizes.length;
        for (uint256 i; i < n; ++i) {
            cumulative += prizes[i].weight;
            if (roll < cumulative) {
                Prize storage p = prizes[i];
                return (uint16(i), p.token, p.amount, p.rarity);
            }
        }
        // Unreachable: roll < totalWeight == sum of all weights.
        Prize storage last = prizes[n - 1];
        return (uint16(n - 1), last.token, last.amount, last.rarity);
    }

    /// @notice Reproduce the exact outcome a given random word yields.
    /// @dev    Used by the fairness page to re-derive a settled result offchain.
    function previewPrize(uint64 versionId, uint256 randomWord)
        external
        view
        returns (uint16 index, address token, uint128 amount, Rarity rarity)
    {
        if (!_versions[versionId].published) revert UnknownVersion(versionId);
        return _selectPrize(versionId, randomWord);
    }

    // -------------------------------------------------------------- getters

    function getVersion(uint64 versionId)
        external
        view
        returns (Version memory version, Prize[] memory prizes, address[] memory tokens)
    {
        version = _versions[versionId];
        if (!version.published) revert UnknownVersion(versionId);
        prizes = _versionPrizes[versionId];
        tokens = _versionTokens[versionId];
    }

    function getTier(uint8 tierId) external view returns (Tier memory) {
        Tier memory tier = _tiers[tierId];
        if (!tier.exists) revert UnknownTier(tierId);
        return tier;
    }

    function tierIds() external view returns (uint8[] memory) {
        return _tierIds;
    }

    function getSpin(uint256 spinId) external view returns (Spin memory) {
        Spin memory s = _spins[spinId];
        if (s.status == SpinStatus.None) revert UnknownSpin(spinId);
        return s;
    }

    function spinsOf(address player, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 total)
    {
        uint256[] storage all = _spinsByPlayer[player];
        total = all.length;
        if (offset >= total) return (new uint256[](0), total);
        uint256 end = offset + limit;
        if (end > total) end = total;
        ids = new uint256[](end - offset);
        for (uint256 i; i < ids.length; ++i) {
            ids[i] = all[total - 1 - (offset + i)];
        }
    }

    function activeVersions() external view returns (uint256[] memory) {
        return _activeVersions.values();
    }

    function versionMaxPerToken(uint64 versionId, address token) external view returns (uint256) {
        return _versionMaxPerToken[versionId][token];
    }

    // -------------------------------------------------------------- treasury

    /// @notice Spin revenue, minus anything a pending spin could still reclaim.
    function withdrawableFees() public view returns (uint256) {
        uint256 balance = address(this).balance;
        uint256 owed = refundablePayments;
        return balance > owed ? balance - owed : 0;
    }

    function withdrawFees(address to, uint256 amount) external nonReentrant onlyRole(TREASURER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        uint256 free = withdrawableFees();
        if (amount == 0 || amount > free) revert NothingToWithdraw();
        emit FeesWithdrawn(to, amount);
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
