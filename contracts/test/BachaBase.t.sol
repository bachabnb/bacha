// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaVault} from "../src/BachaVault.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {BachaRandomness} from "../src/BachaRandomness.sol";

/// @notice Shared fixture: a vault, a game, a randomness beacon and a small
///         roster of reward assets that mirrors the shape of the real one
///         (including a 9-decimal token, because BABYDOGE is 9 in production).
///
/// @dev    Most tests need to land a spin on a *specific* prize, which a
///         commit–reveal word cannot be steered to. `_settle` therefore
///         impersonates the beacon and delivers a chosen word straight to the
///         game's callback — the access check is still real, only the source
///         of the number is substituted. The beacon's own mechanics (commit,
///         reveal, blockhash window, replay, retry) are covered end to end in
///         BachaRandomness.t.sol against the real contract.
abstract contract BachaBase is Test {
    BachaVault internal vault;
    BachaGame internal game;
    BachaRandomness internal randomness;

    MockERC20 internal cake;
    MockERC20 internal usd1;
    MockERC20 internal babydoge; // 9 decimals

    address internal admin = makeAddr("admin");
    address internal operator = makeAddr("operator");
    address internal treasurer = makeAddr("treasurer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal bot = makeAddr("settlement-bot");
    address internal committer = makeAddr("committer");

    uint8 internal constant TIER_QUICK = 0;
    uint8 internal constant TIER_BOOST = 1;
    uint8 internal constant TIER_MAX = 2;

    uint96 internal constant QUICK_PRICE = 0.0026 ether;
    uint96 internal constant BOOST_PRICE = 0.0039 ether;
    uint96 internal constant MAX_PRICE = 0.0065 ether;

    uint64 internal v1;

    function setUp() public virtual {
        vm.prank(admin);
        randomness = new BachaRandomness(admin, committer);
        _commitSeeds(256);

        // blockhash(0) is zero, and a reveal needs a real hash to mix in.
        vm.roll(100);

        cake = new MockERC20("PancakeSwap", "CAKE", 18);
        usd1 = new MockERC20("USD1", "USD1", 18);
        babydoge = new MockERC20("Baby Doge Coin", "BABYDOGE", 9);

        vm.startPrank(admin);
        vault = new BachaVault(admin);
        game = new BachaGame(admin, address(vault), address(randomness));
        randomness.grantRole(randomness.CONSUMER_ROLE(), address(game));
        vault.setGame(address(game));
        vault.setAssetApproved(address(cake), true);
        vault.setAssetApproved(address(usd1), true);
        vault.setAssetApproved(address(babydoge), true);
        vault.grantRole(vault.TREASURER_ROLE(), treasurer);
        game.grantRole(game.OPERATOR_ROLE(), operator);
        game.grantRole(game.TREASURER_ROLE(), treasurer);
        vm.stopPrank();

        v1 = _publishDefaultTable();

        vm.startPrank(operator);
        game.configureTier(TIER_QUICK, "QUICK", QUICK_PRICE, v1, true);
        game.configureTier(TIER_BOOST, "BOOST", BOOST_PRICE, v1, true);
        game.configureTier(TIER_MAX, "MAX", MAX_PRICE, v1, true);
        vm.stopPrank();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    /// @dev 68 / 23 / 8 / 1 across four entries — the shape the UI shows.
    function _defaultPrizes() internal view returns (BachaGame.Prize[] memory prizes) {
        prizes = new BachaGame.Prize[](4);
        prizes[0] = BachaGame.Prize({
            token: address(usd1),
            amount: 1.2e18,
            weight: 6800,
            rarity: BachaGame.Rarity.Common
        });
        prizes[1] = BachaGame.Prize({
            token: address(babydoge),
            amount: 5_000_000e9,
            weight: 2300,
            rarity: BachaGame.Rarity.Uncommon
        });
        prizes[2] =
            BachaGame.Prize({token: address(cake), amount: 1.5e18, weight: 800, rarity: BachaGame.Rarity.Rare});
        prizes[3] =
            BachaGame.Prize({token: address(cake), amount: 12e18, weight: 100, rarity: BachaGame.Rarity.Epic});
    }

    function _publishDefaultTable() internal returns (uint64) {
        vm.prank(admin);
        return game.publishPrizeTable(_defaultPrizes());
    }

    function _fundVault(uint256 cakeAmt, uint256 usd1Amt, uint256 dogeAmt) internal {
        if (cakeAmt > 0) {
            cake.mint(address(this), cakeAmt);
            cake.approve(address(vault), cakeAmt);
            vault.fund(address(cake), cakeAmt);
        }
        if (usd1Amt > 0) {
            usd1.mint(address(this), usd1Amt);
            usd1.approve(address(vault), usd1Amt);
            vault.fund(address(usd1), usd1Amt);
        }
        if (dogeAmt > 0) {
            babydoge.mint(address(this), dogeAmt);
            babydoge.approve(address(vault), dogeAmt);
            vault.fund(address(babydoge), dogeAmt);
        }
    }

    /// @dev Enough inventory that solvency never gets in the way of a test.
    function _fundGenerously() internal {
        _fundVault(10_000e18, 10_000e18, 10_000_000_000e9);
    }

    function _spin(address who, uint8 tier, uint96 price) internal returns (uint256 spinId) {
        vm.prank(who);
        spinId = game.spin{value: price}(tier);
    }

    /// @dev The seed for commitment `i`, deterministic so a test can reveal it.
    function _seed(uint256 i) internal pure returns (bytes32) {
        return keccak256(abi.encode("bacha-test-seed", i));
    }

    function _commitSeeds(uint256 count) internal {
        bytes32[] memory hashes = new bytes32[](count);
        uint256 start = randomness.commitmentCount();
        for (uint256 i; i < count; ++i) {
            hashes[i] = keccak256(abi.encode(_seed(start + i)));
        }
        vm.prank(committer);
        randomness.commit(hashes);
    }

    /// @dev Deliver a chosen word as the beacon would. See the note above.
    function _settle(uint256 spinId, uint256 word) internal {
        BachaGame.Spin memory s = game.getSpin(spinId);
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        vm.prank(address(randomness));
        game.rawFulfillRandomWords(s.requestId, words);
    }

    /// @dev Deliver a word against a raw request id (for duplicate-delivery
    ///      and unknown-request assertions).
    function _settleRequest(uint256 requestId, uint256 word) internal {
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        vm.prank(address(randomness));
        game.rawFulfillRandomWords(requestId, words);
    }
}
