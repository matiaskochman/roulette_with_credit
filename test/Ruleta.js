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
    // expect(await ruleta.games(GAME_ID)).to.deep.include({
    //   winnerNumber: winnerNumber,
    //   state: 3, // RESULTADO_OBTENIDO
    // });

    // Winner withdraws the prize
    await ruleta.connect(winnerUser).withdraw(GAME_ID);

    // Confirm game is in TERMINADO state
    expect((await ruleta.games(GAME_ID)).state).to.equal(4); // TERMINADO
  });
});

// const {
//   time,
//   loadFixture,
// } = require("@nomicfoundation/hardhat-network-helpers");
// const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
// const { expect } = require("chai");

// const BET_AMOUNT = 100;
// const GAME_ID = 0;

// // Utility function to set up user balances and approvals
// async function setupUsers(stableTokenMock, ruleta, users) {
//   for (let index = 0; index < users.length; index++) {
//     await stableTokenMock.transfer(users[index].address, 1000);
//     await stableTokenMock
//       .connect(users[index])
//       .approve(ruleta.address, BET_AMOUNT);
//   }
// }
// describe("Ruleta", function () {
//   // We define a fixture to reuse the same setup in every test.
//   // We use loadFixture to run this setup once, snapshot that state,
//   // and reset Hardhat Network to that snapshot in every test.
//   async function deployOneYearLockFixture() {
//     const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
//     const ONE_GWEI = 1_000_000_000;

//     // const lockedAmount = ONE_GWEI;
//     // const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

//     // Contracts are deployed using the first signer/account by default
//     const [owner, acc1, acc2, acc3, acc4, acc5, acc6, acc7, acc8] =
//       await ethers.getSigners();

//     const StableTokenMock = await ethers.getContractFactory("StableTokenMock");
//     const stableTokenMock = await StableTokenMock.deploy();

//     const Ruleta = await ethers.getContractFactory("Ruleta");
//     const ruleta = await Ruleta.deploy(stableTokenMock.address);
//     const users = [acc1, acc2, acc3, acc4, acc5, acc6, acc7, acc8];
//     return {
//       ruleta,
//       stableTokenMock,
//       owner,
//       users,
//     };
//   }

//   describe("Deployment", function () {
//     it("Should set the right owner", async function () {
//       const { ruleta, stableTokenMock, owner, users } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       // Setup user balances and approvals
//       await setupUsers(stableTokenMock, ruleta, users);

//       await ruleta.createGame();
//       await ruleta.setGameState(0, 1);
//       const gameId = 0;
//       const betAmount = 100;
//       const numberPicked = 5;
//       for (let index = 0; index < users.length; index++) {
//         await ruleta
//           .connect(users[index])
//           .betInGame(gameId, betAmount, numberPicked);
//       }
//       const a = await stableTokenMock.balanceOf(ruleta.address);
//       console.log("balance of ruleta contract: ", a);
//     });
//   });
//   describe("Winning Scenario", function () {
//     it("Should let one player win", async function () {
//       const { ruleta, stableTokenMock, owner, users } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       // Setup user balances and approvals
//       await setupUsers(stableTokenMock, ruleta, users);

//       // Create a new game
//       await ruleta.createGame();
//       await ruleta.setGameState(0, 1); // Assuming 1 is the state where bets are allowed

//       // All players bet on different numbers
//       for (let index = 0; index < users.length; index++) {
//         await ruleta.connect(users[index]).betInGame(0, 10, index);
//       }

//       // Move the game to a state where the winner can be decided
//       await ruleta.setGameState(0, 2); // Assuming 2 means no more bets allowed

//       // Decide the winner. This is tricky because the winning number is random.
//       // In a real test environment, you would mock the randomness for testability.
//       await ruleta.setWinnerNumber(0);

//       const winners = await ruleta.getGameWinners(0);
//       console.log(winners);
//       expect(winners.length).to.equal(1);

//       // Additional checks can go here. For example, check if the winner's balance increased.
//     });
//   });
// });
