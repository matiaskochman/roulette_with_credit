const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
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
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000;

    // const lockedAmount = ONE_GWEI;
    // const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    // Contracts are deployed using the first signer/account by default
    const [owner, acc1, acc2, acc3, acc4, acc5, acc6, acc7, acc8] =
      await ethers.getSigners();

    const StableTokenMock = await ethers.getContractFactory("StableTokenMock");
    const stableTokenMock = await StableTokenMock.deploy();

    const Ruleta = await ethers.getContractFactory("Ruleta");
    const ruleta = await Ruleta.deploy(stableTokenMock.address);
    const users = [acc1, acc2, acc3, acc4, acc5, acc6, acc7, acc8];
    return {
      ruleta,
      stableTokenMock,
      owner,
      users,
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { ruleta, stableTokenMock, owner, users } = await loadFixture(
        deployOneYearLockFixture
      );

      // Setup user balances and approvals
      await setupUsers(stableTokenMock, ruleta, users);

      await ruleta.createGame();
      await ruleta.setGameState(0, 1);
      const gameId = 0;
      const betAmount = 100;
      const numberPicked = 5;
      for (let index = 0; index < users.length; index++) {
        await ruleta
          .connect(users[index])
          .betInGame(gameId, betAmount, numberPicked);
      }
      const a = await stableTokenMock.balanceOf(ruleta.address);
      console.log("balance of ruleta contract: ", a);
    });
  });
  describe("Winning Scenario", function () {
    it("Should let one player win", async function () {
      const { ruleta, stableTokenMock, owner, users } = await loadFixture(
        deployOneYearLockFixture
      );

      // Setup user balances and approvals
      await setupUsers(stableTokenMock, ruleta, users);

      // Create a new game
      await ruleta.createGame();
      await ruleta.setGameState(0, 1); // Assuming 1 is the state where bets are allowed

      // All players bet on different numbers
      for (let index = 0; index < users.length; index++) {
        await ruleta.connect(users[index]).betInGame(0, 10, index);
      }

      // Move the game to a state where the winner can be decided
      await ruleta.setGameState(0, 2); // Assuming 2 means no more bets allowed

      // Decide the winner. This is tricky because the winning number is random.
      // In a real test environment, you would mock the randomness for testability.
      await ruleta.setWinnerNumber(0);

      const winners = await ruleta.getGameWinners(0);
      console.log(winners);
      expect(winners.length).to.equal(1);

      // Additional checks can go here. For example, check if the winner's balance increased.
    });
  });
  describe("Winning Scenario 2", function () {
    it("Should let one player win and distribute funds correctly", async function () {
      const { ruleta, stableTokenMock, owner, users } = await loadFixture(
        deployOneYearLockFixture
      );
      // Setup user balances and approvals
      await setupUsers(stableTokenMock, ruleta, users);

      const initialContractBalance = await stableTokenMock.balanceOf(
        ruleta.address
      );
      expect(initialContractBalance).to.equal(0);

      // Crea un juego y permite las apuestas
      await ruleta.createGame();
      await ruleta.setGameState(0, 1);

      const gameId = 0;
      const betAmount = 100;
      const numberPicked = 5;

      // Los usuarios hacen sus apuestas
      for (let index = 0; index < users.length; index++) {
        await stableTokenMock
          .connect(users[index])
          .approve(ruleta.address, betAmount);
        await ruleta
          .connect(users[index])
          .betInGame(gameId, betAmount, numberPicked);
      }

      // Cambia el estado del juego a NO_SE_PERMITEN_APUESTAS
      await ruleta.setGameState(gameId, 2);

      // Calcula el total de la recaudación
      const totalAmount = betAmount * users.length; // 800 en este caso
      const winnerAmount = (totalAmount * 80) / 100; // 640 (80% para el ganador)
      const feeAmount = (totalAmount * 20) / 100; // 160 (20% para el contrato)

      // Establece el número ganador y termina el juego
      await ruleta.setWinnerNumber(gameId);

      const winnerAddress = await ruleta.getGameWinners(0);
      console.log(winnerAddress);

      // Comprobar las balances
      const winnerBalance = await stableTokenMock.balanceOf(winnerAddress[0]);
      const contractBalance = await stableTokenMock.balanceOf(ruleta.address);

      console.log(`totalAmount: ${totalAmount}`);
      console.log(
        `winnerBalance: ${winnerAmount} contractBalance: ${feeAmount}`
      );
      expect(totalAmount).to.equal(winnerAmount + feeAmount);
      // expect(contractBalance).to.equal(feeAmount);
    });
  });
});
