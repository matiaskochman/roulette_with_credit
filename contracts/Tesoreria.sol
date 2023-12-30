// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Ruleta.sol";
import "hardhat/console.sol";

contract Tesoreria is Ownable {
    IERC20 private stableCoin;
    IERC20 private ruletaToken;
    Ruleta ruletaContract;
    address ruletaContractAddress;
    uint256 public totalDeposits;
    address public admin;  // Una dirección de administrador que puede cambiar el dueño
    address private authorizedCaller;  // Una dirección autorizada para llamar a withdrawWinnings

    constructor(address _stableCoin, address _ruletaToken, address _owner) {
        stableCoin = IERC20(_stableCoin);
        ruletaToken = IERC20(_ruletaToken);
        transferOwnership(_owner);  // Configura el dueño del contrato
    }
    // Función para establecer la dirección del contrato Ruleta asociado.
    // Se ha añadido visibilidad `public` y se asegura que solo el dueño pueda llamarla.
    function setRuletaContract(address _ruletaContractAddress) public onlyOwner {
        require(_ruletaContractAddress != address(0), "La direccion del contrato Ruleta no puede ser cero");
        ruletaContractAddress = _ruletaContractAddress;
    }

    // Función para cambiar el dueño del contrato. El administrador puede hacerlo.
    function adminChangeOwner(address newOwner) public onlyOwner {
        require(msg.sender == admin, "Solo el administrador puede cambiar el duenio");
        transferOwnership(newOwner);
    }

    // // Función para depositar tokens de los perdedores
    // function deposit(uint256 amount) public onlyOwner {
    //     require(stableCoin.transferFrom(msg.sender, address(this), amount), "Transferencia fallida");
    //     totalDeposits += amount;
    // }
    // En el contrato Tesoreria
    function depositFromPlayer(address player, uint256 amount) external {
      require(msg.sender == address(ruletaContractAddress), "Solo el contrato Ruleta puede hacer depositos");
      require(stableCoin.transferFrom(player, address(this), amount), "Transferencia fallida");
      totalDeposits += amount;
        // Lógica adicional si es necesaria, como actualizar balances, etc.
    }    
    function withdrawWinnings(address recipient, uint256 amount) external {
        require(msg.sender == owner() || tx.origin == authorizedCaller, "Only owner or authorized caller can call this function");
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
    // Función para establecer una dirección autorizada
    function setAuthorizedCaller(address _caller) public {
        require(_caller != address(0), "La direccion autorizada no puede ser cero");
        authorizedCaller = _caller;
    }
}

