// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAccessControl} from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {BachaBase} from "./BachaBase.t.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaRandomness} from "../src/BachaRandomness.sol";

contract BachaGameTest is BachaBase {
    // ------------------------------------------------------------ publish

    function test_publishRecordsMaxValueAndHash() public view {
        (BachaGame.Version memory v, BachaGame.Prize[] memory prizes) = game.getVersion(v1);
        assertTrue(v.published);
        assertEq(v.totalWeight, 10_000);
        assertEq(v.maxValue, EPIC);
        assertEq(prizes.length, 4);
        assertTrue(v.prizeTableHash != bytes32(0));
    }

    function test_publishRejectsUnapprovedAsset() public {
        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](1);
        prizes[0] = _prize(address(junk), 0.001 ether, 1, BachaGame.Rarity.Common);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.AssetNotApproved.selector, address(junk)));
        game.publishPrizeTable(prizes);
    }

    function test_publishRejectsPrizeAboveMax() public {
        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](1);
        prizes[0] = _prize(address(nvda), MAX_PRIZE + 1, 1, BachaGame.Rarity.Epic);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.PrizeExceedsMax.selector, MAX_PRIZE + 1, MAX_PRIZE));
        game.publishPrizeTable(prizes);
    }

    function test_publishRejectsZeroValueZeroWeightAndEmpty() public {
        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](1);
        prizes[0] = _prize(address(nvda), 0, 1, BachaGame.Rarity.Common);
        vm.startPrank(operator);
        vm.expectRevert(BachaGame.InvalidValue.selector);
        game.publishPrizeTable(prizes);

        prizes[0] = _prize(address(nvda), 1, 0, BachaGame.Rarity.Common);
        vm.expectRevert(BachaGame.InvalidWeight.selector);
        game.publishPrizeTable(prizes);

        vm.expectRevert(BachaGame.EmptyPrizeTable.selector);
        game.publishPrizeTable(new BachaGame.Prize[](0));
        vm.stopPrank();
    }

    function test_onlyOperatorPublishesAndOnlyAdminSetsLimits() public {
        BachaGame.Prize[] memory prizes = _defaultPrizes();
        bytes32 operatorRole = game.OPERATOR_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, operatorRole)
        );
        game.publishPrizeTable(prizes);

        vm.startPrank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, operator, bytes32(0))
        );
        game.setMaxPrizeValue(1 ether);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, operator, bytes32(0))
        );
        game.setAssetApproved(address(junk), true);
        vm.stopPrank();
    }

    function test_pendingSpinKeepsItsOriginalPrizeTable() public {
        uint256 id = _spin(alice);

        BachaGame.Prize[] memory richer = _defaultPrizes();
        richer[0].value = 0.005 ether;
        uint64 v2 = _publish(richer);
        vm.prank(operator);
        game.configureTier(TIER, "BACHA", PRICE, v2, true);

        _settle(id, WORD_COMMON);
        BachaGame.Spin memory s = game.getSpin(id);
        assertEq(s.versionId, v1);
        assertEq(s.rewardValue, 0.0012 ether, "settled against the table it was sold");
    }

    // --------------------------------------------------------------- spin

    function test_spinReservesTheBiggestPrize() public {
        uint256 id = _spin(alice);
        BachaGame.Spin memory s = game.getSpin(id);
        assertEq(uint8(s.status), uint8(BachaGame.SpinStatus.Pending));
        assertEq(s.reserve, EPIC, "reserve is the table's biggest prize, which exceeds the price");
        assertEq(game.pendingReserve(), EPIC);
        assertEq(game.obligations(), EPIC);
    }

    function test_spinReservesThePaymentWhenItExceedsEveryPrize() public {
        BachaGame.Prize[] memory small = new BachaGame.Prize[](1);
        small[0] = _prize(address(nvda), 0.001 ether, 1, BachaGame.Rarity.Common);
        uint64 v = _publish(small);
        vm.prank(operator);
        game.configureTier(TIER, "BACHA", PRICE, v, true);

        uint256 id = _spin(alice);
        assertEq(game.getSpin(id).reserve, PRICE, "a refund could return the whole payment");
    }

    function test_spinRejectsWrongPaymentAndInactiveTier() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.IncorrectPayment.selector, 1, PRICE));
        game.spin{value: 1}(TIER);

        vm.prank(operator);
        game.configureTier(TIER, "BACHA", PRICE, v1, false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.TierInactive.selector, TIER));
        game.spin{value: PRICE}(TIER);
    }

    function test_spinRefusedWhenBankrollCannotCoverIt() public {
        // A fresh, unfunded game: the payment alone cannot cover the epic.
        vm.startPrank(admin);
        BachaGame empty = new BachaGame(admin, address(randomness), address(router), address(router), wbnb);
        randomness.grantRole(randomness.CONSUMER_ROLE(), address(empty));
        empty.setAssetApproved(address(nvda), true);
        empty.setAssetApproved(address(tsla), true);
        empty.setMaxPrizeValue(MAX_PRIZE);
        uint64 v = empty.publishPrizeTable(_defaultPrizes());
        empty.configureTier(TIER, "BACHA", PRICE, v, true);
        vm.stopPrank();

        assertEq(empty.remainingFundedSpins(v), 0);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.InsufficientBankroll.selector, EPIC, PRICE));
        empty.spin{value: PRICE}(TIER);

        empty.fund{value: EPIC - PRICE}();
        assertEq(empty.remainingFundedSpins(v), 1);
        vm.prank(alice);
        empty.spin{value: PRICE}(TIER);
        assertEq(empty.remainingFundedSpins(v), 0, "exactly one spin was covered");
    }

    function test_remainingFundedSpinsCountsWhatTheBankrollCovers() public {
        // 0.1 BNB free; each spin needs EPIC − PRICE = 0.0034 BNB of it.
        assertEq(game.remainingFundedSpins(v1), uint256(0.1 ether) / (EPIC - PRICE));
    }

    function test_spinRefusedWhilePausedAndWhenBeaconIsDry() public {
        vm.prank(operator);
        game.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        game.spin{value: PRICE}(TIER);
        vm.prank(operator);
        game.unpause();

        for (uint256 i; i < 256; ++i) {
            _spin(alice);
            _settle(i + 1, WORD_COMMON); // keep the bankroll from binding first
        }
        vm.prank(alice);
        vm.expectRevert(BachaRandomness.NoCommitmentAvailable.selector);
        game.spin{value: PRICE}(TIER);
    }

    // ---------------------------------------------------------- spinMany

    function _spinMany(address who, uint256 count) internal returns (uint256[] memory ids) {
        vm.prank(who);
        ids = game.spinMany{value: uint256(PRICE) * count}(TIER, count);
    }

    function test_spinManyOpensIndependentSpins() public {
        uint256 seedsBefore = randomness.availableCommitments();
        uint256[] memory ids = _spinMany(alice, 5);

        assertEq(ids.length, 5);
        assertEq(game.spinCount(), 5);
        assertEq(randomness.availableCommitments(), seedsBefore - 5, "one seed per spin");
        assertEq(game.pendingReserve(), uint256(EPIC) * 5, "each spin reserves the biggest prize");
        for (uint256 i; i < ids.length; ++i) {
            BachaGame.Spin memory s = game.getSpin(ids[i]);
            assertEq(ids[i], i + 1);
            assertEq(s.player, alice);
            assertEq(s.payment, PRICE, "each spin carries one price");
            assertEq(s.reserve, EPIC);
            assertEq(uint8(s.status), uint8(BachaGame.SpinStatus.Pending));
            if (i > 0) assertTrue(s.requestId != game.getSpin(ids[i - 1]).requestId, "own randomness request");
        }
        (, uint256 total) = game.spinsOf(alice, 0, 10);
        assertEq(total, 5);
    }

    function test_spinManyRejectsBadCountAndPayment() public {
        uint256 max = game.MAX_SPINS_PER_CALL();
        assertEq(max, 25);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.InvalidSpinCount.selector, 0));
        game.spinMany{value: 0}(TIER, 0);

        vm.expectRevert(abi.encodeWithSelector(BachaGame.InvalidSpinCount.selector, max + 1));
        game.spinMany{value: uint256(PRICE) * (max + 1)}(TIER, max + 1);

        vm.expectRevert(abi.encodeWithSelector(BachaGame.IncorrectPayment.selector, PRICE, uint256(PRICE) * 3));
        game.spinMany{value: PRICE}(TIER, 3);
        vm.stopPrank();

        vm.prank(operator);
        game.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        game.spinMany{value: uint256(PRICE) * 2}(TIER, 2);
    }

    function test_spinManyIsAllOrNothingOnTheBankroll() public {
        uint64 v = game.getTier(TIER).versionId;
        uint256 funded = game.remainingFundedSpins(v);

        uint256 count = funded + 1 > game.MAX_SPINS_PER_CALL() ? game.MAX_SPINS_PER_CALL() : funded + 1;
        // Shrink the bankroll until `count` is one spin too many.
        uint256 spare = address(game).balance - (uint256(EPIC) - PRICE) * (count - 1);
        vm.prank(treasurer);
        game.withdrawFees(treasurer, spare);
        assertEq(game.remainingFundedSpins(v), count - 1);

        vm.prank(alice);
        vm.expectPartialRevert(BachaGame.InsufficientBankroll.selector);
        game.spinMany{value: uint256(PRICE) * count}(TIER, count);
        assertEq(game.spinCount(), 0, "no spin of a refused batch survives");
        assertEq(game.pendingReserve(), 0);

        _spinMany(alice, count - 1);
        assertEq(game.remainingFundedSpins(v), 0);
    }

    function test_spinManySpinsSettleDeliverAndRefundOnTheirOwn() public {
        uint256[] memory ids = _spinMany(alice, 3);

        _settle(ids[0], WORD_COMMON);
        vm.prank(settler);
        game.deliver(ids[0], _v2(address(nvda)), 1, block.timestamp);
        assertEq(uint8(game.getSpin(ids[0]).status), uint8(BachaGame.SpinStatus.Delivered));

        _settle(ids[1], WORD_RARE);
        uint256 before = alice.balance;
        vm.prank(alice);
        game.payInBnb(ids[1]);
        assertEq(alice.balance, before + 0.0036 ether);

        vm.warp(game.getSpin(ids[2]).requestedAt + game.revealTimeout());
        before = alice.balance;
        game.refundExpiredSpin(ids[2]);
        assertEq(alice.balance, before + PRICE, "a refund returns one spin's price, not the batch");

        assertEq(game.obligations(), 0);
    }

    function test_fullBatchThroughTheRealBeacon() public {
        uint256 max = game.MAX_SPINS_PER_CALL();
        vm.prank(alice);
        uint256 before = gasleft();
        uint256[] memory ids = game.spinMany{value: uint256(PRICE) * max}(TIER, max);
        emit log_named_uint("spinMany(25) gas", before - gasleft());

        BachaRandomness.Request memory last = randomness.getRequest(game.getSpin(ids[max - 1]).requestId);
        vm.roll(last.revealBlock + 1);
        for (uint256 i; i < max; ++i) {
            uint256 requestId = game.getSpin(ids[i]).requestId;
            BachaRandomness.Request memory req = randomness.getRequest(requestId);
            vm.prank(committer);
            randomness.reveal(requestId, _seed(req.commitmentIndex));
            assertEq(uint8(game.getSpin(ids[i]).status), uint8(BachaGame.SpinStatus.Settled));
        }
        assertEq(game.pendingReserve(), 0);
        assertLe(game.obligations(), address(game).balance);
    }

    // ------------------------------------------------------------- settle

    function test_settleMovesReserveToOwed() public {
        uint256 id = _spin(alice);
        _settle(id, WORD_UNCOMMON);

        BachaGame.Spin memory s = game.getSpin(id);
        assertEq(uint8(s.status), uint8(BachaGame.SpinStatus.Settled));
        assertEq(s.rewardToken, address(tsla));
        assertEq(s.rewardValue, 0.0019 ether);
        assertEq(uint8(s.rarity), uint8(BachaGame.Rarity.Uncommon));
        assertEq(game.pendingReserve(), 0);
        assertEq(game.settledOwed(), 0.0019 ether);
    }

    function test_onlyBeaconSettlesAndRepeatsAreIgnored() public {
        uint256 id = _spin(alice);
        uint256[] memory words = new uint256[](1);
        uint256 requestId = game.getSpin(id).requestId;

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(BachaGame.OnlyRandomness.selector, stranger, address(randomness))
        );
        game.rawFulfillRandomWords(requestId, words);

        _settle(id, WORD_COMMON);
        _settle(id, WORD_EPIC); // ignored
        assertEq(game.getSpin(id).rewardValue, 0.0012 ether);
        assertEq(game.settledOwed(), 0.0012 ether);
    }

    function test_previewMatchesSettlement() public {
        uint256 id = _spin(alice);
        _settle(id, WORD_RARE);
        (uint16 index, address token, uint96 value,) = game.previewPrize(v1, WORD_RARE);
        assertEq(index, 2);
        assertEq(token, game.getSpin(id).rewardToken);
        assertEq(value, game.getSpin(id).rewardValue);
    }

    // ------------------------------------------------------------ deliver

    function test_playerDeliversOverV2AndReceivesTheToken() public {
        uint256 id = _spin(alice);
        _settle(id, WORD_COMMON);
        uint256 gameBefore = address(game).balance;

        vm.prank(alice);
        game.deliver(id, _v2(address(nvda)), 1, block.timestamp);

        BachaGame.Spin memory s = game.getSpin(id);
        assertEq(uint8(s.status), uint8(BachaGame.SpinStatus.Delivered));
        uint256 expected = uint256(0.0012 ether) * 3.3e18 / 1e18;
        assertEq(nvda.balanceOf(alice), expected);
        assertEq(s.deliveredAmount, expected);
        assertEq(address(game).balance, gameBefore - 0.0012 ether, "exactly the prize value was spent");
        assertEq(router.lastRecipient(), alice);
        assertEq(game.settledOwed(), 0);
    }

    function test_settlerDeliversOverV3DirectAndViaHop() public {
        uint256 a = _spin(alice);
        uint256 b = _spin(bob);
        _settle(a, WORD_EPIC);
        _settle(b, WORD_UNCOMMON);

        vm.startPrank(settler);
        game.deliver(a, _v3(address(tsla)), 1, block.timestamp);
        game.deliver(b, _v3ViaHop(address(usdt), address(tsla)), 1, block.timestamp);
        vm.stopPrank();

        assertEq(tsla.balanceOf(alice), uint256(EPIC) * 2.2e18 / 1e18);
        assertEq(tsla.balanceOf(bob), uint256(0.0019 ether) * 2.2e18 / 1e18);
        assertEq(router.lastRecipient(), bob);
    }

    function test_strangerCannotDeliver() public {
        uint256 id = _spin(alice);
        _settle(id, WORD_COMMON);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.NotPlayerOrSettler.selector, stranger));
        game.deliver(id, _v2(address(nvda)), 1, block.timestamp);
    }

    function test_routeMustStartAtWbnbEndAtPrizeAndUseApprovedHops() public {
        uint256 id = _spin(alice);
        _settle(id, WORD_COMMON); // prize is NVDAB
        BachaGame.Route memory r;

        // Wrong end token.
        vm.startPrank(alice);
        vm.expectRevert(BachaGame.BadRoute.selector);
        game.deliver(id, _v2(address(tsla)), 1, block.timestamp);

        // Wrong start.
        r = _v2(address(nvda));
        r.path[0] = address(usdt);
        vm.expectRevert(BachaGame.BadRoute.selector);
        game.deliver(id, r, 1, block.timestamp);

        // Unapproved hop, V2 and V3.
        r.kind = BachaGame.RouteKind.V2;
        r.path = new address[](3);
        r.path[0] = wbnb;
        r.path[1] = address(junk);
        r.path[2] = address(nvda);
        vm.expectRevert(BachaGame.BadRoute.selector);
        game.deliver(id, r, 1, block.timestamp);
        vm.expectRevert(BachaGame.BadRoute.selector);
        game.deliver(id, _v3ViaHop(address(junk), address(nvda)), 1, block.timestamp);

        // Malformed V3 path.
        r.kind = BachaGame.RouteKind.V3;
        r.v3Path = abi.encodePacked(wbnb, uint24(2500), address(nvda), uint8(0));
        vm.expectRevert(BachaGame.BadRoute.selector);
        game.deliver(id, r, 1, block.timestamp);
        vm.stopPrank();

        assertEq(uint8(game.getSpin(id).status), uint8(BachaGame.SpinStatus.Settled), "still deliverable");
    }

    function test_shortChangedDeliveryReverts() public {
        uint256 id = _spin(alice);
        _settle(id, WORD_COMMON);
        router.setIgnoreMinimum(true);
        router.setPayoutBps(5_000); // pays half and says nothing

        uint256 quoted = uint256(0.0012 ether) * 3.3e18 / 1e18;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.InsufficientOutput.selector, quoted / 2, quoted));
        game.deliver(id, _v2(address(nvda)), quoted, block.timestamp);
        assertEq(nvda.balanceOf(alice), 0, "the whole delivery unwound");
        assertEq(game.settledOwed(), 0.0012 ether);
    }

    function test_brokenPoolLeavesThePrizeClaimable() public {
        uint256 id = _spin(alice);
        _settle(id, WORD_COMMON);
        router.setBroken(true);

        vm.prank(settler);
        vm.expectRevert("pool broken");
        game.deliver(id, _v2(address(nvda)), 1, block.timestamp);
        assertEq(uint8(game.getSpin(id).status), uint8(BachaGame.SpinStatus.Settled));

        // Retry once the pool recovers…
        router.setBroken(false);
        vm.prank(settler);
        game.deliver(id, _v2(address(nvda)), 1, block.timestamp);
        assertEq(uint8(game.getSpin(id).status), uint8(BachaGame.SpinStatus.Delivered));
    }

    function test_deliverRejectsExpiredPendingAndRepeat() public {
        uint256 id = _spin(alice);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BachaGame.SpinNotSettled.selector, id, BachaGame.SpinStatus.Pending)
        );
        game.deliver(id, _v2(address(nvda)), 1, block.timestamp);

        _settle(id, WORD_COMMON);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.Expired.selector, block.timestamp - 1));
        game.deliver(id, _v2(address(nvda)), 1, block.timestamp - 1);

        vm.startPrank(alice);
        game.deliver(id, _v2(address(nvda)), 1, block.timestamp);
        vm.expectRevert(
            abi.encodeWithSelector(BachaGame.SpinNotSettled.selector, id, BachaGame.SpinStatus.Delivered)
        );
        game.deliver(id, _v2(address(nvda)), 1, block.timestamp);
        vm.stopPrank();
    }

    // -------------------------------------------------------- pay in BNB

    function test_playerCanTakeThePrizeInBnb() public {
        uint256 id = _spin(alice);
        _settle(id, WORD_RARE);
        uint256 before = alice.balance;

        vm.prank(alice);
        game.payInBnb(id);
        assertEq(alice.balance, before + 0.0036 ether);
        assertEq(uint8(game.getSpin(id).status), uint8(BachaGame.SpinStatus.PaidInBnb));
        assertEq(game.settledOwed(), 0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BachaGame.SpinNotSettled.selector, id, BachaGame.SpinStatus.PaidInBnb)
        );
        game.deliver(id, _v2(address(nvda)), 1, block.timestamp);
    }

    function test_onlyThePlayerCanTakeBnb() public {
        uint256 id = _spin(alice);
        _settle(id, WORD_COMMON);
        vm.prank(settler);
        vm.expectRevert(abi.encodeWithSelector(BachaGame.NotPlayer.selector, settler));
        game.payInBnb(id);
    }

    // ------------------------------------------------------------- refund

    function test_refundAfterTimeoutReleasesTheReserve() public {
        uint256 id = _spin(alice);
        uint64 claimableAt = game.getSpin(id).requestedAt + game.revealTimeout();
        vm.expectRevert(abi.encodeWithSelector(BachaGame.RefundTooEarly.selector, id, claimableAt));
        game.refundExpiredSpin(id);

        vm.warp(claimableAt);
        uint256 before = alice.balance;
        game.refundExpiredSpin(id); // anyone may trigger it; the player is paid
        assertEq(alice.balance, before + PRICE);
        assertEq(game.pendingReserve(), 0);

        _settle(id, WORD_EPIC); // a late word is ignored
        assertEq(uint8(game.getSpin(id).status), uint8(BachaGame.SpinStatus.Refunded));
        assertEq(game.settledOwed(), 0);
    }

    // ----------------------------------------------------------- treasury

    function test_feesExcludeEveryObligation() public {
        uint256 a = _spin(alice);
        _spin(bob);
        _settle(a, WORD_EPIC);
        // balance 0.1 + 2 × PRICE; owed EPIC settled + EPIC pending.
        uint256 expected = 0.1 ether + 2 * uint256(PRICE) - 2 * uint256(EPIC);
        assertEq(game.withdrawableFees(), expected);

        vm.prank(treasurer);
        vm.expectRevert(BachaGame.NothingToWithdraw.selector);
        game.withdrawFees(treasurer, expected + 1);

        bytes32 treasurerRole = game.TREASURER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, treasurerRole)
        );
        game.withdrawFees(stranger, 1);

        vm.prank(treasurer);
        game.withdrawFees(treasurer, expected);
        assertEq(address(game).balance, game.obligations(), "exactly the obligations remain");
    }

    // --------------------------------------------------------- end to end

    function test_endToEndThroughTheRealBeacon() public {
        uint256 id = _spin(alice);
        uint256 requestId = game.getSpin(id).requestId;
        BachaRandomness.Request memory req = randomness.getRequest(requestId);
        vm.roll(req.revealBlock + 1);

        bytes32 seed = _seed(req.commitmentIndex);
        vm.prank(committer);
        randomness.reveal(requestId, seed);

        BachaGame.Spin memory s = game.getSpin(id);
        assertEq(uint8(s.status), uint8(BachaGame.SpinStatus.Settled));
        (, address token, uint96 value,) = game.previewPrize(v1, s.randomWord);
        assertEq(s.rewardToken, token);
        assertEq(s.rewardValue, value);

        vm.prank(settler);
        game.deliver(id, _v2(token), 1, block.timestamp);
        assertGt(game.getSpin(id).deliveredAmount, 0);
    }

    // ---------------------------------------------------------------- gas

    /// @dev The beacon forwards CALLBACK_GAS; the heaviest settlement the game
    ///      allows must fit, with headroom.
    function test_worstCaseSettlementFitsTheCallbackBudget() public {
        uint256 n = game.MAX_PRIZES_PER_TABLE();
        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](n);
        for (uint256 i; i < n; ++i) {
            prizes[i] = _prize(address(nvda), 0.001 ether, 1, BachaGame.Rarity.Common);
        }
        uint64 v = _publish(prizes);
        vm.prank(operator);
        game.configureTier(TIER, "BACHA", PRICE, v, true);
        uint256 id = _spin(alice);

        uint256[] memory words = new uint256[](1);
        words[0] = n - 1;
        uint256 requestId = game.getSpin(id).requestId;
        vm.cool(address(game));
        vm.prank(address(randomness));
        uint256 before = gasleft();
        game.rawFulfillRandomWords(requestId, words);
        uint256 used = before - gasleft();

        emit log_named_uint("worst-case settlement gas", used);
        assertLt(used, randomness.CALLBACK_GAS() * 3 / 4);
    }
}
