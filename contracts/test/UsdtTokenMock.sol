// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract UsdtTokenMock is ERC20, Ownable {
  // using SafeERC20 for ERC20;
  constructor() ERC20("STABLE COIN TOKEN FOR TEST", "STABLECOIN") {
    _mint(msg.sender, 1000000 * 1E6);
  }

  function decimals() public view virtual override returns (uint8) {
    return 6;
  }
}
