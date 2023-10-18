// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Tesoreria is Ownable {
    IERC20 private token;
    uint256 public totalDeposits;
    address public admin;  // Una dirección de administrador que puede cambiar el dueño
    constructor(address _token, address _owner) {
        token = IERC20(_token);
        transferOwnership(_owner);  // Configura el dueño del contrato
    }

    // Función para cambiar el dueño del contrato. El administrador puede hacerlo.
    function adminChangeOwner(address newOwner) public {
        require(msg.sender == admin, "Solo el administrador puede cambiar el duenio");
        transferOwnership(newOwner);
    }

    // Función para depositar tokens de los perdedores
    function deposit(uint256 amount) public onlyOwner {
        require(token.transferFrom(msg.sender, address(this), amount), "Transferencia fallida");
        totalDeposits += amount;
    }
  function withdrawWinnings(address recipient, uint256 amount) external {
      require(msg.sender == this.owner(), "Only Ruleta can call this function");
      require(token.balanceOf(address(this)) >= amount, "Insufficient funds in Tesoreria");
      require(token.transfer(recipient, amount), "Transfer failed");
  }

}

