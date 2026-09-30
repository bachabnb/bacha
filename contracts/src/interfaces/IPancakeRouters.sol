// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The one PancakeSwap V2 router call the game makes.
interface IPancakeV2Router {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;
}

/// @notice The one PancakeSwap V3 SmartRouter call the game makes. Sent with
///         BNB as value and a path starting at WBNB, the router wraps it.
interface IPancakeV3Router {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}
