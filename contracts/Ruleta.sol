// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
import { Tesoreria } from './Tesoreria.sol';
contract Ruleta is Ownable {
    IERC20 private token;
    uint8 ruletaTop = 37;
    enum GameState { CREADO, SE_PERMITEN_APUESTAS, NO_SE_PERMITEN_APUESTAS, RESULTADO_OBTENIDO, TERMINADO }

    struct Bet {
        uint256 id;
        address player;
        uint256 amount;
        uint8 number;
        bool isWinner;      // New field to indicate if this bet is a winner
        uint256 winnings;   // New field to store the winnings for this bet
    }


    struct Game {
        uint256 id;
        GameState state;
        uint8 winnerNumber;
        address[] winners;
    }
    uint256 public earnings;
    uint256 private currentGameId = 0;
    mapping(uint256 => Game) public games;
    mapping(uint256 => uint8) public gameIdToBetIdCounterMap;
    mapping(uint256 => mapping(uint8 => Bet)) public gameToBetMap;
    address public tesoreriaContract;

    constructor(address _token, address _tesoreriaContract) {
        token = IERC20(_token);
        tesoreriaContract = _tesoreriaContract;
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
            number: number,
            isWinner: false,  // Initialize as false
            winnings: 0       // Initialize with 0 winnings
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
        
        // Generate a random number between 0 and 36
        uint8 winnerNumber = uint8(uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, msg.sender))) % ruletaTop);
        
        games[gameId].winnerNumber = winnerNumber;
        games[gameId].state = GameState.RESULTADO_OBTENIDO;
        
    }

    function defineWinners(uint256 gameId) public onlyOwner {
        require(games[gameId].state == GameState.RESULTADO_OBTENIDO, "El juego debe estar en estado 'RESULTADO_OBTENIDO' para definir ganadores");

        uint8 totalBets = gameIdToBetIdCounterMap[gameId];
        uint8 winnerNumber = games[gameId].winnerNumber;
        address[] memory winnersList = new address[](totalBets); // tamaño máximo posible
        uint256 winnerCount = 0;

        for (uint8 i = 0; i < totalBets; i++) {
            Bet storage bet = gameToBetMap[gameId][i];
            if (bet.number == winnerNumber) {
                bet.isWinner = true;
                bet.winnings = bet.amount * 36;  // Set the winnings for this bet
            }
        }

        // Redimensionar el array a la cantidad real de ganadores
        address[] memory actualWinnersList = new address[](winnerCount);
        for (uint256 i = 0; i < winnerCount; i++) {
            actualWinnersList[i] = winnersList[i];
        }

        games[gameId].winners = actualWinnersList;
        games[gameId].state = GameState.TERMINADO; // Puedes cambiar el estado a TERMINADO aquí si deseas

        uint256 totalLost = 0;
        for (uint8 i = 0; i < totalBets; i++) {
            Bet storage bet = gameToBetMap[gameId][i];
            if (bet.number != winnerNumber) {
                totalLost += bet.amount;
            }
        }

        if (totalLost > 0) {
            require(token.approve(tesoreriaContract, totalLost), "Aprobacion fallida");
            Tesoreria(tesoreriaContract).deposit(totalLost);
        }
    }

function withdraw(uint256 gameId, uint8 betId) public {
    require(games[gameId].state == GameState.TERMINADO, "El juego debe estar en estado 'RESULTADO_OBTENIDO' para retirar las ganancias");

    Bet storage bet = gameToBetMap[gameId][betId];

    // Ensure that the bet belongs to the caller
    require(bet.player == msg.sender, "Esta apuesta no te pertenece");
    
    // Ensure that it was a winning bet and has positive winnings
    require(bet.isWinner, "No ganaste con esta apuesta");
    require(bet.winnings > 0, "No tienes ganancias para retirar o ya las has retirado");

    uint256 winnings = bet.winnings; // Get the winnings for this specific bet

    // Reset the bet winnings to prevent reentrancy
    bet.winnings = 0;


    // Transfer the winnings from Tesoreria to the player
    Tesoreria(tesoreriaContract).withdrawWinnings(msg.sender, winnings);
    // // Transfer the winnings to the player
    // require(token.transfer(msg.sender, winnings), "Transfer failed");
}


    function getGameWinners(uint256 gameId) public view returns(address[] memory) {
        return games[gameId].winners;
    }

}
