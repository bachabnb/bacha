// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// @notice Plain ERC20 with a configurable decimals value, for tests.
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Takes a percentage cut on every transfer, like some older BEP-20s.
contract FeeOnTransferERC20 is ERC20 {
    uint256 public immutable feeBps;

    constructor(string memory name_, string memory symbol_, uint256 feeBps_) ERC20(name_, symbol_) {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || feeBps == 0) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * feeBps) / 10_000;
        super._update(from, to, value - fee);
        super._update(from, address(0xdead), fee);
    }
}

/// @notice Returns false instead of reverting, and never reverts on failure.
contract ReturnsFalseERC20 is ERC20 {
    constructor() ERC20("Bad", "BAD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        return false;
    }
}

/// @notice Reenters the vault during transfer.
contract ReentrantERC20 is ERC20 {
    address public target;
    bytes public payload;

    constructor() ERC20("Reenter", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setAttack(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
    }

    /// @dev Hooks every movement, so both `transfer` and `transferFrom`
    ///      paths re-enter — the vault pulls funding with `safeTransferFrom`
    ///      and pushes payouts with `safeTransfer`.
    function _update(address from, address to, uint256 value) internal override {
        if (target != address(0) && from != address(0)) {
            (bool ok, bytes memory ret) = target.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
        }
        super._update(from, to, value);
    }
}
