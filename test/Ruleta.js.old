const { ethers } = require("hardhat");
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const BET_AMOUNT = 100;
const GAME_ID = 0;

// Utility function to set up user balances and approvals
async function setupUsers(stableTokenMock, ruleta, users) {
  for (let index = 0; index < users.length; index++) {
    await stableTokenMock.transfer(users[index].address, 1000);
    await stableTokenMock
      .connect(users[index])
      .approve(ruleta.address, BET_AMOUNT);
  }
}

describe("Ruleta", function () {
  let stableTokenMock, ruleta;
  let owner, users;

  beforeEach(async function () {
    [owner, ...users] = await ethers.getSigners();

    const StableTokenMock = await ethers.getContractFactory("StableTokenMock");
    stableTokenMock = await StableTokenMock.deploy();
    await stableTokenMock.deployed(); // Ensure deployment is complete

    const Ruleta = await ethers.getContractFactory("Ruleta");
    ruleta = await Ruleta.deploy(stableTokenMock.address);
    await ruleta.deployed(); // Ensure deployment is complete

    // Create a game
    await ruleta.connect(owner).createGame(); // Use the 'connect' function

    // Set up users with token balances and approvals
    await setupUsers(stableTokenMock, ruleta, users);

    // Each account places a bet on a different number
    await ruleta.connect(owner).setGameState(GAME_ID, 1); // Use the 'connect' function
    for (let i = 0; i < 37; i++) {
      await ruleta.connect(users[i]).betInGame(GAME_ID, BET_AMOUNT, i); // Use the 'connect' function
    }

    // Close the betting phase
    await ruleta.connect(owner).setGameState(GAME_ID, 2); // Use the 'connect' function
  });

  it("should declare one winner", async function () {
    // Determine the winner
    await ruleta.setWinnerNumber(GAME_ID);

    const game = await ruleta.games(GAME_ID);
    const winnerNumber = game.winnerNumber;
    console.log(`winner number: ${winnerNumber}`);
    // Check if one of the players won
    const winnerUser = users[winnerNumber];
    console.log(`winner address: ${winnerUser.address}`);

    // Winner withdraws the prize
    await ruleta.connect(winnerUser).withdraw(GAME_ID);

    // Confirm game is in TERMINADO state
    expect((await ruleta.games(GAME_ID)).state).to.equal(4); // TERMINADO
  });
  it("should declare one winner and receive 36x bet amount", async function () {
    // Determine the winner
    await ruleta.setWinnerNumber(GAME_ID);

    const game = await ruleta.games(GAME_ID);
    const winnerNumber = game.winnerNumber;

    // Initial balance
    const initialBalance = await stableTokenMock.balanceOf(
      users[winnerNumber].address
    );

    // Check if one of the players won
    const winnerUser = users[winnerNumber];

    // Winner withdraws the prize
    await ruleta.connect(winnerUser).withdraw(GAME_ID);

    // Final balance
    const finalBalance = await stableTokenMock.balanceOf(
      users[winnerNumber].address
    );

    // Confirm game is in TERMINADO state
    expect((await ruleta.games(GAME_ID)).state).to.equal(4); // TERMINADO

    // Confirm the winner received 36 times their bet
    expect(finalBalance.sub(initialBalance)).to.equal(BET_AMOUNT * 36);
  });
});
