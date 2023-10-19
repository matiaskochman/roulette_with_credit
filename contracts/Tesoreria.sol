// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Tesoreria is Ownable {
    IERC20 private stableCoin;
    IERC20 private ruletaToken;
    uint256 public totalDeposits;
    address public admin;  // Una dirección de administrador que puede cambiar el dueño
    constructor(address _stableCoin, address _ruletaToken, address _owner) {
        stableCoin = IERC20(_stableCoin);
        ruletaToken = IERC20(_ruletaToken);
        transferOwnership(_owner);  // Configura el dueño del contrato
    }

    // Función para cambiar el dueño del contrato. El administrador puede hacerlo.
    function adminChangeOwner(address newOwner) public {
        require(msg.sender == admin, "Solo el administrador puede cambiar el duenio");
        transferOwnership(newOwner);
    }

    // Función para depositar tokens de los perdedores
    function deposit(uint256 amount) public onlyOwner {
        require(stableCoin.transferFrom(msg.sender, address(this), amount), "Transferencia fallida");
        totalDeposits += amount;
    }
  function withdrawWinnings(address recipient, uint256 amount) external {
      require(msg.sender == this.owner(), "Only Ruleta can call this function");
      if (amount > stableCoin.balanceOf(address(this)) && stableCoin.balanceOf(address(this)) > 0) {
        uint256 stableCoin_total_balance = stableCoin.balanceOf(address(this));
        require(stableCoin.transfer(recipient, stableCoin_total_balance), "Transfer stablecoin failed");
        require(ruletaToken.transfer(recipient, amount - stableCoin_total_balance), "Transfer ruletatoken failed");
      } else if (amount > stableCoin.balanceOf(address(this)) && stableCoin.balanceOf(address(this)) == 0) {
        require(ruletaToken.transfer(recipient, amount), "Transfer ruletatoken failed");
      } else {
        // require(stableCoin.balanceOf(address(this)) >= amount, "Insufficient funds in Tesoreria");
        require(stableCoin.transfer(recipient, amount), "Transfer stablecoin failed");
      }
  }

}

