// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BachaGame} from "../src/BachaGame.sol";
import {BachaRandomness} from "../src/BachaRandomness.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockRouter} from "../src/mocks/MockRouter.sol";

/// @notice Shared fixture: a beacon, a game with a funded BNB bankroll, and a
///         mock router standing in for both PancakeSwap routers.
///
/// @dev    Most tests need a spin to land on a *specific* prize, which a
///         commit–reveal word cannot be steered to. `_settle` impersonates the
///         beacon and hands the game a chosen word — the access check is real,
///         only the source of the number is substituted. The beacon itself is
///         covered end to end in BachaRandomness.t.sol, and `test_endToEnd…`
///         below runs one spin through the real commit–reveal path.
abstract contract BachaBase is Test {
    BachaGame internal game;
    BachaRandomness internal randomness;
    MockRouter internal router;

    MockERC20 internal nvda;
    MockERC20 internal tsla;
    MockERC20 internal usdt; // an approved route hop
    MockERC20 internal junk; // never approved
    address internal wbnb = makeAddr("wbnb");

    address internal admin = makeAddr("admin");
    address internal operator = makeAddr("operator");
    address internal treasurer = makeAddr("treasurer");
    address internal settler = makeAddr("settler");
    address internal committer = makeAddr("committer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    uint8 internal constant TIER = 0;
    uint96 internal constant PRICE = 0.0026 ether;
    uint96 internal constant MAX_PRIZE = 0.01 ether;
    uint96 internal constant EPIC = 0.006 ether;

    uint64 internal v1;

    function setUp() public virtual {
        vm.prank(admin);
        randomness = new BachaRandomness(admin, committer);
        _commitSeeds(256);
        vm.roll(100); // blockhash(0) is zero; a reveal needs a real hash

        router = new MockRouter();
        nvda = new MockERC20("NVIDIA bStock", "NVDAB", 18);
        tsla = new MockERC20("Tesla bStock", "TSLAB", 18);
        usdt = new MockERC20("Tether", "USDT", 18);
        junk = new MockERC20("Junk", "JUNK", 18);
        router.setRate(address(nvda), 3.3e18); // ~0.0033 NVDAB per 0.001 BNB
        router.setRate(address(tsla), 2.2e18);

        vm.startPrank(admin);
        game = new BachaGame(admin, address(randomness), address(router), address(router), wbnb);
        randomness.grantRole(randomness.CONSUMER_ROLE(), address(game));
        game.setAssetApproved(address(nvda), true);
        game.setAssetApproved(address(tsla), true);
        game.setRouteHop(address(usdt), true);
        game.setMaxPrizeValue(MAX_PRIZE);
        game.grantRole(game.OPERATOR_ROLE(), operator);
        game.grantRole(game.TREASURER_ROLE(), treasurer);
        game.grantRole(game.SETTLER_ROLE(), settler);
        vm.stopPrank();

        v1 = _publish(_defaultPrizes());
        vm.prank(operator);
        game.configureTier(TIER, "BACHA", PRICE, v1, true);

        vm.deal(address(this), 100 ether);
        game.fund{value: 0.1 ether}();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    /// @dev 68 / 23 / 8 / 1, with the epic above the spin price so a pending
    ///      spin must reserve more than it paid.
    function _defaultPrizes() internal view returns (BachaGame.Prize[] memory prizes) {
        prizes = new BachaGame.Prize[](4);
        prizes[0] = _prize(address(nvda), 0.0012 ether, 6800, BachaGame.Rarity.Common);
        prizes[1] = _prize(address(tsla), 0.0019 ether, 2300, BachaGame.Rarity.Uncommon);
        prizes[2] = _prize(address(nvda), 0.0036 ether, 800, BachaGame.Rarity.Rare);
        prizes[3] = _prize(address(tsla), EPIC, 100, BachaGame.Rarity.Epic);
    }

    function _prize(address token, uint96 value, uint32 weight, BachaGame.Rarity rarity)
        internal
        pure
        returns (BachaGame.Prize memory)
    {
        return BachaGame.Prize({token: token, value: value, weight: weight, rarity: rarity});
    }

    function _publish(BachaGame.Prize[] memory prizes) internal returns (uint64) {
        vm.prank(operator);
        return game.publishPrizeTable(prizes);
    }

    function _spin(address who) internal returns (uint256 spinId) {
        vm.prank(who);
        spinId = game.spin{value: PRICE}(TIER);
    }

    /// @dev Words that land on each entry of the default table (total 10000).
    uint256 internal constant WORD_COMMON = 0;
    uint256 internal constant WORD_UNCOMMON = 6800;
    uint256 internal constant WORD_RARE = 9100;
    uint256 internal constant WORD_EPIC = 9950;

    function _settle(uint256 spinId, uint256 word) internal {
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        uint256 requestId = game.getSpin(spinId).requestId;
        vm.prank(address(randomness));
        game.rawFulfillRandomWords(requestId, words);
    }

    function _v2(address token) internal view returns (BachaGame.Route memory r) {
        r.kind = BachaGame.RouteKind.V2;
        r.path = new address[](2);
        r.path[0] = wbnb;
        r.path[1] = token;
    }

    function _v3(address token) internal view returns (BachaGame.Route memory r) {
        r.kind = BachaGame.RouteKind.V3;
        r.v3Path = abi.encodePacked(wbnb, uint24(2500), token);
    }

    function _v3ViaHop(address hop, address token) internal view returns (BachaGame.Route memory r) {
        r.kind = BachaGame.RouteKind.V3;
        r.v3Path = abi.encodePacked(wbnb, uint24(100), hop, uint24(500), token);
    }

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

    receive() external payable {}
}
