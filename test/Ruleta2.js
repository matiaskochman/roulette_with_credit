const { ethers } = require("hardhat");
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const BET_AMOUNT = 100;
const GAME_ID = 0;

async function setupUsers(stableTokenMock, ruleta, users) {
  for (let index = 0; index < users.length; index++) {
    await stableTokenMock.transfer(users[index].address, 1000);
    await stableTokenMock
      .connect(users[index])
      .approve(ruleta.address, BET_AMOUNT);
  }
}

describe("Ruleta with Tesoreria", function () {
  let stableTokenMock, ruleta, tesoreria;
  let owner, users;

  beforeEach(async function () {
    [owner, ...users] = await ethers.getSigners();

    const StableTokenMock = await ethers.getContractFactory("StableTokenMock");
    stableTokenMock = await StableTokenMock.deploy();
    await stableTokenMock.deployed();

    const Tesoreria = await ethers.getContractFactory("Tesoreria");
    tesoreria = await Tesoreria.deploy(stableTokenMock.address, owner.address);
    await tesoreria.deployed();

    const Ruleta = await ethers.getContractFactory("Ruleta");
    ruleta = await Ruleta.deploy(stableTokenMock.address, tesoreria.address);
    await ruleta.deployed();

    // Cambiar el dueño del contrato Tesoreria a la dirección de la Ruleta
    await tesoreria.connect(owner).transferOwnership(ruleta.address);

    await stableTokenMock.transfer(tesoreria.address, 1000);

    await ruleta.connect(owner).createGame();
    await setupUsers(stableTokenMock, ruleta, users);
    await ruleta.connect(owner).setGameState(GAME_ID, 1);
    for (let i = 0; i < 36; i++) {
      await ruleta.connect(users[i]).betInGame(GAME_ID, BET_AMOUNT, i);
    }
    await ruleta.connect(owner).setGameState(GAME_ID, 2);
  });

  it("should deposit lost amounts to Tesoreria", async function () {
    await ruleta.setWinnerNumber(GAME_ID);
    await ruleta.defineWinners(GAME_ID);

    const totalDeposits = await tesoreria.totalDeposits();
    console.log(totalDeposits);
    expect(totalDeposits).to.be.gt(0); // Assuming at least one loser
  });

  it("should allow winners to withdraw their winnings", async function () {
    [owner, ...users] = await ethers.getSigners();
    await ruleta.setWinnerNumber(GAME_ID);
    await ruleta.defineWinners(GAME_ID);

    // 1. Fetch the winning number from the Ruleta contract
    const winningNumber = (await ruleta.games(GAME_ID)).winnerNumber;

    // 2. Loop through the bets placed by users to find the winning bet(s)
    let winningBets = [];
    for (let i = 0; i < 36; i++) {
      // Assuming 37 bets for simplicity
      const bet = await ruleta.connect(users[i]).gameToBetMap(GAME_ID, i); // Fetch the bet using gameId and betId
      if (bet.number === winningNumber) {
        winningBets.push(bet);
        const prev_tesoreriaBalance = await stableTokenMock.balanceOf(
          tesoreria.address
        );
        const previousBalance = await stableTokenMock.balanceOf(bet.player);
        await ruleta.connect(users[i]).withdraw(GAME_ID, bet.id); // The second parameter is the betId
        const newBalance = await stableTokenMock.balanceOf(bet.player);
        const post_tesoreriaBalance = await stableTokenMock.balanceOf(
          tesoreria.address
        );
        console.log(
          `previusBalance: ${previousBalance} newbalance: ${newBalance}`
        );
        console.log(
          `prev tesoreria balance: ${prev_tesoreriaBalance} after: ${post_tesoreriaBalance}`
        );
      }
    }
    console.log("Winning Bets:", winningBets);
  });

  // ... (Your existing tests can also go here)
});
