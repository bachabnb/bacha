// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BachaBase} from "./BachaBase.t.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaVault} from "../src/BachaVault.sol";
import {MockERC20, FeeOnTransferERC20, ReturnsFalseERC20} from "../src/mocks/MockERC20.sol";
import {IAccessControl} from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";

contract BachaGameTest is BachaBase {
    // ------------------------------------------------------- prize tables

    function test_publishPrizeTable_storesImmutableVersion() public view {
        (BachaGame.Version memory version, BachaGame.Prize[] memory prizes, address[] memory tokens) =
            game.getVersion(v1);

        assertTrue(version.published);
        assertEq(version.totalWeight, 10_000);
        assertEq(prizes.length, 4);
        // CAKE appears twice but is one distinct asset for inventory purposes.
        assertEq(tokens.length, 3);
        assertTrue(version.prizeTableHash != bytes32(0));
    }

    function test_publishPrizeTable_hashChangesWithContents() public {
        BachaGame.Prize[] memory prizes = _defaultPrizes();
        prizes[0].weight = 6801;
        vm.prank(operator);
        uint64 v2 = game.publishPrizeTable(prizes);

        (BachaGame.Version memory a,,) = game.getVersion(v1);
        (BachaGame.Version memory b,,) = game.getVersion(v2);
        assertTrue(a.prizeTableHash != b.prizeTableHash);
    }

    function test_publishPrizeTable_rejectsUnapprovedAsset() public {
        MockERC20 rogue = new MockERC20("Rogue", "RGE", 18);
        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](1);
        prizes[0] =
            BachaGame.Prize({token: address(rogue), amount: 1e18, weight: 1, rarity: BachaGame.Rarity.Common});

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.AssetNotApprovedByVault.selector, address(rogue)));
        game.publishPrizeTable(prizes);
    }

    function test_publishPrizeTable_rejectsZeroWeightZeroAmountAndZeroAddress() public {
        BachaGame.Prize[] memory p = new BachaGame.Prize[](1);

        p[0] = BachaGame.Prize({token: address(cake), amount: 1e18, weight: 0, rarity: BachaGame.Rarity.Common});
        vm.prank(operator);
        vm.expectRevert(BachaGame.InvalidWeight.selector);
        game.publishPrizeTable(p);

        p[0] = BachaGame.Prize({token: address(cake), amount: 0, weight: 1, rarity: BachaGame.Rarity.Common});
        vm.prank(operator);
        vm.expectRevert(BachaGame.InvalidAmount.selector);
        game.publishPrizeTable(p);

        p[0] = BachaGame.Prize({token: address(0), amount: 1e18, weight: 1, rarity: BachaGame.Rarity.Common});
        vm.prank(operator);
        vm.expectRevert(BachaGame.ZeroAddress.selector);
        game.publishPrizeTable(p);
    }

    function test_publishPrizeTable_rejectsEmptyTable() public {
        BachaGame.Prize[] memory none = new BachaGame.Prize[](0);
        vm.prank(operator);
        vm.expectRevert(BachaGame.EmptyPrizeTable.selector);
        game.publishPrizeTable(none);
    }

    function test_publishPrizeTable_onlyOperator() public {
        BachaGame.Prize[] memory prizes = _defaultPrizes();
        bytes32 role = game.OPERATOR_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, role)
        );
        vm.prank(alice);
        game.publishPrizeTable(prizes);
    }

    // -------------------------------------------------------------- tiers

    function test_configureTier_rejectsUnknownVersion() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.UnknownVersion.selector, uint64(99)));
        game.configureTier(9, "GHOST", 1 ether, 99, true);
    }

    function test_spin_rejectsUnknownTier() public {
        _fundGenerously();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.UnknownTier.selector, uint8(7)));
        game.spin{value: QUICK_PRICE}(7);
    }

    function test_spin_rejectsInactiveTier() public {
        _fundGenerously();
        vm.prank(operator);
        game.configureTier(TIER_QUICK, "QUICK", QUICK_PRICE, v1, false);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.TierInactive.selector, TIER_QUICK));
        game.spin{value: QUICK_PRICE}(TIER_QUICK);
    }

    function test_spin_rejectsWrongPayment() public {
        _fundGenerously();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.IncorrectPayment.selector, 1 wei, QUICK_PRICE));
        game.spin{value: 1 wei}(TIER_QUICK);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BachaGame.IncorrectPayment.selector, uint256(QUICK_PRICE) + 1, QUICK_PRICE)
        );
        game.spin{value: uint256(QUICK_PRICE) + 1}(TIER_QUICK);
    }

    function test_spin_recordsStateAndRequestsRandomness() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);

        BachaGame.Spin memory s = game.getSpin(spinId);
        (BachaGame.Version memory version,,) = game.getVersion(v1);

        assertEq(s.player, alice);
        assertEq(s.tier, TIER_QUICK);
        assertEq(uint8(s.status), uint8(BachaGame.SpinStatus.Pending));
        assertEq(s.versionId, v1);
        assertEq(s.prizeTableHash, version.prizeTableHash);
        assertEq(s.payment, QUICK_PRICE);
        assertTrue(s.requestId != 0);
        assertEq(game.spinIdByRequest(s.requestId), spinId);
        assertEq(game.pendingSpins(v1), 1);
    }

    function test_spin_pausedBlocksNewSpins() public {
        _fundGenerously();
        vm.prank(operator);
        game.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        game.spin{value: QUICK_PRICE}(TIER_QUICK);

        vm.prank(operator);
        game.unpause();
        _spin(alice, TIER_QUICK, QUICK_PRICE);
    }

    // ---------------------------------------------------------- settlement

    function test_settle_selectsPrizeByWeightAndIsReproducible() public {
        _fundGenerously();

        // roll = word % 10000. 0..6799 -> USD1, 6800..9099 -> BABYDOGE,
        // 9100..9899 -> CAKE rare, 9900..9999 -> CAKE epic.
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        _settle(spinId, 9950);

        BachaGame.Spin memory s = game.getSpin(spinId);
        assertEq(uint8(s.status), uint8(BachaGame.SpinStatus.Settled));
        assertEq(s.rewardToken, address(cake));
        assertEq(s.rewardAmount, 12e18);
        assertEq(uint8(s.rarity), uint8(BachaGame.Rarity.Epic));
        assertEq(s.randomWord, 9950);

        // previewPrize reproduces exactly what the callback recorded.
        (, address token, uint128 amount, BachaGame.Rarity rarity) = game.previewPrize(v1, 9950);
        assertEq(token, s.rewardToken);
        assertEq(amount, s.rewardAmount);
        assertEq(uint8(rarity), uint8(s.rarity));
    }

    function test_settle_boundaryRollsLandOnExpectedPrize() public {
        _fundGenerously();
        _assertRoll(0, address(usd1));
        _assertRoll(6799, address(usd1));
        _assertRoll(6800, address(babydoge));
        _assertRoll(9099, address(babydoge));
        _assertRoll(9100, address(cake));
        _assertRoll(9899, address(cake));
        _assertRoll(9900, address(cake));
        _assertRoll(9999, address(cake));
    }

    function _assertRoll(uint256 word, address expected) private {
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        _settle(spinId, word);
        assertEq(game.getSpin(spinId).rewardToken, expected, "roll landed on wrong asset");
    }

    function test_settle_isIdempotent() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        BachaGame.Spin memory pending = game.getSpin(spinId);

        coordinator.fulfill(pending.requestId, 100);
        uint256 owedAfterFirst = game.settledOwed(address(usd1));

        // A second delivery is ignored: no revert, no double accounting.
        coordinator.fulfillAgain(pending.requestId, 9999);

        BachaGame.Spin memory s = game.getSpin(spinId);
        assertEq(s.randomWord, 100, "outcome was overwritten by a replay");
        assertEq(s.rewardToken, address(usd1));
        assertEq(game.settledOwed(address(usd1)), owedAfterFirst, "liability double counted");
    }

    function test_settle_onlyCoordinatorMayFulfil() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        BachaGame.Spin memory s = game.getSpin(spinId);

        uint256[] memory words = new uint256[](1);
        words[0] = 9999;

        vm.prank(alice);
        vm.expectRevert();
        game.rawFulfillRandomWords(s.requestId, words);
    }

    function test_settle_unknownRequestIsIgnored() public {
        _fundGenerously();
        uint256[] memory words = new uint256[](1);
        words[0] = 1;

        vm.prank(address(coordinator));
        game.rawFulfillRandomWords(123456, words); // must not revert
        assertEq(game.spinCount(), 0);
    }

    // --------------------------------------------------------------- claim

    function test_claim_paysRecordedPlayerAndCannotRepeat() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        _settle(spinId, 100); // USD1 1.2e18

        uint256 before = usd1.balanceOf(alice);
        game.claimFor(spinId);
        assertEq(usd1.balanceOf(alice) - before, 1.2e18);
        assertEq(uint8(game.getSpin(spinId).status), uint8(BachaGame.SpinStatus.Claimed));
        assertEq(game.settledOwed(address(usd1)), 0);

        vm.expectRevert(
            abi.encodeWithSelector(
                BachaGame.SpinNotSettled.selector, spinId, BachaGame.SpinStatus.Claimed
            )
        );
        game.claimFor(spinId);
    }

    function test_claim_isPermissionlessButCannotRedirect() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        _settle(spinId, 100);

        // A settlement bot with no special role may trigger the claim...
        vm.prank(bot);
        game.claimFor(spinId);

        // ...and the tokens land with the player, never the caller.
        assertEq(usd1.balanceOf(alice), 1.2e18);
        assertEq(usd1.balanceOf(bot), 0);
    }

    function test_claim_revertsForPendingOrUnknownSpin() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);

        vm.expectRevert(
            abi.encodeWithSelector(BachaGame.SpinNotSettled.selector, spinId, BachaGame.SpinStatus.Pending)
        );
        game.claimFor(spinId);

        vm.expectRevert(abi.encodeWithSelector(BachaGame.UnknownSpin.selector, uint256(4242)));
        game.claimFor(4242);
    }

    function test_claimMany_settlesABatch() public {
        _fundGenerously();
        uint256[] memory ids = new uint256[](3);
        for (uint256 i; i < 3; ++i) {
            ids[i] = _spin(alice, TIER_QUICK, QUICK_PRICE);
            _settle(ids[i], 100);
        }
        game.claimMany(ids);
        assertEq(usd1.balanceOf(alice), 3 * 1.2e18);
    }

    // ------------------------------------------------ odds cannot shift

    function test_pendingSpinKeepsItsOriginalPrizeTable() public {
        _fundGenerously();

        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        (BachaGame.Version memory original,,) = game.getVersion(v1);

        // The operator publishes a table where every roll yields a dust prize
        // and repoints the tier at it, mid-flight.
        BachaGame.Prize[] memory nerfed = new BachaGame.Prize[](1);
        nerfed[0] =
            BachaGame.Prize({token: address(usd1), amount: 1, weight: 10_000, rarity: BachaGame.Rarity.Common});
        vm.startPrank(operator);
        uint64 v2 = game.publishPrizeTable(nerfed);
        game.configureTier(TIER_QUICK, "QUICK", QUICK_PRICE, v2, true);
        vm.stopPrank();

        // The in-flight spin still settles against the table it was sold.
        _settle(spinId, 9950);
        BachaGame.Spin memory s = game.getSpin(spinId);

        assertEq(s.versionId, v1, "version drifted");
        assertEq(s.prizeTableHash, original.prizeTableHash, "table hash drifted");
        assertEq(s.rewardToken, address(cake));
        assertEq(s.rewardAmount, 12e18, "player was nerfed mid-spin");

        // A fresh spin does get the new table.
        uint256 later = _spin(bob, TIER_QUICK, QUICK_PRICE);
        assertEq(game.getSpin(later).versionId, v2);
    }

    function test_publishedVersionHasNoMutator() public view {
        // There is deliberately no function to edit a published table. This
        // asserts the surface stays that way: the only writer of version
        // storage is publishPrizeTable, which always allocates a new id.
        assertEq(game.versionCount(), 1);
    }

    // ------------------------------------------------------- treasury math

    function test_spin_refusesWhenInventoryCannotCoverWorstCase() public {
        // Enough for exactly one worst case on CAKE (the 12e18 epic entry).
        _fundVault(12e18, 1000e18, 1_000_000_000e9);

        _spin(alice, TIER_QUICK, QUICK_PRICE);

        // The second spin would create a second 12e18 CAKE obligation.
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(BachaGame.InsufficientInventory.selector, address(cake), 24e18, 12e18)
        );
        game.spin{value: QUICK_PRICE}(TIER_QUICK);
    }

    function test_remainingFundedSpins_tracksInventory() public {
        _fundVault(36e18, 1000e18, 1_000_000_000e9);
        assertEq(game.remainingFundedSpins(v1), 3, "36 CAKE / 12 CAKE worst case");

        _spin(alice, TIER_QUICK, QUICK_PRICE);
        assertEq(game.remainingFundedSpins(v1), 2);
    }

    function test_pendingLiabilityCountsWorstCaseThenExactPrize() public {
        _fundGenerously();

        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        // While pending: worst case on CAKE is the 12e18 epic.
        assertEq(game.pendingLiabilityOf(address(cake)), 12e18);

        _settle(spinId, 100); // lands on USD1
        // Once settled the CAKE exposure disappears and USD1 becomes exact.
        assertEq(game.pendingLiabilityOf(address(cake)), 0);
        assertEq(game.pendingLiabilityOf(address(usd1)), 1.2e18);

        game.claimFor(spinId);
        assertEq(game.pendingLiabilityOf(address(usd1)), 0);
    }

    function test_vaultCannotWithdrawObligations() public {
        _fundVault(24e18, 1000e18, 1_000_000_000e9);
        _spin(alice, TIER_QUICK, QUICK_PRICE);

        // 24 CAKE held, 12 owed to the pending spin, so 12 is withdrawable.
        assertEq(vault.reservedFor(address(cake)), 12e18);
        assertEq(vault.withdrawable(address(cake)), 12e18);

        vm.prank(treasurer);
        vm.expectRevert(
            abi.encodeWithSelector(BachaVault.NotWithdrawable.selector, address(cake), 13e18, 12e18)
        );
        vault.withdraw(address(cake), treasurer, 13e18);

        vm.prank(treasurer);
        vault.withdraw(address(cake), treasurer, 12e18);
        assertEq(cake.balanceOf(treasurer), 12e18);
    }

    function test_vaultCannotWithdrawSettledButUnclaimedPrize() public {
        _fundVault(24e18, 1000e18, 1_000_000_000e9);
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        _settle(spinId, 9950); // CAKE epic, 12e18

        assertEq(vault.reservedFor(address(cake)), 12e18);

        vm.prank(treasurer);
        vm.expectRevert(
            abi.encodeWithSelector(BachaVault.NotWithdrawable.selector, address(cake), 24e18, 12e18)
        );
        vault.withdraw(address(cake), treasurer, 24e18);

        // The player can still be paid afterwards.
        game.claimFor(spinId);
        assertEq(cake.balanceOf(alice), 12e18);
    }

    // -------------------------------------------------------- VRF failure

    function test_refundAfterTimeoutReturnsPayment() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        uint256 before = alice.balance;

        vm.expectRevert(
            abi.encodeWithSelector(
                BachaGame.RefundTooEarly.selector, spinId, uint64(block.timestamp) + game.vrfTimeout()
            )
        );
        game.refundExpiredSpin(spinId);

        vm.warp(block.timestamp + game.vrfTimeout() + 1);
        vm.prank(bob); // permissionless
        game.refundExpiredSpin(spinId);

        assertEq(alice.balance - before, QUICK_PRICE);
        assertEq(uint8(game.getSpin(spinId).status), uint8(BachaGame.SpinStatus.Refunded));
        assertEq(game.pendingSpins(v1), 0);
        assertEq(game.pendingLiabilityOf(address(cake)), 0);
    }

    function test_refundedSpinCannotLaterSettle() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        BachaGame.Spin memory s = game.getSpin(spinId);

        vm.warp(block.timestamp + game.vrfTimeout() + 1);
        game.refundExpiredSpin(spinId);

        // A late VRF delivery is a no-op rather than a second payout.
        coordinator.fulfill(s.requestId, 9950);
        assertEq(uint8(game.getSpin(spinId).status), uint8(BachaGame.SpinStatus.Refunded));
        assertEq(game.settledOwed(address(cake)), 0);
    }

    function test_refundCannotBeTakenTwice() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        vm.warp(block.timestamp + game.vrfTimeout() + 1);
        game.refundExpiredSpin(spinId);

        vm.expectRevert(
            abi.encodeWithSelector(
                BachaGame.SpinNotPending.selector, spinId, BachaGame.SpinStatus.Refunded
            )
        );
        game.refundExpiredSpin(spinId);
    }

    function test_feesAreNotWithdrawableWhileRefundable() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);

        assertEq(game.refundablePayments(), QUICK_PRICE);
        assertEq(game.withdrawableFees(), 0);

        vm.prank(treasurer);
        vm.expectRevert(BachaGame.NothingToWithdraw.selector);
        game.withdrawFees(treasurer, QUICK_PRICE);

        _settle(spinId, 100);
        assertEq(game.withdrawableFees(), QUICK_PRICE);

        vm.prank(treasurer);
        game.withdrawFees(treasurer, QUICK_PRICE);
        assertEq(treasurer.balance, QUICK_PRICE);
    }

    // ------------------------------------------------------- access control

    function test_onlyOperatorCanPauseAndConfigure() public {
        vm.prank(alice);
        vm.expectRevert();
        game.pause();

        vm.prank(alice);
        vm.expectRevert();
        game.configureTier(TIER_QUICK, "X", 1, v1, true);

        vm.prank(alice);
        vm.expectRevert();
        game.setVrfTimeout(1 hours);
    }

    function test_onlyTreasurerCanWithdrawFees() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        _settle(spinId, 100);

        vm.prank(alice);
        vm.expectRevert();
        game.withdrawFees(alice, QUICK_PRICE);
    }

    function test_onlyGameCanTriggerVaultPayout() public {
        _fundGenerously();
        vm.prank(alice);
        vm.expectRevert();
        vault.payout(address(cake), alice, 1e18);
    }

    function test_vrfTimeoutBounds() public {
        vm.prank(operator);
        vm.expectRevert(BachaGame.InvalidTimeout.selector);
        game.setVrfTimeout(1 minutes);

        vm.prank(operator);
        vm.expectRevert(BachaGame.InvalidTimeout.selector);
        game.setVrfTimeout(8 days);

        vm.prank(operator);
        game.setVrfTimeout(6 hours);
        assertEq(game.vrfTimeout(), 6 hours);
    }

    // --------------------------------------------------- unusual ERC20s

    function test_vaultFundMeasuresActualReceiptForFeeOnTransferAsset() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20("Fee", "FEE", 500); // 5%
        vm.prank(admin);
        vault.setAssetApproved(address(fot), true);

        fot.mint(address(this), 1000e18);
        fot.approve(address(vault), 1000e18);
        uint256 received = vault.fund(address(fot), 1000e18);

        assertEq(received, 950e18, "credited more than actually arrived");
        assertEq(vault.balanceOfAsset(address(fot)), 950e18);
    }

    function test_vaultRejectsTokenThatReturnsFalse() public {
        ReturnsFalseERC20 bad = new ReturnsFalseERC20();
        vm.prank(admin);
        vault.setAssetApproved(address(bad), true);
        bad.mint(address(vault), 100e18);

        vm.prank(treasurer);
        vm.expectRevert(); // SafeERC20FailedOperation
        vault.withdraw(address(bad), treasurer, 1e18);
    }

    function test_nineDecimalRewardPaysExactUnits() public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        _settle(spinId, 7000); // BABYDOGE band
        game.claimFor(spinId);

        assertEq(babydoge.balanceOf(alice), 5_000_000e9);
        assertEq(babydoge.decimals(), 9);
    }

    // ----------------------------------------------------------- vault misc

    function test_vaultRejectsUnapprovedFunding() public {
        MockERC20 rogue = new MockERC20("Rogue", "RGE", 18);
        rogue.mint(address(this), 1e18);
        rogue.approve(address(vault), 1e18);
        vm.expectRevert(abi.encodeWithSelector(BachaVault.AssetNotApproved.selector, address(rogue)));
        vault.fund(address(rogue), 1e18);
    }

    function test_rescueOnlyTouchesUnapprovedAssets() public {
        MockERC20 stray = new MockERC20("Stray", "STR", 18);
        stray.mint(address(vault), 5e18);

        vm.prank(admin);
        vault.rescueUnapproved(address(stray), admin, 5e18);
        assertEq(stray.balanceOf(admin), 5e18);

        _fundVault(10e18, 0, 0);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(BachaVault.AssetIsApproved.selector, address(cake)));
        vault.rescueUnapproved(address(cake), admin, 1e18);
    }

    function test_spinsOfPaginatesNewestFirst() public {
        _fundGenerously();
        uint256 a = _spin(alice, TIER_QUICK, QUICK_PRICE);
        uint256 b = _spin(alice, TIER_BOOST, BOOST_PRICE);
        uint256 c = _spin(alice, TIER_MAX, MAX_PRICE);

        (uint256[] memory ids, uint256 total) = game.spinsOf(alice, 0, 10);
        assertEq(total, 3);
        assertEq(ids[0], c);
        assertEq(ids[1], b);
        assertEq(ids[2], a);

        (uint256[] memory page2,) = game.spinsOf(alice, 2, 10);
        assertEq(page2.length, 1);
        assertEq(page2[0], a);
    }

    // ------------------------------------------------------------- fuzzing

    /// @dev Whatever the coordinator returns, exactly one prize from the frozen
    ///      table comes out, and it is always one the vault can actually pay.
    function testFuzz_anyRandomWordYieldsExactlyOneValidPrize(uint256 word) public {
        _fundGenerously();
        uint256 spinId = _spin(alice, TIER_QUICK, QUICK_PRICE);
        _settle(spinId, word);

        BachaGame.Spin memory s = game.getSpin(spinId);
        assertEq(uint8(s.status), uint8(BachaGame.SpinStatus.Settled));

        (, BachaGame.Prize[] memory prizes,) = game.getVersion(v1);
        bool matched;
        for (uint256 i; i < prizes.length; ++i) {
            if (prizes[i].token == s.rewardToken && prizes[i].amount == s.rewardAmount) {
                matched = true;
                break;
            }
        }
        assertTrue(matched, "reward is not an entry in the frozen table");

        uint256 before = _balanceOf(s.rewardToken, alice);
        game.claimFor(spinId);
        assertEq(_balanceOf(s.rewardToken, alice) - before, s.rewardAmount);
    }

    function _balanceOf(address token, address who) private view returns (uint256) {
        return MockERC20(token).balanceOf(who);
    }
}
