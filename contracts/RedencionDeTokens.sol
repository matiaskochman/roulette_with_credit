// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
contract RedencionDeTokens is Ownable {
    IERC20 private ruletaToken;
    IERC20 private usdtTokenMock;

    constructor(address _ruletaToken, address _usdtTokenMock) {
        ruletaToken = IERC20(_ruletaToken);
        usdtTokenMock = IERC20(_usdtTokenMock);
    }

    // Función para que los usuarios rediman sus ruletaTokens por usdtTokenMock
    function redimirRuletaTokens(uint256 cantidadRuletaTokens) public {
        // Verifica si el contrato tiene suficientes USDT para realizar la redención
        require(usdtTokenMock.balanceOf(address(this)) >= cantidadRuletaTokens, "Fondos insuficientes para la redencion");

        // Transfiere los ruletaTokens del usuario al contrato
        require(ruletaToken.transferFrom(msg.sender, address(this), cantidadRuletaTokens), "Transferencia de ruletaToken fallida");

        // Envía los USDT al usuario
        require(usdtTokenMock.transfer(msg.sender, cantidadRuletaTokens), "Transferencia de USDT fallida");
    }

    // Función para que el dueño del contrato retire USDT del contrato
    function retirarUsdt(uint256 cantidad) public onlyOwner {
        require(usdtTokenMock.transfer(msg.sender, cantidad), "Transferencia de USDT fallida");
    }

    // Función para que el dueño del contrato retire ruletaToken del contrato
    function retirarRuletaTokens(uint256 cantidad) public onlyOwner {
        require(ruletaToken.transfer(msg.sender, cantidad), "Transferencia de ruletaToken fallida");
    }
}
