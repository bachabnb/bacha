// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import {BachaRandomness} from "./BachaRandomness.sol";
import {IPancakeV2Router, IPancakeV3Router} from "./interfaces/IPancakeRouters.sol";

/// @title BachaGame
/// @notice The Bacha machine: take payment for a spin, ask BachaRandomness for
///         a random word, turn that word into exactly one prize from a table
///         frozen the moment the player paid — and only then buy the prize.
///
/// @dev    A prize is a fixed amount of BNB to be spent on a named token. No
///         reward tokens are stockpiled: when a spin settles, the BNB it won
///         is swapped on PancakeSwap straight into the player's wallet. The
///         house holds one asset, BNB, and the payout rate is exactly what the
///         table says, whatever the tokens do in the meantime.
///
///         Four invariants shape the design.
///
///         1. A spin's odds cannot move under it. `spin()` stamps the spin with
///            a version and that version's table hash. Published versions are
///            append-only, so new odds can never reach a spin already paid for.
///
///         2. The machine never promises BNB it does not hold. Every pending
///            spin reserves the larger of its table's biggest prize and its own
///            payment; every settled, undelivered prize is owed in full; and
///            `spin()` refuses unless the balance covers all of it.
///
///         3. The randomness callback cannot be made to fail. It writes storage
///            and nothing else — the swap is a separate step, so a broken pool
///            can delay a delivery but never block settlement.
///
///         4. A prize can only ever reach the player. Every route is built and
///            checked here — it must start at WBNB, end at the prize token and
///            pass only through approved hops — and the router is told to pay
///            the player, whose balance change is what the delivery records. If
///            no route will fill, the player can take the prize in BNB instead.
contract BachaGame is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    /// @notice May deliver prizes on a player's behalf, choosing the route and
    ///         minimum output. Held by the settlement bot; it can never change
    ///         where a prize goes.
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    uint256 public constant MAX_PRIZES_PER_TABLE = 64;
    /// @notice Most spins one `spinMany` call may buy.
    uint256 public constant MAX_SPINS_PER_CALL = 25;
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
        Delivered,
        PaidInBnb,
        Refunded
    }

    enum RouteKind {
        V2,
        V3
    }

    /// @param value BNB, in wei, spent on `token` when this prize is won.
    struct Prize {
        address token;
        uint96 value;
        uint32 weight;
        Rarity rarity;
    }

    struct Version {
        bool published;
        uint32 totalWeight;
        uint64 publishedAt;
        uint96 maxValue;
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
        /// @dev BNB held back for this spin while it waits on randomness.
        uint96 reserve;
        address rewardToken;
        uint96 rewardValue;
        uint128 deliveredAmount;
        uint256 requestId;
        uint256 randomWord;
        bytes32 prizeTableHash;
    }

    /// @notice A swap route. V2: `path` of token addresses. V3: a packed
    ///         PancakeSwap path — token, fee, token, fee, … token.
    struct Route {
        RouteKind kind;
        address[] path;
        bytes v3Path;
    }

    // ------------------------------------------------------------ storage

    IPancakeV2Router public immutable v2Router;
    IPancakeV3Router public immutable v3Router;
    address public immutable wbnb;

    /// @notice The commit–reveal beacon this machine draws from.
    BachaRandomness public randomness;

    uint64 public revealTimeout = 3 hours;

    /// @notice Largest single prize the operator may publish, in wei. It is
    ///         what bounds a compromised operator key; admin-set.
    uint96 public maxPrizeValue;

    /// @notice Tokens a prize may pay out in. Admin-set.
    mapping(address token => bool) public approvedAsset;
    /// @notice Intermediate tokens a route may pass through (e.g. USDT).
    mapping(address token => bool) public routeHop;

    uint64 public versionCount;
    mapping(uint64 versionId => Version) private _versions;
    mapping(uint64 versionId => Prize[]) private _versionPrizes;

    mapping(uint8 tierId => Tier) private _tiers;
    uint8[] private _tierIds;

    uint256 public spinCount;
    mapping(uint256 spinId => Spin) private _spins;
    mapping(uint256 requestId => uint256 spinId) public spinIdByRequest;
    mapping(address player => uint256[]) private _spinsByPlayer;

    /// @notice BNB held back for spins still waiting on randomness.
    uint256 public pendingReserve;
    /// @notice BNB owed on settled prizes not yet delivered.
    uint256 public settledOwed;

    // ------------------------------------------------------------- events

    event PrizeTablePublished(
        uint64 indexed versionId, bytes32 indexed prizeTableHash, uint32 totalWeight, uint256 prizeCount, uint96 maxValue
    );
    event TierConfigured(uint8 indexed tierId, string label, uint96 price, uint64 versionId, bool active);
    event RandomnessUpdated(address indexed randomness);
    event RevealTimeoutUpdated(uint64 timeout);
    event MaxPrizeValueUpdated(uint96 value);
    event AssetApproved(address indexed token, bool approved);
    event RouteHopUpdated(address indexed token, bool allowed);
    event Funded(address indexed from, uint256 amount);

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
        uint96 rewardValue,
        Rarity rarity,
        uint16 prizeIndex,
        uint256 randomWord,
        uint64 settledAt
    );
    event SpinDelivered(
        uint256 indexed spinId,
        address indexed player,
        address indexed rewardToken,
        uint96 rewardValue,
        uint256 amountOut,
        address caller
    );
    event SpinPaidInBnb(uint256 indexed spinId, address indexed player, uint96 rewardValue);
    event SpinRefunded(uint256 indexed spinId, address indexed player, uint96 amount);
    event UnknownRequestFulfilled(uint256 indexed requestId);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ------------------------------------------------------------- errors

    error ZeroAddress();
    error EmptyPrizeTable();
    error TooManyPrizes();
    error InvalidWeight();
    error InvalidValue();
    error AssetNotApproved(address token);
    error PrizeExceedsMax(uint256 value, uint256 max);
    error UnknownVersion(uint64 versionId);
    error UnknownTier(uint8 tierId);
    error TierInactive(uint8 tierId);
    error IncorrectPayment(uint256 sent, uint256 required);
    error InvalidSpinCount(uint256 count);
    error InsufficientBankroll(uint256 required, uint256 available);
    error UnknownSpin(uint256 spinId);
    error SpinNotSettled(uint256 spinId, SpinStatus status);
    error SpinNotPending(uint256 spinId, SpinStatus status);
    error RefundTooEarly(uint256 spinId, uint64 claimableAt);
    error InvalidTimeout();
    error NothingToWithdraw();
    error TransferFailed();
    error OnlyRandomness(address caller, address expected);
    error NotPlayerOrSettler(address caller);
    error NotPlayer(address caller);
    error Expired(uint256 deadline);
    error BadRoute();
    error InsufficientOutput(uint256 received, uint256 minimum);

    // -------------------------------------------------------- construction

    constructor(address admin, address randomnessAddress, address v2, address v3, address wbnbAddress) {
        if (
            admin == address(0) || randomnessAddress == address(0) || v2 == address(0) || v3 == address(0)
                || wbnbAddress == address(0)
        ) revert ZeroAddress();
        randomness = BachaRandomness(randomnessAddress);
        v2Router = IPancakeV2Router(v2);
        v3Router = IPancakeV3Router(v3);
        wbnb = wbnbAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);

        emit RandomnessUpdated(randomnessAddress);
    }

    /// @notice Top up the bankroll. Anyone may; it earns no claim.
    function fund() external payable {
        emit Funded(msg.sender, msg.value);
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    // ---------------------------------------------------------- admin

    function setAssetApproved(address token, bool approved) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        approvedAsset[token] = approved;
        emit AssetApproved(token, approved);
    }

    function setRouteHop(address token, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        routeHop[token] = allowed;
        emit RouteHopUpdated(token, allowed);
    }

    /// @dev Admin-only on purpose: the operator key publishes tables, and this
    ///      is the limit it cannot cross. Published versions are untouched.
    function setMaxPrizeValue(uint96 value) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxPrizeValue = value;
        emit MaxPrizeValueUpdated(value);
    }

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

    // ---------------------------------------------------- prize table admin

    /// @notice Publish a new, permanently immutable prize table.
    function publishPrizeTable(Prize[] calldata prizes)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint64 versionId)
    {
        uint256 n = prizes.length;
        if (n == 0) revert EmptyPrizeTable();
        if (n > MAX_PRIZES_PER_TABLE) revert TooManyPrizes();
        uint96 cap = maxPrizeValue;

        versionId = ++versionCount;
        Prize[] storage stored = _versionPrizes[versionId];

        uint256 totalWeight;
        uint96 maxValue;
        for (uint256 i; i < n; ++i) {
            Prize calldata p = prizes[i];
            if (p.token == address(0)) revert ZeroAddress();
            if (!approvedAsset[p.token]) revert AssetNotApproved(p.token);
            if (p.weight == 0) revert InvalidWeight();
            if (p.value == 0) revert InvalidValue();
            if (p.value > cap) revert PrizeExceedsMax(p.value, cap);

            totalWeight += p.weight;
            if (p.value > maxValue) maxValue = p.value;
            stored.push(p);
        }
        if (totalWeight > type(uint32).max) revert InvalidWeight();

        bytes32 hash = keccak256(abi.encode(block.chainid, address(this), versionId, prizes));
        _versions[versionId] = Version({
            published: true,
            totalWeight: uint32(totalWeight),
            publishedAt: uint64(block.timestamp),
            maxValue: maxValue,
            prizeTableHash: hash
        });

        emit PrizeTablePublished(versionId, hash, uint32(totalWeight), n, maxValue);
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

    // ---------------------------------------------------------------- spin

    /// @notice Pay for one spin on `tierId` and request randomness for it.
    function spin(uint8 tierId) external payable nonReentrant whenNotPaused returns (uint256 spinId) {
        (Tier memory tier, Version memory version) = _sellable(tierId);
        if (msg.value != tier.price) revert IncorrectPayment(msg.value, tier.price);
        spinId = _openSpin(tierId, tier, version);
    }

    /// @notice Pay for `count` spins on `tierId` at once. Each is an ordinary
    ///         spin — its own seed, its own reserve, its own prize — so it
    ///         settles, delivers and refunds exactly as if bought alone.
    function spinMany(uint8 tierId, uint256 count)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256[] memory spinIds)
    {
        if (count == 0 || count > MAX_SPINS_PER_CALL) revert InvalidSpinCount(count);
        (Tier memory tier, Version memory version) = _sellable(tierId);
        uint256 total = uint256(tier.price) * count;
        if (msg.value != total) revert IncorrectPayment(msg.value, total);

        spinIds = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            spinIds[i] = _openSpin(tierId, tier, version);
        }
    }

    function _sellable(uint8 tierId) private view returns (Tier memory tier, Version memory version) {
        tier = _tiers[tierId];
        if (!tier.exists) revert UnknownTier(tierId);
        if (!tier.active) revert TierInactive(tierId);
        version = _versions[tier.versionId];
        if (!version.published) revert UnknownVersion(tier.versionId);
    }

    /// @dev Opens one spin paid at `tier.price`. The payment is already in the
    ///      balance, so a batch checks the bankroll once per spin against the
    ///      reserves of every spin before it.
    function _openSpin(uint8 tierId, Tier memory tier, Version memory version) private returns (uint256 spinId) {
        uint96 payment = tier.price;
        uint64 versionId = tier.versionId;

        // Held back until the spin resolves: enough for the biggest prize, or
        // to refund the payment if randomness never comes — whichever is more.
        uint96 reserve = version.maxValue > payment ? version.maxValue : payment;
        uint256 required = obligations() + reserve;
        if (address(this).balance < required) revert InsufficientBankroll(required, address(this).balance);

        spinId = ++spinCount;
        uint64 nowTs = uint64(block.timestamp);
        pendingReserve += reserve;

        // Consumes the next committed seed; reverts if the beacon has run dry,
        // refusing the spin rather than selling one that cannot settle.
        uint256 requestId = randomness.requestRandomWords(1);

        _spins[spinId] = Spin({
            player: msg.sender,
            tier: tierId,
            status: SpinStatus.Pending,
            rarity: Rarity.Common,
            versionId: versionId,
            requestedAt: nowTs,
            settledAt: 0,
            payment: payment,
            reserve: reserve,
            rewardToken: address(0),
            rewardValue: 0,
            deliveredAmount: 0,
            requestId: requestId,
            randomWord: 0,
            prizeTableHash: version.prizeTableHash
        });
        spinIdByRequest[requestId] = spinId;
        _spinsByPlayer[msg.sender].push(spinId);

        emit SpinRequested(spinId, msg.sender, tierId, versionId, version.prizeTableHash, payment, requestId, nowTs);
    }

    /// @notice Delivery point for a revealed word. Only the beacon may call.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(randomness)) revert OnlyRandomness(msg.sender, address(randomness));

        uint256 spinId = spinIdByRequest[requestId];
        if (spinId == 0) {
            emit UnknownRequestFulfilled(requestId);
            return;
        }
        Spin storage s = _spins[spinId];
        // A second delivery is ignored rather than reverted, so a retry can
        // never brick the beacon.
        if (s.status != SpinStatus.Pending) return;

        uint256 word = randomWords.length > 0 ? randomWords[0] : 0;
        (uint16 prizeIndex, address token, uint96 value, Rarity rarity) = _selectPrize(s.versionId, word);

        s.status = SpinStatus.Settled;
        s.settledAt = uint64(block.timestamp);
        s.randomWord = word;
        s.rewardToken = token;
        s.rewardValue = value;
        s.rarity = rarity;

        pendingReserve -= s.reserve;
        settledOwed += value;

        emit SpinSettled(spinId, s.player, token, value, rarity, prizeIndex, word, s.settledAt);
    }

    // ------------------------------------------------------------- delivery

    /// @notice Buy the prize and send it to the player.
    /// @dev    The player, or a settler on their behalf, picks the route and
    ///         the minimum output; the contract fixes everything else — the
    ///         amount in, the token out and the recipient. What the player's
    ///         balance actually gained is what is recorded.
    function deliver(uint256 spinId, Route calldata route, uint256 minOut, uint256 deadline) external nonReentrant {
        Spin storage s = _spins[spinId];
        if (s.status != SpinStatus.Settled) revert SpinNotSettled(spinId, s.status);
        address player = s.player;
        if (msg.sender != player && !hasRole(SETTLER_ROLE, msg.sender)) revert NotPlayerOrSettler(msg.sender);
        if (block.timestamp > deadline) revert Expired(deadline);

        address token = s.rewardToken;
        uint96 value = s.rewardValue;
        _checkRoute(route, token);

        // Effects first: the status flip is what makes a second delivery (or a
        // BNB payout) impossible.
        s.status = SpinStatus.Delivered;
        settledOwed -= value;

        uint256 before = IERC20(token).balanceOf(player);
        if (route.kind == RouteKind.V2) {
            v2Router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: value}(
                minOut, route.path, player, deadline
            );
        } else {
            v3Router.exactInput{value: value}(
                IPancakeV3Router.ExactInputParams({
                    path: route.v3Path, recipient: player, amountIn: value, amountOutMinimum: minOut
                })
            );
        }
        uint256 received = IERC20(token).balanceOf(player) - before;
        if (received == 0 || received < minOut) revert InsufficientOutput(received, minOut);

        s.deliveredAmount = uint128(received);
        emit SpinDelivered(spinId, player, token, value, received, msg.sender);
    }

    /// @notice Take a settled prize as BNB instead of the token.
    /// @dev    The way out when no route will fill. Player only — a settler
    ///         must never be able to swap a player's token prize for BNB.
    function payInBnb(uint256 spinId) external nonReentrant {
        Spin storage s = _spins[spinId];
        if (s.status != SpinStatus.Settled) revert SpinNotSettled(spinId, s.status);
        address player = s.player;
        if (msg.sender != player) revert NotPlayer(msg.sender);

        uint96 value = s.rewardValue;
        s.status = SpinStatus.PaidInBnb;
        settledOwed -= value;

        emit SpinPaidInBnb(spinId, player, value);
        (bool ok,) = payable(player).call{value: value}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Take the spin price back if randomness never arrived.
    function refundExpiredSpin(uint256 spinId) external nonReentrant {
        Spin storage s = _spins[spinId];
        if (s.status == SpinStatus.None) revert UnknownSpin(spinId);
        if (s.status != SpinStatus.Pending) revert SpinNotPending(spinId, s.status);

        uint64 claimableAt = s.requestedAt + revealTimeout;
        if (block.timestamp < claimableAt) revert RefundTooEarly(spinId, claimableAt);

        uint96 amount = s.payment;
        address player = s.player;

        s.status = SpinStatus.Refunded;
        s.settledAt = uint64(block.timestamp);
        pendingReserve -= s.reserve;

        emit SpinRefunded(spinId, player, amount);
        (bool ok,) = payable(player).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @dev A route must start at WBNB, end at the prize token, and pass only
    ///      through approved hops. The recipient and amount are not in the
    ///      caller's hands at all.
    function _checkRoute(Route calldata route, address token) private view {
        if (route.kind == RouteKind.V2) {
            address[] calldata path = route.path;
            uint256 n = path.length;
            if (n < 2 || n > 4 || path[0] != wbnb || path[n - 1] != token) revert BadRoute();
            for (uint256 i = 1; i < n - 1; ++i) {
                if (!routeHop[path[i]]) revert BadRoute();
            }
        } else {
            bytes calldata p = route.v3Path;
            // token (20) + [fee (3) + token (20)] × hops, one to three hops
            if (p.length < 43 || p.length > 89 || (p.length - 20) % 23 != 0) revert BadRoute();
            if (address(bytes20(p[0:20])) != wbnb) revert BadRoute();
            if (address(bytes20(p[p.length - 20:])) != token) revert BadRoute();
            for (uint256 at = 23; at < p.length - 20; at += 23) {
                if (!routeHop[address(bytes20(p[at:at + 20]))]) revert BadRoute();
            }
        }
    }

    // ------------------------------------------------------------ bankroll

    /// @notice Everything the balance must cover right now.
    function obligations() public view returns (uint256) {
        return pendingReserve + settledOwed;
    }

    /// @notice How many more spins this version can safely accept right now.
    function remainingFundedSpins(uint64 versionId) external view returns (uint256) {
        Version memory version = _versions[versionId];
        if (!version.published || version.maxValue == 0) return 0;
        uint256 balance = address(this).balance;
        uint256 owed = obligations();
        if (balance <= owed) return 0;
        // A spin adds its payment to the balance and reserves the larger of its
        // payment and the biggest prize, so it needs (reserve − payment) free.
        uint256 perSpin = version.maxValue;
        for (uint256 i; i < _tierIds.length; ++i) {
            Tier storage t = _tiers[_tierIds[i]];
            if (t.versionId == versionId && t.price > 0) {
                perSpin = t.price >= version.maxValue ? 1 : version.maxValue - t.price;
                break;
            }
        }
        return (balance - owed) / perSpin;
    }

    /// @notice BNB above every obligation — spin revenue the house may take.
    function withdrawableFees() public view returns (uint256) {
        uint256 balance = address(this).balance;
        uint256 owed = obligations();
        return balance > owed ? balance - owed : 0;
    }

    function withdrawFees(address to, uint256 amount) external nonReentrant onlyRole(TREASURER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > withdrawableFees()) revert NothingToWithdraw();
        emit FeesWithdrawn(to, amount);
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // -------------------------------------------------------- prize picking

    /// @dev Weighted walk over the frozen table. Deterministic given the
    ///      version and the random word, so anyone can reproduce a result.
    function _selectPrize(uint64 versionId, uint256 randomWord)
        private
        view
        returns (uint16 index, address token, uint96 value, Rarity rarity)
    {
        Prize[] storage prizes = _versionPrizes[versionId];
        uint256 roll = randomWord % _versions[versionId].totalWeight;

        uint256 cumulative;
        uint256 n = prizes.length;
        for (uint256 i; i < n; ++i) {
            cumulative += prizes[i].weight;
            if (roll < cumulative) {
                Prize storage p = prizes[i];
                return (uint16(i), p.token, p.value, p.rarity);
            }
        }
        // Unreachable: roll < totalWeight == sum of all weights.
        Prize storage last = prizes[n - 1];
        // forge-lint: disable-next-line(unsafe-typecast)
        return (uint16(n - 1), last.token, last.value, last.rarity);
    }

    /// @notice Reproduce the exact outcome a given random word yields.
    function previewPrize(uint64 versionId, uint256 randomWord)
        external
        view
        returns (uint16 index, address token, uint96 value, Rarity rarity)
    {
        if (!_versions[versionId].published) revert UnknownVersion(versionId);
        return _selectPrize(versionId, randomWord);
    }

    // -------------------------------------------------------------- getters

    function getVersion(uint64 versionId) external view returns (Version memory version, Prize[] memory prizes) {
        version = _versions[versionId];
        if (!version.published) revert UnknownVersion(versionId);
        prizes = _versionPrizes[versionId];
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
}
