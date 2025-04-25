// File: contracts/Ruleta.sol
pragma solidity ^0.8.17; // Standardize version

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol"; // Remove before production
import { Tesoreria } from './Tesoreria.sol';

contract Ruleta is Ownable {
    IERC20 private usdtToken; // Renamed for clarity
    Tesoreria private tesoreria; // Use the contract type

    // Use uint256 for IDs and counts to prevent overflow
    struct Bet {
        uint256 id;
        address player;
        uint256 amount;
        uint8 number; // Roulette number (0-36) is fine as uint8
        bool isWinner;
        uint256 winnings;
    }

    enum GameState { CREADO, SE_PERMITEN_APUESTAS, NO_SE_PERMITEN_APUESTAS, RESULTADO_OBTENIDO, TERMINADO }

    struct Game {
        uint256 id;
        GameState state;
        uint8 winnerNumber; // Roulette number (0-36) is fine as uint8
        address[] winnersAddresses;
        uint256[] winnersBetIds; // Changed to uint256
        uint8 numberOfChances; // Max number + 1 (e.g., 37 for 0-36)
    }

    uint256 private currentGameId = 0;
    mapping(uint256 => Game) public games;
    // Use uint256 for the counter to avoid overflow
    mapping(uint256 => uint256) public gameId_to_bet_counter_map;
    // Use uint256 for the bet ID mapping key
    mapping(uint256 => mapping(uint256 => Bet)) public game_to_bet_map;

    // Event Placeholders
    event GameCreated(uint256 indexed gameId, uint8 numberOfChances);
    event GameStateChanged(uint256 indexed gameId, GameState newState);
    event BetPlaced(uint256 indexed gameId, uint256 indexed betId, address indexed player, uint256 amount, uint8 number);
    event WinnerNumberSet(uint256 indexed gameId, uint8 winnerNumber);
    event WinnersDefined(uint256 indexed gameId, uint256 winnerCount);
    event WinningsWithdrawn(uint256 indexed gameId, uint256 indexed betId, address indexed player, uint256 amount);

    constructor(address _usdtToken, address _tesoreriaContract) {
        require(_usdtToken != address(0), "USDT address cannot be zero");
        require(_tesoreriaContract != address(0), "Tesoreria address cannot be zero");
        usdtToken = IERC20(_usdtToken);
        tesoreria = Tesoreria(_tesoreriaContract); // Store as contract type
    }

    function createGame(uint8 _numberOfChances) public onlyOwner {
        require(_numberOfChances > 1 && _numberOfChances <= 37, "Number of chances must be > 1 and <= 37"); // Basic validation
        Game memory newGame = Game({
            id: currentGameId,
            state: GameState.CREADO,
            winnerNumber: 0, // Or an invalid number like type(uint8).max
            winnersAddresses: new address[](0),
            winnersBetIds: new uint256[](0), // Use uint256
            numberOfChances: _numberOfChances
        });
        games[currentGameId] = newGame;
        // gameId_to_bet_counter_map defaults to 0
        emit GameCreated(currentGameId, _numberOfChances);
        currentGameId++;
    }

    function betInGame(uint256 gameId, uint256 amount, uint8 number) public {
        Game storage currentGame = games[gameId]; // Gas optimization: Load game to storage
        require(currentGame.state == GameState.SE_PERMITEN_APUESTAS, "Betting not allowed in current state");
        require(amount > 0, "Bet amount must be positive");
        require(usdtToken.balanceOf(msg.sender) >= amount, "Insufficient USDT balance");
        require(number < currentGame.numberOfChances, "Invalid number for this game"); // Check against game's chances

        // Player MUST have approved Tesoreria contract beforehand
        tesoreria.depositFromPlayer(msg.sender, amount); // Call the Tesoreria contract

        uint256 currentBetCount = gameId_to_bet_counter_map[gameId]; // Use uint256

        Bet storage newBet = game_to_bet_map[gameId][currentBetCount]; // Use storage pointer for gas saving
        newBet.id = currentBetCount; // Use uint256
        newBet.player = msg.sender;
        newBet.amount = amount;
        newBet.number = number;
        newBet.isWinner = false;
        newBet.winnings = 0;

        gameId_to_bet_counter_map[gameId]++; // Increment counter

        emit BetPlaced(gameId, currentBetCount, msg.sender, amount, number);
    }

    function setGameState(uint256 gameId, GameState newState) public onlyOwner {
        // Add checks for valid state transitions if necessary
        games[gameId].state = newState;
        emit GameStateChanged(gameId, newState);
    }

    // SECURE RANDOMNESS (using Chainlink VRF) IS HIGHLY RECOMMENDED HERE
    // This implementation remains insecure for demonstration purposes based on original code.
    function setWinnerNumber(uint256 gameId) public onlyOwner {
        Game storage currentGame = games[gameId]; // Gas optimization
        require(currentGame.state == GameState.NO_SE_PERMITEN_APUESTAS, "Game must be in NO_SE_PERMITEN_APUESTAS state");
        uint256 totalBets = gameId_to_bet_counter_map[gameId];
        require(totalBets > 0, "No bets placed in this game");

        // !!! INSECURE RANDOMNESS - REPLACE WITH VRF OR COMMIT/REVEAL !!!
        uint8 winnerNumber = uint8(uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, msg.sender, gameId, totalBets))) % currentGame.numberOfChances);
        // !!! END INSECURE RANDOMNESS !!!

        currentGame.winnerNumber = winnerNumber;
        currentGame.state = GameState.RESULTADO_OBTENIDO;
        emit WinnerNumberSet(gameId, winnerNumber);
    }

    // Consider gas implications for large number of bets
    function defineWinners(uint256 gameId) public onlyOwner {
        Game storage currentGame = games[gameId]; // Gas optimization
        require(currentGame.state == GameState.RESULTADO_OBTENIDO, "Game must be in RESULTADO_OBTENIDO state");

        uint256 totalBets = gameId_to_bet_counter_map[gameId];
        uint8 winnerNumber = currentGame.winnerNumber;

        address[] memory tempWinnerAddresses = new address[](totalBets); // Max possible size
        uint256[] memory tempWinnerBetIds = new uint256[](totalBets); // Max possible size, uint256
        uint256 winnerCount = 0;

        for (uint256 i = 0; i < totalBets; i++) { // Use uint256
            Bet storage bet = game_to_bet_map[gameId][i];
            if (bet.player != address(0) && bet.number == winnerNumber) { // Check player exists (not default)
                bet.isWinner = true;
                // Potential overflow if amount * numberOfChances > type(uint256).max (unlikely but possible)
                bet.winnings = bet.amount * currentGame.numberOfChances;
                tempWinnerAddresses[winnerCount] = bet.player;
                tempWinnerBetIds[winnerCount] = i; // betId is the loop index
                winnerCount++;
            }
            // No need to track losers explicitly unless needed for house profit calculation
        }

        // Resize arrays to actual winner count
        address[] memory actualWinnersList = new address[](winnerCount);
        uint256[] memory actualWinnerBetIds = new uint256[](winnerCount); // Use uint256
        for (uint256 i = 0; i < winnerCount; i++) { // Use uint256
            actualWinnersList[i] = tempWinnerAddresses[i];
            actualWinnerBetIds[i] = tempWinnerBetIds[i];
        }

        currentGame.winnersAddresses = actualWinnersList;
        currentGame.winnersBetIds = actualWinnerBetIds;
        currentGame.state = GameState.TERMINADO;
        emit WinnersDefined(gameId, winnerCount);
    }

    function withdraw(uint256 gameId, uint256 betId) public { // Use uint256 for betId
        require(games[gameId].state == GameState.TERMINADO, "Withdrawals only allowed when game is TERMINADO");
        Bet storage bet = game_to_bet_map[gameId][betId];

        require(bet.player == msg.sender, "Bet does not belong to caller");
        require(bet.isWinner, "Bet is not a winner");
        require(bet.winnings > 0, "No winnings available or already withdrawn");

        uint256 winningsToWithdraw = bet.winnings;
        bet.winnings = 0; // Prevent re-entrancy / double withdrawal - set to 0 BEFORE external call

        // Call Tesoreria to handle the actual token transfer
        tesoreria.withdrawWinnings(msg.sender, winningsToWithdraw);
        emit WinningsWithdrawn(gameId, betId, msg.sender, winningsToWithdraw);
    }

    // --- View Functions ---
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

     function getBet(uint256 gameId, uint256 betId) external view returns (Bet memory) { // Use uint256
        return game_to_bet_map[gameId][betId];
    }

    function getGameWinnersAddresses(uint256 gameId) public view returns(address[] memory) {
        return games[gameId].winnersAddresses;
    }

    function getGameWinnersBetIds(uint256 gameId) public view returns(uint256[] memory) { // Use uint256
        return games[gameId].winnersBetIds;
    }

    function getBetCount(uint256 gameId) public view returns (uint256) {
        return gameId_to_bet_counter_map[gameId];
    }
}