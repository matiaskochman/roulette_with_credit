pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Ruleta {
    IERC20 private token;
    
    struct Bet {
        uint256 id;
        address player;
        uint256 amount;
        uint8 number; // Assumes that you'll validate that it's between 0 and 36 elsewhere
    }

    struct Game {
        uint256 id;
        uint8 winnerNumber;
        address[] winners;
    }
    uint256 private currentGameId = 0;
    Game[] private games;
    mapping(uint256 => uint8) public gameIdToBetIdCounterMap;
    mapping(uint256 => Game) public gameMap;
    mapping(uint256 => mapping(uint8 => Bet)) public gameToBetMap;
    constructor(address _token) {
        token = IERC20(_token);
    }

    function createGame() public {
        Game memory game = Game({id: currentGameId, winnerNumber:0,winners: new address[](0)});
        game.id = currentGameId;
        gameMap[currentGameId] = game;
        gameIdToBetIdCounterMap[currentGameId] = 0;
        currentGameId++;
    }

    function bet(uint256 gameId, uint256 amount, uint8 number) public {
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance for bet");
        require(number >= 0 && number <= 36, "Invalid number. Must be between 0 and 36");

        // Transfer the tokens to this contract
        token.transferFrom(msg.sender, address(this), amount);

        // Store the bet
        uint8 betId = gameIdToBetIdCounterMap[gameId];
        Bet memory newBet = Bet({
            id: betId,
            player: msg.sender,
            amount: amount,
            number: number
        });
        
        // Search for the game
        gameToBetMap[gameId][betId] = newBet;
        // Game storage game = games[gameId];
        gameIdToBetIdCounterMap[gameId]++;
    }

    function setWinnerNumber(uint8 _winnerNumber, uint256 _gameId) public {

    }
}
