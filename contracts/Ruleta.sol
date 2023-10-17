// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
contract Ruleta is Ownable {
    IERC20 private token;

    enum GameState { CREADO, SE_PERMITEN_APUESTAS, NO_SE_PERMITEN_APUESTAS, TERMINADO }

    struct Bet {
        uint256 id;
        address player;
        uint256 amount;
        uint8 number;
    }

    struct Game {
        uint256 id;
        GameState state;
        uint8 winnerNumber;
        address[] winners;
    }

    uint256 private currentGameId = 0;
    mapping(uint256 => Game) public games;
    mapping(uint256 => uint8) public gameIdToBetIdCounterMap;
    mapping(uint256 => mapping(uint8 => Bet)) public gameToBetMap;

    constructor(address _token) {
        token = IERC20(_token);
    }

    function createGame() public {
        Game memory newGame = Game({
            id: currentGameId,
            state: GameState.CREADO,
            winnerNumber: 0,
            winners: new address[](0)
        });

        games[currentGameId] = newGame;
        gameIdToBetIdCounterMap[currentGameId] = 0;
        currentGameId++;
    }

    function betInGame(uint256 gameId, uint256 amount, uint8 number) public {
        require(games[gameId].state == GameState.SE_PERMITEN_APUESTAS, "Las apuestas no estan permitidas para este juego en este momento");
        require(token.balanceOf(msg.sender) >= amount, "Saldo insuficiente para apostar");
        require(number >= 0 && number <= 36, "Numero no valido. Debe estar entre 0 y 36");

        token.transferFrom(msg.sender, address(this), amount);

        uint8 betId = gameIdToBetIdCounterMap[gameId];
        Bet memory newBet = Bet({
            id: betId,
            player: msg.sender,
            amount: amount,
            number: number
        });

        gameToBetMap[gameId][betId] = newBet;
        gameIdToBetIdCounterMap[gameId]++;
    }

    function setGameState(uint256 gameId, GameState newState) public onlyOwner {
        games[gameId].state = newState;
    }

    function setWinnerNumber(uint256 gameId) public onlyOwner {
        require(games[gameId].state == GameState.NO_SE_PERMITEN_APUESTAS, "El juego debe estar en estado 'NO_SE_PERMITEN_APUESTAS' para seleccionar un numero ganador");
        
        uint8 totalBets = gameIdToBetIdCounterMap[gameId];
        
        // Asegurarse de que hay apuestas antes de intentar seleccionar un ganador
        require(totalBets > 0, "No hay apuestas para este juego");

        // Calcular la cantidad total de tokens en juego
        uint256 totalAmount = 0;
        for (uint8 i = 0; i < totalBets; i++) {
            totalAmount += gameToBetMap[gameId][i].amount;
        }

        // Generar un número aleatorio que se utilizará como índice para seleccionar al ganador
        uint8 winningIndex = uint8(uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, msg.sender))) % totalBets);
        
        // Utilizar el número aleatorio como índice para seleccionar al ganador
        Bet storage winningBet = gameToBetMap[gameId][winningIndex];
        uint8 winnerNumber = winningBet.number;
        address winnerAddress = winningBet.player;

        // Calcula el 80% de la recaudación total para el ganador
        uint256 winnerAmount = (totalAmount * 80) / 100;

        // Actualiza el estado del juego y asigna el número y la dirección del ganador
        games[gameId].winnerNumber = winnerNumber;
        games[gameId].winners.push(winnerAddress);
        
        // Transfiere el 80% de la recaudación al ganador
        require(token.transfer(winnerAddress, winnerAmount), "Transfer failed");

        // El restante 20% se queda en el contrato como fee
        // No necesitas hacer nada específico para esto, ya que los tokens ya están en el contrato

        // Cambiar el estado del juego a TERMINADO
        games[gameId].state = GameState.TERMINADO;
    }


    function getGameWinners(uint256 gameId) public view returns(address[] memory) {
        return games[gameId].winners;
    }

}
