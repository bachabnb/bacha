// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaVault} from "../src/BachaVault.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {BachaRandomness} from "../src/BachaRandomness.sol";

/// @notice Drives the machine through arbitrary sequences of player and
///         operator actions so the invariants below are checked against states
///         no hand-written test would think to construct.
contract BachaHandler is Test {
    BachaGame public game;
    BachaVault public vault;
    BachaRandomness public randomness;
    address public committer;
    MockERC20[3] public tokens;
    address public operator;
    address public treasurer;

    uint256[] public pendingSpinIds;
    uint256[] public settledSpinIds;

    // Ghost state the invariants compare against.
    mapping(uint256 spinId => uint64 versionAtRequest) public ghostVersionAtRequest;
    mapping(uint256 spinId => bytes32 hashAtRequest) public ghostHashAtRequest;
    mapping(uint256 spinId => uint256 timesPaid) public ghostTimesPaid;
    mapping(address token => uint256 amount) public ghostTotalPaidOut;
    uint256 public ghostSpinsCreated;
    uint256 public ghostVersionsPublished;

    constructor(
        BachaGame game_,
        BachaVault vault_,
        BachaRandomness randomness_,
        MockERC20[3] memory tokens_,
        address operator_,
        address treasurer_,
        address committer_
    ) {
        game = game_;
        vault = vault_;
        randomness = randomness_;
        committer = committer_;
        tokens = tokens_;
        operator = operator_;
        treasurer = treasurer_;
    }

    /// @dev Mirrors the fixture's seed derivation so a reveal can be produced.
    function _seed(uint256 i) internal pure returns (bytes32) {
        return keccak256(abi.encode("bacha-invariant-seed", i));
    }

    /// @dev The beacon runs dry as spins consume it, exactly as in production.
    function _topUpCommitments() internal {
        if (randomness.availableCommitments() > 4) return;
        uint256 start = randomness.commitmentCount();
        bytes32[] memory hashes = new bytes32[](32);
        for (uint256 i; i < 32; ++i) {
            hashes[i] = keccak256(abi.encode(_seed(start + i)));
        }
        vm.prank(committer);
        randomness.commit(hashes);
    }

    function _player(uint256 seed) internal returns (address who) {
        who = address(uint160(0x1000 + (seed % 5)));
        vm.deal(who, 10 ether);
    }

    function spin(uint256 seed) external {
        uint8 tier = uint8(seed % 3);
        BachaGame.Tier memory t;
        try game.getTier(tier) returns (BachaGame.Tier memory got) {
            t = got;
        } catch {
            return;
        }
        if (!t.active) return;

        _topUpCommitments();

        address who = _player(seed);
        vm.prank(who);
        try game.spin{value: t.price}(tier) returns (uint256 spinId) {
            BachaGame.Spin memory s = game.getSpin(spinId);
            ghostVersionAtRequest[spinId] = s.versionId;
            ghostHashAtRequest[spinId] = s.prizeTableHash;
            pendingSpinIds.push(spinId);
            ghostSpinsCreated++;
        } catch {
            // Refused for inventory, pause or tier reasons — a valid outcome.
        }
    }

    /// @param blocksAhead fuzzed. Small values settle; large ones can push a
    ///        request past the 256-block blockhash window, which is a real
    ///        production state — those spins stay pending and fall through to
    ///        the refund path, and the invariants must hold either way.
    function settle(uint256 index, uint256 blocksAhead) external {
        if (pendingSpinIds.length == 0) return;
        index = index % pendingSpinIds.length;
        uint256 spinId = pendingSpinIds[index];

        BachaGame.Spin memory s = game.getSpin(spinId);
        if (s.status != BachaGame.SpinStatus.Pending) {
            _removePending(index);
            return;
        }

        BachaRandomness.Request memory req = randomness.getRequest(s.requestId);
        vm.roll(block.number + (blocksAhead % 8) + randomness.revealDelay() + 1);
        if (!randomness.revealable(s.requestId)) return;

        vm.prank(committer);
        randomness.reveal(s.requestId, _seed(req.commitmentIndex));

        if (game.getSpin(spinId).status != BachaGame.SpinStatus.Settled) return;
        _removePending(index);
        settledSpinIds.push(spinId);
    }

    function claim(uint256 index) external {
        if (settledSpinIds.length == 0) return;
        index = index % settledSpinIds.length;
        uint256 spinId = settledSpinIds[index];

        BachaGame.Spin memory s = game.getSpin(spinId);
        if (s.status != BachaGame.SpinStatus.Settled) {
            _removeSettled(index);
            return;
        }
        try game.claimFor(spinId) {
            ghostTimesPaid[spinId] += 1;
            ghostTotalPaidOut[s.rewardToken] += s.rewardAmount;
        } catch {}
        _removeSettled(index);
    }

    /// @dev Deliberately tries to claim twice in one go.
    function doubleClaim(uint256 index) external {
        if (settledSpinIds.length == 0) return;
        index = index % settledSpinIds.length;
        uint256 spinId = settledSpinIds[index];
        BachaGame.Spin memory s = game.getSpin(spinId);
        if (s.status != BachaGame.SpinStatus.Settled) return;

        try game.claimFor(spinId) {
            ghostTimesPaid[spinId] += 1;
            ghostTotalPaidOut[s.rewardToken] += s.rewardAmount;
        } catch {}
        try game.claimFor(spinId) {
            ghostTimesPaid[spinId] += 1;
            ghostTotalPaidOut[s.rewardToken] += s.rewardAmount;
        } catch {}
    }

    function fund(uint256 tokenSeed, uint96 amount) external {
        if (amount == 0) return;
        MockERC20 token = tokens[tokenSeed % 3];
        token.mint(address(this), amount);
        token.approve(address(vault), amount);
        vault.fund(address(token), amount);
    }

    /// @dev Always tries to drain the maximum the vault claims is free.
    function withdrawMax(uint256 tokenSeed) external {
        MockERC20 token = tokens[tokenSeed % 3];
        uint256 free = vault.withdrawable(address(token));
        if (free == 0) return;
        vm.prank(treasurer);
        try vault.withdraw(address(token), treasurer, free) {} catch {}
    }

    /// @dev Republish odds and repoint a tier while spins are in flight.
    function republish(uint256 seed) external {
        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](2);
        prizes[0] = BachaGame.Prize({
            token: address(tokens[seed % 3]),
            amount: uint128(1e18 + (seed % 5) * 1e18),
            weight: uint32(1 + (seed % 900)),
            rarity: BachaGame.Rarity.Common
        });
        prizes[1] = BachaGame.Prize({
            token: address(tokens[(seed + 1) % 3]),
            amount: uint128(1e15 + (seed % 7) * 1e15),
            weight: uint32(1 + (seed % 500)),
            rarity: BachaGame.Rarity.Rare
        });

        vm.prank(operator);
        try game.publishPrizeTable(prizes) returns (uint64 versionId) {
            ghostVersionsPublished++;
            vm.prank(operator);
            try game.configureTier(uint8(seed % 3), "R", uint96(0.001 ether), versionId, true) {} catch {}
        } catch {}
    }

    function togglePause(uint256 seed) external {
        vm.prank(operator);
        if (seed % 2 == 0) {
            try game.pause() {} catch {}
        } else {
            try game.unpause() {} catch {}
        }
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + (seconds_ % 5 days) + 1);
    }

    function refundExpired(uint256 index) external {
        if (pendingSpinIds.length == 0) return;
        index = index % pendingSpinIds.length;
        uint256 spinId = pendingSpinIds[index];
        try game.refundExpiredSpin(spinId) {
            _removePending(index);
        } catch {}
    }

    function _removePending(uint256 index) internal {
        pendingSpinIds[index] = pendingSpinIds[pendingSpinIds.length - 1];
        pendingSpinIds.pop();
    }

    function _removeSettled(uint256 index) internal {
        settledSpinIds[index] = settledSpinIds[settledSpinIds.length - 1];
        settledSpinIds.pop();
    }

    receive() external payable {}
}

contract BachaInvariantTest is Test {
    BachaGame internal game;
    BachaVault internal vault;
    BachaRandomness internal randomness;
    BachaHandler internal handler;
    MockERC20[3] internal tokens;

    address internal admin = makeAddr("admin");
    address internal operator = makeAddr("operator");
    address internal treasurer = makeAddr("treasurer");
    address internal committer = makeAddr("committer");

    function setUp() public {
        vm.prank(admin);
        randomness = new BachaRandomness(admin, committer);
        vm.roll(100);
        tokens[0] = new MockERC20("Alpha", "ALPHA", 18);
        tokens[1] = new MockERC20("Beta", "BETA", 6);
        tokens[2] = new MockERC20("Gamma", "GAMMA", 9);

        vm.startPrank(admin);
        vault = new BachaVault(admin);
        game = new BachaGame(admin, address(vault), address(randomness));
        randomness.grantRole(randomness.CONSUMER_ROLE(), address(game));
        vault.setGame(address(game));
        for (uint256 i; i < 3; ++i) {
            vault.setAssetApproved(address(tokens[i]), true);
        }
        vault.grantRole(vault.TREASURER_ROLE(), treasurer);
        game.grantRole(game.OPERATOR_ROLE(), operator);
        vm.stopPrank();

        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](3);
        prizes[0] =
            BachaGame.Prize({token: address(tokens[0]), amount: 1e18, weight: 7000, rarity: BachaGame.Rarity.Common});
        prizes[1] =
            BachaGame.Prize({token: address(tokens[1]), amount: 5e6, weight: 2500, rarity: BachaGame.Rarity.Uncommon});
        prizes[2] =
            BachaGame.Prize({token: address(tokens[2]), amount: 9e9, weight: 500, rarity: BachaGame.Rarity.Epic});

        vm.startPrank(operator);
        uint64 v = game.publishPrizeTable(prizes);
        game.configureTier(0, "QUICK", 0.0026 ether, v, true);
        game.configureTier(1, "BOOST", 0.0039 ether, v, true);
        game.configureTier(2, "MAX", 0.0065 ether, v, true);
        vm.stopPrank();

        handler = new BachaHandler(game, vault, randomness, tokens, operator, treasurer, committer);

        // Seed inventory so the machine can actually run.
        for (uint256 i; i < 3; ++i) {
            tokens[i].mint(address(this), 1_000_000e18);
            tokens[i].approve(address(vault), type(uint256).max);
            vault.fund(address(tokens[i]), 500_000e18);
        }

        targetContract(address(handler));
    }

    /// @notice The vault can always honour everything it owes.
    /// @dev    This is the treasury-safety property: settled-unclaimed prizes
    ///         plus the worst case for every in-flight spin never exceed what
    ///         is actually sitting in the vault.
    function invariant_vaultCoversEveryObligation() public view {
        for (uint256 i; i < 3; ++i) {
            address token = address(tokens[i]);
            assertGe(
                vault.balanceOfAsset(token),
                game.pendingLiabilityOf(token),
                "vault owes more than it holds"
            );
        }
    }

    /// @notice A spin's machine version and prize-table hash are write-once.
    function invariant_pendingSpinNeverChangesVersion() public view {
        uint256 total = game.spinCount();
        for (uint256 id = 1; id <= total; ++id) {
            uint64 recorded = handler.ghostVersionAtRequest(id);
            if (recorded == 0) continue;
            BachaGame.Spin memory s = game.getSpin(id);
            assertEq(s.versionId, recorded, "machine version drifted after the spin was sold");
            assertEq(s.prizeTableHash, handler.ghostHashAtRequest(id), "prize table hash drifted");
        }
    }

    /// @notice One spin pays out at most once, for at most one asset.
    function invariant_eachSpinPaysAtMostOnce() public view {
        uint256 total = game.spinCount();
        for (uint256 id = 1; id <= total; ++id) {
            BachaGame.Spin memory s = game.getSpin(id);
            if (s.status == BachaGame.SpinStatus.None) continue;
            assertLe(handler.ghostTimesPaid(id), 1, "a spin paid out more than once");
            if (s.status == BachaGame.SpinStatus.Claimed) {
                assertEq(handler.ghostTimesPaid(id), 1, "claimed spin did not pay exactly once");
            }
        }
    }

    /// @notice Every published table still sums to the weight it recorded.
    function invariant_prizeWeightsStayConsistent() public view {
        uint64 count = game.versionCount();
        for (uint64 v = 1; v <= count; ++v) {
            (BachaGame.Version memory version, BachaGame.Prize[] memory prizes,) = game.getVersion(v);
            uint256 sum;
            for (uint256 i; i < prizes.length; ++i) {
                assertGt(prizes[i].weight, 0, "zero-weight entry slipped into a table");
                assertGt(prizes[i].amount, 0, "zero-amount entry slipped into a table");
                sum += prizes[i].weight;
            }
            assertEq(sum, version.totalWeight, "recorded total weight no longer matches the entries");
        }
    }

    /// @notice Spin revenue that could still be refunded is never spendable.
    function invariant_refundablePaymentsAreBacked() public view {
        assertGe(address(game).balance, game.refundablePayments(), "refund obligations exceed held BNB");
    }

    /// @notice A settled spin always carries an asset and an amount.
    function invariant_settledSpinsHaveAReward() public view {
        uint256 total = game.spinCount();
        for (uint256 id = 1; id <= total; ++id) {
            BachaGame.Spin memory s = game.getSpin(id);
            if (s.status == BachaGame.SpinStatus.Settled || s.status == BachaGame.SpinStatus.Claimed) {
                assertTrue(s.rewardToken != address(0), "settled spin has no asset");
                assertGt(s.rewardAmount, 0, "settled spin has a zero reward");
                assertGt(s.settledAt, 0, "settled spin has no timestamp");
            }
        }
    }
}
