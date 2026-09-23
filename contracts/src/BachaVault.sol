// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @notice The read side of the game that the vault consults before letting
///         anyone take inventory out.
interface IPendingLiability {
    function pendingLiabilityOf(address token) external view returns (uint256);
}

/// @title BachaVault
/// @notice Custodian for Bacha's reward inventory.
/// @dev    Inventory splits two ways at any instant:
///
///           reservedFor(token)  worst-case amount owed to spins that are
///                               either unsettled or settled-but-unclaimed
///           withdrawable(token) everything else
///
///         The game contract is the single source of truth for what is owed —
///         there is deliberately no second copy of that accounting here to
///         drift out of sync. The vault's own job is narrow: hold assets, let
///         the game push a payout to a player the game has already recorded,
///         and refuse to release anything that is spoken for.
contract BachaVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    /// @notice Assets the vault is willing to custody and pay out.
    mapping(address token => bool) public approvedAsset;

    /// @notice The game contract. Only it may move inventory to a player.
    address public game;

    event AssetApprovalSet(address indexed token, bool approved);
    event GameSet(address indexed previousGame, address indexed newGame);
    event Funded(address indexed token, address indexed from, uint256 requested, uint256 received);
    event PaidOut(address indexed token, address indexed to, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    error AssetNotApproved(address token);
    error AssetIsApproved(address token);
    error ZeroAddress();
    error ZeroAmount();
    error NotWithdrawable(address token, uint256 requested, uint256 free);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);
    }

    // ---------------------------------------------------------------- config

    function setGame(address newGame) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newGame == address(0)) revert ZeroAddress();
        address previous = game;
        if (previous != address(0)) _revokeRole(GAME_ROLE, previous);
        game = newGame;
        _grantRole(GAME_ROLE, newGame);
        emit GameSet(previous, newGame);
    }

    function setAssetApproved(address token, bool approved) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        approvedAsset[token] = approved;
        emit AssetApprovalSet(token, approved);
    }

    // --------------------------------------------------------------- funding

    /// @notice Top the vault up with an approved reward asset.
    /// @dev    Permissionless on purpose — anyone may donate inventory and
    ///         nobody gains a claim on it by doing so. The balance delta is
    ///         measured rather than assumed, so an asset that takes a cut on
    ///         transfer is credited with what actually arrived.
    function fund(address token, uint256 amount) external nonReentrant returns (uint256 received) {
        if (!approvedAsset[token]) revert AssetNotApproved(token);
        if (amount == 0) revert ZeroAmount();

        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        received = IERC20(token).balanceOf(address(this)) - before;

        emit Funded(token, msg.sender, amount, received);
    }

    // ------------------------------------------------------------ accounting

    function balanceOfAsset(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice Everything currently owed to players, settled or not.
    function reservedFor(address token) public view returns (uint256) {
        address g = game;
        if (g == address(0)) return 0;
        return IPendingLiability(g).pendingLiabilityOf(token);
    }

    /// @notice Inventory that no spin has a claim on.
    function withdrawable(address token) public view returns (uint256) {
        uint256 balance = balanceOfAsset(token);
        uint256 owed = reservedFor(token);
        return balance > owed ? balance - owed : 0;
    }

    // ------------------------------------------------------------- game hook

    /// @notice Move a settled prize to its recorded winner.
    /// @dev    The destination comes from immutable spin state recorded before
    ///         randomness was even requested. The vault holds no discretion
    ///         over who gets paid, and neither does whoever triggers the claim.
    function payout(address token, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(GAME_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit PaidOut(token, to, amount);
    }

    // -------------------------------------------------------------- treasury

    /// @notice Withdraw genuinely surplus inventory.
    function withdraw(address token, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(TREASURER_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 free = withdrawable(token);
        if (free < amount) revert NotWithdrawable(token, amount, free);

        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    /// @notice Recover an asset that was never part of the reward roster.
    /// @dev    Refuses approved assets outright so it can never become a side
    ///         door around the liability check in `withdraw`.
    function rescueUnapproved(address token, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (approvedAsset[token]) revert AssetIsApproved(token);
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }
}
