Smart Contract-Based Roulette Game README

This document explains the functionality of the smart contracts involved in the roulette game. It is intended for users who will interact with the contracts but did not program them and will not change their programming.

Step 1: Game Preparation

Contract Deployment

- Deploy the following contracts:
  - Tesoreria
  - Ruleta
  - UsdtTokenMock
  - RuletaToken

Initialization and Configuration

- Transfer the necessary tokens to the Tesoreria contract.
- Create a game in the Ruleta contract using the createGame() function.

Step 2: Player Participation

Token Registration and Approval

- Players receive tokens (e.g., USDT).
- Players approve the Tesoreria contract to spend a specified amount of their tokens using the approve() function.

Placing a Bet

- Players place their bets by calling the betInGame() function on the Ruleta contract.
- Players must specify the game ID, the bet amount, and the chosen number.

Step 3: Game Management by the Owner

Closing Bets

- The contract owner changes the game state to "NO_BETS_ALLOWED" using the setGameState() function.

Selecting the Winning Number

- The owner determines the winning number randomly by executing the setWinnerNumber() function.

Determining Winners

- The owner processes all bets and calculates winnings by calling the defineWinners() function.

Step 4: Withdrawal of Winnings

Withdrawal by Winners

- Winning players (those whose bets match the winning number) call the withdraw() function to withdraw their winnings from the Tesoreria contract.

Transfer of Winnings

- The Tesoreria contract processes the withdrawals and transfers the winnings to the players.
- Winnings are transferred either in USDT tokens or in RouletteTokens, depending on the available funds.

Explanation of RouletteToken

Purpose of RouletteToken

RouletteToken serves as a type of voucher within the smart contract-based roulette game. It is used when the game runs out of USDT to pay out winnings. Players can later redeem these tokens for USDT once the game has accumulated enough USDT to exchange them.

How RouletteToken Works

RouletteToken operates as an ERC-20 token, a standard for fungible tokens on the Ethereum blockchain. Here’s a breakdown of how it functions within the game:

1. Deployment:

   - The RouletteToken contract is deployed, creating a fixed supply of tokens that can be distributed and managed within the game ecosystem.

2. Issuing RouletteTokens:

   - When the game runs out of USDT to pay winnings, it issues RouletteTokens to the players as a form of IOU (I Owe You). These tokens represent a promise that the players will receive an equivalent amount of USDT when it becomes available.

3. Redemption Process:
   - Players can redeem their RouletteTokens for USDT through the Tesoreria contract once the game has accumulated enough USDT from subsequent bets and losses.

Example Usage

Here’s a step-by-step example of how a player might interact with RouletteToken:

1. Winning RouletteTokens:

   - The player wins a game of roulette, but the game’s treasury (Tesoreria) is low on USDT.
   - Instead of paying the player in USDT, the game issues 1000 RouletteTokens to the player’s wallet.

2. Waiting for Funds:

   - The game continues to operate, collecting USDT from losing bets.

3. Redeeming RouletteTokens:
   - Once the Tesoreria has accumulated enough USDT, the player can redeem their RouletteTokens.
   - The player approves the Tesoreria contract to spend their RouletteTokens:
     await rouletteToken.approve(tesoreria.address, 1000);
   - The player calls the redemption function to exchange their RouletteTokens for USDT:
     await tesoreria.redeemRouletteTokens(1000);
   - The Tesoreria contract processes the redemption and transfers the equivalent amount of USDT to the player’s wallet.

Additional Considerations

Security and RNG

- Ensure the use of a secure and fair method to generate the winning number, such as Chainlink VRF, to avoid manipulation and ensure randomness.

Testing

- Before going to production, perform thorough testing to ensure all functions behave as expected and handle situations like insufficient funds, invalid bets, etc., correctly.

Gas Optimization

- Consider gas efficiency when designing functions and handling multiple transactions or interactions with the contracts.

Exception Handling

- Ensure your contract adequately handles exceptional situations, such as:
  - Bets placed after the game is closed.
  - Withdrawals attempted by non-winners.

By following these steps, players can participate, place bets, and potentially win in your smart contract-based roulette game.
