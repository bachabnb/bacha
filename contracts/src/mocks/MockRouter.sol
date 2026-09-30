// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockERC20} from "./MockERC20.sol";
import {IPancakeV2Router, IPancakeV3Router} from "../interfaces/IPancakeRouters.sol";

/// @dev Stands in for both PancakeSwap routers in tests. Swaps BNB for the
///      path's last token at a fixed rate by minting it to the recipient, and
///      can be told to revert or to short-change — to prove the game's own
///      checks, not the router's, are what protect the player.
contract MockRouter is IPancakeV2Router, IPancakeV3Router {
    /// @notice Tokens out per 1e18 wei in, per token.
    mapping(address token => uint256) public rate;
    bool public broken;
    /// @notice Pay this fraction (bps) of the quote while telling nobody.
    uint256 public payoutBps = 10_000;
    /// @notice Ignore amountOutMin, so the game's own check is exercised.
    bool public ignoreMinimum;

    address public lastRecipient;
    uint256 public lastValue;
    bytes public lastV3Path;

    receive() external payable {}

    function setRate(address token, uint256 tokensPerBnb) external {
        rate[token] = tokensPerBnb;
    }

    function setBroken(bool value) external {
        broken = value;
    }

    function setPayoutBps(uint256 bps) external {
        payoutBps = bps;
    }

    function setIgnoreMinimum(bool value) external {
        ignoreMinimum = value;
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable {
        require(block.timestamp <= deadline, "expired");
        _pay(path[path.length - 1], to, msg.value, amountOutMin);
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut) {
        require(msg.value == params.amountIn, "value");
        lastV3Path = params.path;
        bytes calldata p = params.path;
        address tokenOut = address(bytes20(p[p.length - 20:]));
        amountOut = _pay(tokenOut, params.recipient, msg.value, params.amountOutMinimum);
    }

    function _pay(address token, address to, uint256 value, uint256 minOut) private returns (uint256 out) {
        require(!broken, "pool broken");
        lastRecipient = to;
        lastValue = value;
        out = (value * rate[token] / 1e18) * payoutBps / 10_000;
        if (!ignoreMinimum) require(out >= minOut, "insufficient output");
        MockERC20(token).mint(to, out);
    }
}
