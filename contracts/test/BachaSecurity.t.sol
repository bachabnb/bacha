// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BachaBase} from "./BachaBase.t.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaVault} from "../src/BachaVault.sol";
import {ReentrantERC20} from "../src/mocks/MockERC20.sol";

/// @notice A contract player that tries to re-enter while receiving its refund.
contract RefundReenterer {
    BachaGame public immutable game;
    uint256 public spinId;
    bool public attacked;

    constructor(BachaGame game_) {
        game = game_;
    }

    function startSpin(uint8 tier, uint256 price) external payable {
        spinId = game.spin{value: price}(tier);
    }

    function triggerRefund() external {
        game.refundExpiredSpin(spinId);
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // Re-entering the guarded function must fail; swallowing the error
            // here proves the outer refund still completes exactly once.
            try game.refundExpiredSpin(spinId) {} catch {}
        }
    }
}

contract BachaSecurityTest is BachaBase {
    function test_refundIsNotReentrant() public {
        _fundGenerously();
        RefundReenterer attacker = new RefundReenterer(game);
        vm.deal(address(attacker), 1 ether);

        attacker.startSpin(TIER_QUICK, QUICK_PRICE);
        vm.warp(block.timestamp + game.revealTimeout() + 1);

        uint256 gameBalanceBefore = address(game).balance;
        attacker.triggerRefund();

        assertTrue(attacker.attacked(), "the re-entry path was never exercised");
        assertEq(address(attacker).balance, 1 ether, "attacker drained more than one refund");
        assertEq(gameBalanceBefore - address(game).balance, QUICK_PRICE, "game paid out twice");
        assertEq(
            uint8(game.getSpin(attacker.spinId()).status),
            uint8(BachaGame.SpinStatus.Refunded)
        );
    }

    function test_claimIsNotReentrantThroughAMaliciousRewardToken() public {
        // An asset that calls back into the game during transfer.
        ReentrantERC20 evil = new ReentrantERC20();
        vm.prank(admin);
        vault.setAssetApproved(address(evil), true);

        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](1);
        prizes[0] =
            BachaGame.Prize({token: address(evil), amount: 1e18, weight: 100, rarity: BachaGame.Rarity.Common});

        vm.startPrank(operator);
        uint64 v2 = game.publishPrizeTable(prizes);
        game.configureTier(5, "EVIL", QUICK_PRICE, v2, true);
        vm.stopPrank();

        evil.mint(address(vault), 100e18);

        uint256 spinId = _spin(alice, 5, QUICK_PRICE);
        _settle(spinId, 1);

        // Point the token's callback at a second claim of the same spin.
        evil.setAttack(address(game), abi.encodeWithSelector(BachaGame.claimFor.selector, spinId));

        // The re-entrant inner call reverts, which bubbles and reverts the
        // whole claim rather than paying twice.
        vm.expectRevert();
        game.claimFor(spinId);

        assertEq(evil.balanceOf(alice), 0, "a re-entrant claim paid out");
        assertEq(uint8(game.getSpin(spinId).status), uint8(BachaGame.SpinStatus.Settled));

        // With the callback removed the honest claim still works, once.
        evil.setAttack(address(0), "");
        game.claimFor(spinId);
        assertEq(evil.balanceOf(alice), 1e18);
    }

    function test_vaultFundIsNotReentrant() public {
        ReentrantERC20 evil = new ReentrantERC20();
        vm.prank(admin);
        vault.setAssetApproved(address(evil), true);
        evil.mint(address(this), 10e18);
        evil.approve(address(vault), type(uint256).max);
        evil.setAttack(address(vault), abi.encodeWithSelector(BachaVault.fund.selector, address(evil), 1e18));

        vm.expectRevert();
        vault.fund(address(evil), 5e18);
    }

    function test_vaultWithdrawalCannotBeFrontRunAheadOfASpin() public {
        // Inventory for exactly one worst case.
        _fundVault(12e18, 1000e18, 1_000_000_000e9);
        _spin(alice, TIER_QUICK, QUICK_PRICE);

        // The treasurer now has nothing free, even though 12 CAKE is sitting
        // in the vault — it is spoken for by the in-flight spin.
        assertEq(vault.withdrawable(address(cake)), 0);
        vm.prank(treasurer);
        vm.expectRevert();
        vault.withdraw(address(cake), treasurer, 1);
    }

    function test_settlementBotCannotRedirectARewardByReplayingTheRequest() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        BachaGame.Spin memory s = game.getSpin(spinId);

        // Even the beacon itself cannot rewrite the outcome after the fact.
        _settle(spinId, 100);
        uint256[] memory words = new uint256[](1);
        words[0] = 9999;
        vm.prank(address(randomness));
        game.rawFulfillRandomWords(s.requestId, words);

        assertEq(game.getSpin(spinId).rewardToken, address(usd1));
        assertEq(game.getSpin(spinId).randomWord, 100);
    }

    function test_operatorCannotDrainViaAZeroWeightOrOversizedTable() public {
        BachaGame.Prize[] memory tooMany = new BachaGame.Prize[](65);
        for (uint256 i; i < 65; ++i) {
            tooMany[i] =
                BachaGame.Prize({token: address(cake), amount: 1e18, weight: 1, rarity: BachaGame.Rarity.Common});
        }
        vm.prank(operator);
        vm.expectRevert(BachaGame.TooManyPrizes.selector);
        game.publishPrizeTable(tooMany);
    }

    function test_adminRoleCanBeHandedToAMultisigAndOldAdminRevoked() public {
        address multisig = makeAddr("multisig");

        vm.startPrank(admin);
        game.grantRole(game.DEFAULT_ADMIN_ROLE(), multisig);
        game.grantRole(game.OPERATOR_ROLE(), multisig);
        game.renounceRole(game.OPERATOR_ROLE(), admin);
        game.renounceRole(game.DEFAULT_ADMIN_ROLE(), admin);
        vm.stopPrank();

        assertFalse(game.hasRole(game.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(game.hasRole(game.DEFAULT_ADMIN_ROLE(), multisig));

        vm.prank(admin);
        vm.expectRevert();
        game.pause();

        vm.prank(multisig);
        game.pause();
        assertTrue(game.paused());
    }

    // ------------------------------------------------- prize ceiling

    /// @dev The governor retunes odds automatically as prices move, so a hot
    ///      key holds OPERATOR_ROLE in production. The ceiling is what stops
    ///      that key publishing a table whose top prize is the whole vault.
    function test_prizeCeilingBoundsWhatAnOperatorCanPublish() public {
        vm.prank(admin);
        game.setPrizeCeiling(address(cake), 5e18);

        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](1);
        prizes[0] =
            BachaGame.Prize({token: address(cake), amount: 5_000e18, weight: 10000, rarity: BachaGame.Rarity.Epic});

        vm.expectRevert(
            abi.encodeWithSelector(BachaGame.PrizeExceedsCeiling.selector, address(cake), 5_000e18, 5e18)
        );
        vm.prank(operator);
        game.publishPrizeTable(prizes);
    }

    function test_prizeCeilingAllowsAnythingAtOrBelowIt() public {
        vm.prank(admin);
        game.setPrizeCeiling(address(cake), 5e18);

        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](1);
        prizes[0] =
            BachaGame.Prize({token: address(cake), amount: 5e18, weight: 10000, rarity: BachaGame.Rarity.Epic});

        vm.prank(operator);
        uint64 versionId = game.publishPrizeTable(prizes);
        assertGt(versionId, 0);
    }

    function test_operatorCannotRaiseItsOwnCeiling() public {
        vm.prank(admin);
        game.setPrizeCeiling(address(cake), 5e18);

        vm.expectRevert();
        vm.prank(operator);
        game.setPrizeCeiling(address(cake), type(uint256).max);

        assertEq(game.prizeCeiling(address(cake)), 5e18);
    }

    /// @dev A ceiling set today must not rewrite a table published yesterday.
    function test_ceilingDoesNotDisturbAlreadyPublishedTables() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);

        vm.prank(admin);
        game.setPrizeCeiling(address(cake), 1);

        _settle(spinId, 9950); // the 12 CAKE epic, far above the new ceiling
        BachaGame.Spin memory s = game.getSpin(spinId);
        assertEq(uint8(s.status), uint8(BachaGame.SpinStatus.Settled));
        assertEq(s.rewardToken, address(cake));
        assertEq(s.rewardAmount, 12e18);
    }
}
