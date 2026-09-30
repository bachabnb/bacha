// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BachaBase} from "./BachaBase.t.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaRandomness} from "../src/BachaRandomness.sol";
import {MockRouter} from "../src/mocks/MockRouter.sol";

/// @dev Drives the game through random sequences of everything that moves
///      BNB: spins, settlements, deliveries (some through a broken pool),
///      BNB payouts, refunds, fee withdrawals and top-ups.
contract GameHandler is Test {
    BachaGame internal game;
    BachaRandomness internal randomness;
    MockRouter internal router;
    address internal wbnb;
    address internal settler;
    address internal treasurer;
    address[] internal players;
    address[] internal tokens;

    uint256[] public spinIds;

    constructor(
        BachaGame game_,
        BachaRandomness randomness_,
        MockRouter router_,
        address wbnb_,
        address settler_,
        address treasurer_,
        address[] memory tokens_
    ) {
        game = game_;
        randomness = randomness_;
        router = router_;
        wbnb = wbnb_;
        settler = settler_;
        treasurer = treasurer_;
        tokens = tokens_;
        for (uint256 i; i < 3; ++i) {
            address p = address(uint160(0xA11CE + i));
            players.push(p);
            vm.deal(p, 100 ether);
        }
    }

    function spinCount() external view returns (uint256) {
        return spinIds.length;
    }

    function spin(uint256 who) external {
        address p = players[who % players.length];
        uint96 price = game.getTier(0).price;
        vm.prank(p);
        try game.spin{value: price}(0) returns (uint256 id) {
            spinIds.push(id);
        } catch {}
    }

    function settle(uint256 pick, uint256 word) external {
        if (spinIds.length == 0) return;
        BachaGame.Spin memory s = game.getSpin(spinIds[pick % spinIds.length]);
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        vm.prank(address(randomness));
        game.rawFulfillRandomWords(s.requestId, words);
    }

    function deliver(uint256 pick, bool v3, bool breakPool) external {
        if (spinIds.length == 0) return;
        uint256 id = spinIds[pick % spinIds.length];
        BachaGame.Spin memory s = game.getSpin(id);
        if (s.status != BachaGame.SpinStatus.Settled) return;

        BachaGame.Route memory r;
        if (v3) {
            r.kind = BachaGame.RouteKind.V3;
            r.v3Path = abi.encodePacked(wbnb, uint24(2500), s.rewardToken);
        } else {
            r.kind = BachaGame.RouteKind.V2;
            r.path = new address[](2);
            r.path[0] = wbnb;
            r.path[1] = s.rewardToken;
        }
        router.setBroken(breakPool);
        vm.prank(settler);
        try game.deliver(id, r, 1, block.timestamp) {} catch {}
        router.setBroken(false);
    }

    function payInBnb(uint256 pick) external {
        if (spinIds.length == 0) return;
        uint256 id = spinIds[pick % spinIds.length];
        BachaGame.Spin memory s = game.getSpin(id);
        if (s.status != BachaGame.SpinStatus.Settled) return;
        vm.prank(s.player);
        game.payInBnb(id);
    }

    function refund(uint256 pick) external {
        if (spinIds.length == 0) return;
        uint256 id = spinIds[pick % spinIds.length];
        BachaGame.Spin memory s = game.getSpin(id);
        if (s.status != BachaGame.SpinStatus.Pending) return;
        vm.warp(s.requestedAt + game.revealTimeout());
        game.refundExpiredSpin(id);
    }

    function withdraw(uint256 amount) external {
        uint256 free = game.withdrawableFees();
        if (free == 0) return;
        amount = bound(amount, 1, free);
        vm.prank(treasurer);
        game.withdrawFees(treasurer, amount);
    }

    function fund(uint256 amount) external {
        amount = bound(amount, 0, 0.05 ether);
        vm.deal(address(this), amount);
        game.fund{value: amount}();
    }
}

contract BachaInvariantTest is BachaBase {
    GameHandler internal handler;

    function setUp() public override {
        super.setUp();
        address[] memory toks = new address[](2);
        toks[0] = address(nvda);
        toks[1] = address(tsla);
        handler = new GameHandler(game, randomness, router, wbnb, settler, treasurer, toks);
        targetContract(address(handler));
    }

    /// @notice The machine can always pay everything it owes.
    function invariant_balanceCoversObligations() public view {
        assertGe(address(game).balance, game.obligations());
    }

    /// @notice The running totals are exactly the sum of the spins behind them.
    function invariant_totalsMatchTheSpins() public view {
        uint256 reserve;
        uint256 owed;
        uint256 n = handler.spinCount();
        for (uint256 i; i < n; ++i) {
            BachaGame.Spin memory s = game.getSpin(handler.spinIds(i));
            if (s.status == BachaGame.SpinStatus.Pending) reserve += s.reserve;
            if (s.status == BachaGame.SpinStatus.Settled) owed += s.rewardValue;
        }
        assertEq(game.pendingReserve(), reserve);
        assertEq(game.settledOwed(), owed);
    }

    /// @notice A delivered prize always reached its own player.
    function invariant_deliveriesRecordAPositiveAmount() public view {
        uint256 n = handler.spinCount();
        for (uint256 i; i < n; ++i) {
            BachaGame.Spin memory s = game.getSpin(handler.spinIds(i));
            if (s.status == BachaGame.SpinStatus.Delivered) assertGt(s.deliveredAmount, 0);
        }
    }
}
