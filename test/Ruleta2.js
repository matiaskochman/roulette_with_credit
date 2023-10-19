const { ethers } = require("hardhat");
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const BET_AMOUNT = 100;
const GAME_ID = 0;
// const TOTAL_BETS = 36; // Assuming 37 bets for simplicity, so loop will be from 0 to 36
const MIN_BETS = 37;
const MAX_BETS = 80;

async function setupUsers(usdtTokenMock, ruleta, users) {
  for (let index = 0; index < users.length; index++) {
    await usdtTokenMock.transfer(users[index].address, 1000);
    await usdtTokenMock.connect(users[index]).approve(ruleta.address, 1000);
  }
}

describe("Ruleta with Tesoreria", function () {
  let usdtTokenMock, ruleta, tesoreria, TOTAL_BETS;
  let owner, users;

  beforeEach(async function () {
    [owner, ...users] = await ethers.getSigners();

    // Generate a random number for TOTAL_BETS between 37 and 80
    TOTAL_BETS =
      Math.floor(Math.random() * (MAX_BETS - MIN_BETS + 1)) + MIN_BETS;

    const UsdtTokenMock = await ethers.getContractFactory("UsdtTokenMock");
    usdtTokenMock = await UsdtTokenMock.deploy();
    await usdtTokenMock.deployed();

    const RuletaToken = await ethers.getContractFactory("RuletaToken");
    ruletaToken = await UsdtTokenMock.deploy();
    await ruletaToken.deployed();

    const Tesoreria = await ethers.getContractFactory("Tesoreria");
    tesoreria = await Tesoreria.deploy(
      usdtTokenMock.address,
      ruletaToken.address,
      owner.address
    );
    await tesoreria.deployed();

    const Ruleta = await ethers.getContractFactory("Ruleta");
    ruleta = await Ruleta.deploy(usdtTokenMock.address, tesoreria.address);
    await ruleta.deployed();

    // Cambiar el dueño del contrato Tesoreria a la dirección de la Ruleta
    await tesoreria.connect(owner).transferOwnership(ruleta.address);

    await ruletaToken.transfer(tesoreria.address, 1000000);
    await ruleta.connect(owner).createGame();
    await setupUsers(usdtTokenMock, ruleta, users);
    await ruleta.connect(owner).setGameState(GAME_ID, 1);

    const MAX_BET_NUMBER = 36;

    for (let i = 0; i < TOTAL_BETS; i++) {
      const betNumber = i % (MAX_BET_NUMBER + 1); // Cycle between 0 and 36
      await ruleta
        .connect(users[i % users.length])
        .betInGame(GAME_ID, BET_AMOUNT, betNumber);
    }
    // for (let i = 0; i < TOTAL_BETS; i++) {
    //   await ruleta.connect(users[i]).betInGame(GAME_ID, BET_AMOUNT, i);
    // }

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
    for (let i = 0; i < TOTAL_BETS; i++) {
      // Assuming 37 bets for simplicity
      const bet = await ruleta.connect(users[i]).gameToBetMap(GAME_ID, i); // Fetch the bet using gameId and betId
      if (bet.number === winningNumber) {
        winningBets.push(bet);
        const prev_usdt_tesoreriaBalance = await usdtTokenMock.balanceOf(
          tesoreria.address
        );
        const prev_usdt_Balance = await usdtTokenMock.balanceOf(bet.player);
        const prev_ruleta_tesoreriaBalance = await ruletaToken.balanceOf(
          tesoreria.address
        );
        const previous_ruleta_Balance = await ruletaToken.balanceOf(bet.player);

        await ruleta.connect(users[i]).withdraw(GAME_ID, bet.id); // The second parameter is the betId
        const new_usdt_Balance = await usdtTokenMock.balanceOf(bet.player);
        const post_usdt_tesoreriaBalance = await usdtTokenMock.balanceOf(
          tesoreria.address
        );
        const new_ruleta_Balance = await ruletaToken.balanceOf(bet.player);
        const post_ruleta_tesoreriaBalance = await ruletaToken.balanceOf(
          tesoreria.address
        );

        console.log(
          `\n\nWinner USDT Balance - Previous: ${prev_usdt_Balance}, New: ${new_usdt_Balance}`
        );
        console.log(
          `Winner Ruleta Token Balance - Previous: ${previous_ruleta_Balance}, New: ${new_ruleta_Balance}`
        );
        console.log(
          `USDT Treasury Balance - Previous: ${prev_usdt_tesoreriaBalance}, After: ${post_usdt_tesoreriaBalance}`
        );
        console.log(
          `Ruleta Token Treasury Balance - Previous: ${prev_ruleta_tesoreriaBalance}, After: ${post_ruleta_tesoreriaBalance}`
        );
      }
    }
    // console.log("Winning Bets:", winningBets);
  });
  it.skip("should allow winners to withdraw their winnings", async () => {
    [owner, ...users] = await ethers.getSigners();

    await ruleta.setWinnerNumber(GAME_ID);
    await ruleta.defineWinners(GAME_ID);

    const winningNumber = (await ruleta.games(GAME_ID)).winnerNumber;
    let winningBets = [];

    for (let i = 0; i < TOTAL_BETS; i++) {
      const bet = await ruleta.connect(users[i]).gameToBetMap(GAME_ID, i);
      if (bet.number !== winningNumber) continue;

      const { player: winner, id: betId } = bet;

      const initialUsdtBalance = await usdtTokenMock.balanceOf(winner);
      const initialRuletaBalance = await ruletaToken.balanceOf(winner);

      await ruleta.connect(users[i]).withdraw(GAME_ID, betId);

      const finalUsdtBalance = await usdtTokenMock.balanceOf(winner);
      const finalRuletaBalance = await ruletaToken.balanceOf(winner);

      expect(finalUsdtBalance).to.be.gt(
        initialUsdtBalance,
        "USDT balance should increase for winner"
      );
      expect(finalRuletaBalance).to.be.gt(
        initialRuletaBalance,
        "Ruleta token balance should increase for winner"
      );
      winningBets.push(bet);
    }

    expect(winningBets).to.not.be.empty; // Replace with more specific conditions if applicable
  });
});
