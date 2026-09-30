// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BachaBase} from "./BachaBase.t.sol";
import {BachaGame} from "../src/BachaGame.sol";

/// @notice The beacon forwards a fixed CALLBACK_GAS to the game. The heaviest
///         settlement the game allows must fit inside it, or the largest legal
///         table would publish fine and then never settle.
contract BachaGasBudgetTest is BachaBase {
    function test_worstCaseSettlementFitsTheCallbackBudget() public {
        uint256 n = game.MAX_PRIZES_PER_TABLE();

        // Every entry is walked before the last one matches, and the winning
        // asset has never been owed, so settledOwed is a zero-to-nonzero write.
        BachaGame.Prize[] memory prizes = new BachaGame.Prize[](n);
        for (uint256 i; i < n - 1; ++i) {
            prizes[i] = BachaGame.Prize({token: address(cake), amount: 1e18, weight: 1, rarity: BachaGame.Rarity.Common});
        }
        prizes[n - 1] = BachaGame.Prize({token: address(usd1), amount: 1e18, weight: 1, rarity: BachaGame.Rarity.Epic});

        vm.prank(admin);
        uint64 version = game.publishPrizeTable(prizes);
        vm.prank(operator);
        game.configureTier(7, "WORST", QUICK_PRICE, version, true);
        _fundGenerously();

        uint256 spinId = _spin(alice, 7, QUICK_PRICE);
        uint256 requestId = game.getSpin(spinId).requestId;

        uint256[] memory words = new uint256[](1);
        words[0] = n - 1; // roll lands on the last entry

        // Measure against cold storage, as a real reveal transaction sees it.
        vm.cool(address(game));
        vm.prank(address(randomness));
        uint256 before = gasleft();
        game.rawFulfillRandomWords(requestId, words);
        uint256 used = before - gasleft();

        assertEq(uint8(game.getSpin(spinId).status), uint8(BachaGame.SpinStatus.Settled));
        assertEq(game.getSpin(spinId).rewardToken, address(usd1));
        emit log_named_uint("worst-case settlement gas", used);
        assertLt(used, randomness.CALLBACK_GAS() * 3 / 4, "settlement must leave headroom under CALLBACK_GAS");
    }
}
