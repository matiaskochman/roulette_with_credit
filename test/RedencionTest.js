// File: test/RedencionTest.js
const { ethers } = require("hardhat");
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

// --- Constants ---
const TOKEN_DECIMALS = 6; // Assuming 6 decimals for both mock tokens
const BET_AMOUNT_UNITS = ethers.utils.parseUnits("10", TOKEN_DECIMALS);
const GAME_ID = 0;
const MIN_BETS = 5; // Keep low for reasonable test time
const MAX_BETS = 30; // Keep low for reasonable test time
const MAX_BET_NUMBER = 36; // Standard Roulette 0-36
const NUMBER_OF_CHANCES = MAX_BET_NUMBER + 1; // 37 chances (0 included)

// --- Helper Functions ---
async function setupUsers(usdtTokenMock, tesoreriaAddress, users) {
  console.log(` --- Setting up ${users.length} users for approvals ---`);
  const mintAmount = ethers.utils.parseUnits("5000", TOKEN_DECIMALS);
  // Approve a large amount once, sufficient for multiple bets in tests
  const approveAmount = ethers.utils.parseUnits("1000", TOKEN_DECIMALS);

  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    // Ensure owner has enough USDT to distribute
    const ownerSigner = await usdtTokenMock.signer.getAddress(); // Get owner address from token instance
    const ownerBalance = await usdtTokenMock.balanceOf(ownerSigner);
    if (ownerBalance.lt(mintAmount)) {
      console.warn(
        `Owner USDT balance low (${ethers.utils.formatUnits(
          ownerBalance,
          TOKEN_DECIMALS
        )}), minting more...`
      );
      // Assuming UsdtTokenMock has a mint function callable by its owner (deployer)
      try {
        await usdtTokenMock.mint(
          ownerSigner,
          ethers.utils.parseUnits("1000000", TOKEN_DECIMALS)
        );
      } catch (e) {
        console.error(
          "Minting failed in setupUsers - ensure UsdtTokenMock has a mint function callable by owner."
        );
        // If mint doesn't exist or isn't callable, ensure owner has enough initial balance.
      }
    }

    await usdtTokenMock.transfer(user.address, mintAmount);

    // Player approves Tesoreria directly for spending their USDT
    const approveTx = await usdtTokenMock
      .connect(user)
      .approve(tesoreriaAddress, approveAmount);
    await approveTx.wait();

    const allowance = await usdtTokenMock.allowance(
      user.address,
      tesoreriaAddress
    );
    // console.log(`User ${index} (${user.address}) approved Tesoreria ${tesoreriaAddress}. Allowance: ${ethers.utils.formatUnits(allowance, TOKEN_DECIMALS)} USDT`);
    expect(allowance).to.be.gte(
      approveAmount,
      `Approval failed for user ${index}`
    );
  }
  console.log(` --- User setup complete ---`);
}

describe("Ruleta with Tesoreria and Redemption", function () {
  let usdtTokenMock, ruletaToken, ruleta, tesoreria, redencionDeTokens;
  let owner, users; // users array will hold the signer objects
  let TOTAL_BETS;

  // Fixture for deployment and basic setup
  async function deployContractsFixture() {
    console.log("Deploying contracts...");
    const [localOwner, ...localUsers] = await ethers.getSigners();

    // Deploy USDT Mock
    const UsdtTokenMock = await ethers.getContractFactory("UsdtTokenMock");
    const deployedUsdtTokenMock = await UsdtTokenMock.deploy();
    await deployedUsdtTokenMock.deployed();
    console.log(`USDT Mock deployed at: ${deployedUsdtTokenMock.address}`);

    // Deploy RuletaToken
    const RuletaToken = await ethers.getContractFactory("RuletaToken");
    const deployedRuletaToken = await RuletaToken.deploy();
    await deployedRuletaToken.deployed();
    console.log(`RuletaToken deployed at: ${deployedRuletaToken.address}`);

    // Deploy Tesoreria (Owner is deployer - localOwner)
    const Tesoreria = await ethers.getContractFactory("Tesoreria");
    const deployedTesoreria = await Tesoreria.deploy(
      deployedUsdtTokenMock.address,
      deployedRuletaToken.address
      // No owner address needed in constructor if using Ownable default
    );
    await deployedTesoreria.deployed();
    console.log(`Tesoreria deployed at: ${deployedTesoreria.address}`);

    // Deploy RedencionDeTokens
    const RedencionDeTokens = await ethers.getContractFactory(
      "RedencionDeTokens"
    );
    const deployedRedencionDeTokens = await RedencionDeTokens.deploy(
      deployedRuletaToken.address,
      deployedUsdtTokenMock.address
    );
    await deployedRedencionDeTokens.deployed();
    console.log(
      `RedencionDeTokens deployed at: ${deployedRedencionDeTokens.address}`
    );

    // Deploy Ruleta
    const Ruleta = await ethers.getContractFactory("Ruleta");
    const deployedRuleta = await Ruleta.deploy(
      deployedUsdtTokenMock.address,
      deployedTesoreria.address
    );
    await deployedRuleta.deployed();
    console.log(`Ruleta deployed at: ${deployedRuleta.address}`);

    // --- Configuration ---
    // Set Ruleta contract address in Tesoreria (called by Tesoreria owner)
    console.log("Setting Ruleta contract address in Tesoreria...");
    await expect(
      deployedTesoreria
        .connect(localOwner)
        .setRuletaContract(deployedRuleta.address)
    )
      .to.emit(deployedTesoreria, "RuletaContractSet")
      .withArgs(deployedRuleta.address);
    console.log("Ruleta address set.");

    // Fund Tesoreria with RuletaTokens for potential payouts
    const initialRbtSupply = await deployedRuletaToken.balanceOf(
      localOwner.address
    );
    const rbtToFund = initialRbtSupply.div(2); // Send half
    console.log(
      `Funding Tesoreria with ${ethers.utils.formatUnits(
        rbtToFund,
        TOKEN_DECIMALS
      )} RBT...`
    );
    await expect(
      deployedRuletaToken
        .connect(localOwner)
        .transfer(deployedTesoreria.address, rbtToFund)
    )
      .to.emit(deployedRuletaToken, "Transfer")
      .withArgs(localOwner.address, deployedTesoreria.address, rbtToFund);
    console.log("Tesoreria funded with RBT.");

    // Fund RedencionDeTokens contract with USDT for redemptions
    const usdtToFundRedemption = ethers.utils.parseUnits(
      "100000",
      TOKEN_DECIMALS
    ); // Generous amount
    console.log(
      `Funding RedencionDeTokens with ${ethers.utils.formatUnits(
        usdtToFundRedemption,
        TOKEN_DECIMALS
      )} USDT...`
    );
    await expect(
      deployedUsdtTokenMock
        .connect(localOwner)
        .transfer(deployedRedencionDeTokens.address, usdtToFundRedemption)
    )
      .to.emit(deployedUsdtTokenMock, "Transfer")
      .withArgs(
        localOwner.address,
        deployedRedencionDeTokens.address,
        usdtToFundRedemption
      );
    console.log("RedencionDeTokens funded with USDT.");

    console.log("Contract deployment and initial funding complete.");

    return {
      usdtTokenMock: deployedUsdtTokenMock,
      ruletaToken: deployedRuletaToken,
      ruleta: deployedRuleta,
      tesoreria: deployedTesoreria,
      redencionDeTokens: deployedRedencionDeTokens,
      owner: localOwner, // Return the signers
      users: localUsers,
    };
  }

  beforeEach(async function () {
    // Use loadFixture for significantly faster test runs after the first one
    ({
      usdtTokenMock,
      ruletaToken,
      ruleta,
      tesoreria,
      redencionDeTokens,
      owner,
      users,
    } = await loadFixture(deployContractsFixture));

    // Setup a random number of bets for variability in tests
    TOTAL_BETS =
      Math.floor(Math.random() * (MAX_BETS - MIN_BETS + 1)) + MIN_BETS;
    console.log(`\n--- Test Case Start ---`);
    console.log(`Total Bets for this run: ${TOTAL_BETS}`);
    console.log(`Owner: ${owner.address}`);
    console.log(`Using ${users.length} player accounts.`);

    // Create the game
    console.log(`Creating game ID ${GAME_ID}...`);
    await expect(ruleta.connect(owner).createGame(NUMBER_OF_CHANCES))
      .to.emit(ruleta, "GameCreated")
      .withArgs(GAME_ID, NUMBER_OF_CHANCES);

    // Set up users (give them USDT and approve Tesoreria)
    console.log("Setting up user allowances for Tesoreria...");
    await setupUsers(usdtTokenMock, tesoreria.address, users);

    // Set game state to allow betting
    console.log(`Setting game ${GAME_ID} state to SE_PERMITEN_APUESTAS (1)...`);
    await expect(ruleta.connect(owner).setGameState(GAME_ID, 1)) // 1 = SE_PERMITEN_APUESTAS
      .to.emit(ruleta, "GameStateChanged")
      .withArgs(GAME_ID, 1);
    console.log("--- Setup Complete ---");
  });

  it("should allow winners to withdraw winnings (potentially mixed USDT/RBT) and redeem RBT", async function () {
    console.log(`Placing ${TOTAL_BETS} bets...`);
    // Place bets using different users and numbers
    for (let i = 0; i < TOTAL_BETS; i++) {
      const betNumber = i % NUMBER_OF_CHANCES; // Cycle through numbers 0-36
      const playerIndex = i % users.length;
      const player = users[playerIndex];

      // Check allowance before betting (important for debugging)
      const allowance = await usdtTokenMock.allowance(
        player.address,
        tesoreria.address
      );
      expect(allowance).to.be.gte(
        BET_AMOUNT_UNITS,
        `User ${playerIndex} has insufficient allowance before betting`
      );

      await expect(
        ruleta.connect(player).betInGame(GAME_ID, BET_AMOUNT_UNITS, betNumber)
      ).to.emit(ruleta, "BetPlaced").to.not.be.reverted; // Check basic event emission
    }
    console.log("Betting complete.");
    expect(await ruleta.getBetCount(GAME_ID)).to.equal(TOTAL_BETS);

    // --- Progress Game ---
    console.log(
      `Setting game ${GAME_ID} state to NO_SE_PERMITEN_APUESTAS (2)...`
    );
    await expect(ruleta.connect(owner).setGameState(GAME_ID, 2)) // 2 = NO_SE_PERMITEN_APUESTAS
      .to.emit(ruleta, "GameStateChanged")
      .withArgs(GAME_ID, 2);
    console.log("Betting closed.");

    // --- Optional: Owner Profit Withdrawal ---
    const initialTesoreriaUSDT = await usdtTokenMock.balanceOf(
      tesoreria.address
    );
    const ownerProfitUSDT = initialTesoreriaUSDT.div(4); // Example: Owner takes 1/4 of current USDT
    if (ownerProfitUSDT.gt(0)) {
      const ownerInitialUSDT = await usdtTokenMock.balanceOf(owner.address);
      console.log(
        `Owner attempting to withdraw profit: ${ethers.utils.formatUnits(
          ownerProfitUSDT,
          TOKEN_DECIMALS
        )} USDT`
      );
      await expect(
        tesoreria.connect(owner).withdrawHouseProfits(ownerProfitUSDT, 0)
      )
        .to.emit(tesoreria, "HouseProfitWithdrawn")
        .withArgs(owner.address, ownerProfitUSDT, 0);
      console.log("Owner profit withdrawn.");
      expect(await usdtTokenMock.balanceOf(tesoreria.address)).to.equal(
        initialTesoreriaUSDT.sub(ownerProfitUSDT)
      );
      expect(await usdtTokenMock.balanceOf(owner.address)).to.equal(
        ownerInitialUSDT.add(ownerProfitUSDT)
      );
    } else {
      console.log("No USDT profit for owner to withdraw at this time.");
    }

    // --- Determine Winner ---
    console.log("Setting winner number...");
    await expect(ruleta.connect(owner).setWinnerNumber(GAME_ID)).to.emit(
      ruleta,
      "WinnerNumberSet"
    ); // Basic check
    const gameData = await ruleta.getGame(GAME_ID);
    const winningNumber = gameData.winnerNumber;
    expect(gameData.state).to.equal(3); // 3 = RESULTADO_OBTENIDO
    console.log(`Winning number set to: ${winningNumber}`);

    // --- Define Winners ---
    console.log("Defining winners...");
    await expect(ruleta.connect(owner).defineWinners(GAME_ID)).to.emit(
      ruleta,
      "WinnersDefined"
    ); // Basic check
    const finalGameData = await ruleta.getGame(GAME_ID);
    expect(finalGameData.state).to.equal(4); // 4 = TERMINADO
    console.log("Winners defined.");

    // --- Winner Withdrawals and Redemptions ---
    const winnerAddresses = await ruleta.getGameWinnersAddresses(GAME_ID);
    const winnerBetIds = await ruleta.getGameWinnersBetIds(GAME_ID); // uint256[]
    console.log(`Actual winners found: ${winnerAddresses.length}`);

    expect(winnerAddresses.length).to.equal(winnerBetIds.length);
    if (winnerAddresses.length === 0) {
      console.log("No winners for this round.");
    }

    for (let index = 0; index < winnerBetIds.length; index++) {
      const winnerBetId = winnerBetIds[index]; // This is uint256 now
      const winnerAddress = winnerAddresses[index];
      // Find the signer object for the winner address
      const winnerSigner =
        users.find((user) => user.address === winnerAddress) ||
        (owner.address === winnerAddress ? owner : null);

      if (!winnerSigner) {
        console.error(
          `!!! Signer not found for winner address: ${winnerAddress}. Skipping withdrawal check.`
        );
        continue;
      }

      console.log(
        `\n--- Processing winner ${index + 1}/${
          winnerBetIds.length
        }: Address ${winnerAddress}, Bet ID ${winnerBetId} ---`
      );

      const betDataBefore = await ruleta.getBet(GAME_ID, winnerBetId);
      const expectedWinnings = betDataBefore.winnings;
      expect(expectedWinnings).to.be.gt(
        0,
        "Winner bet has no winnings amount before withdraw"
      );
      expect(betDataBefore.isWinner).to.be.true;

      // Get balances BEFORE withdrawal
      const prevWinnerUsdt = await usdtTokenMock.balanceOf(winnerAddress);
      const prevWinnerRbt = await ruletaToken.balanceOf(winnerAddress);
      const prevTesoreriaUsdt = await usdtTokenMock.balanceOf(
        tesoreria.address
      );
      const prevTesoreriaRbt = await ruletaToken.balanceOf(tesoreria.address);

      // Winner withdraws
      console.log(
        `Winner ${winnerAddress} withdrawing winnings for bet ${winnerBetId}...`
      );
      await expect(ruleta.connect(winnerSigner).withdraw(GAME_ID, winnerBetId))
        .to.emit(ruleta, "WinningsWithdrawn")
        .withArgs(GAME_ID, winnerBetId, winnerAddress, expectedWinnings);

      // Get balances AFTER withdrawal
      const postWinnerUsdt = await usdtTokenMock.balanceOf(winnerAddress);
      const postWinnerRbt = await ruletaToken.balanceOf(winnerAddress);
      const postTesoreriaUsdt = await usdtTokenMock.balanceOf(
        tesoreria.address
      );
      const postTesoreriaRbt = await ruletaToken.balanceOf(tesoreria.address);

      // Calculate amounts transferred
      const usdtReceived = postWinnerUsdt.sub(prevWinnerUsdt);
      const rbtReceived = postWinnerRbt.sub(prevWinnerRbt);
      const usdtPaid = prevTesoreriaUsdt.sub(postTesoreriaUsdt);
      const rbtPaid = prevTesoreriaRbt.sub(postTesoreriaRbt);

      console.table([
        {
          Wallet: "Winner",
          "USDT Change": ethers.utils.formatUnits(usdtReceived, TOKEN_DECIMALS),
          "RBT Change": ethers.utils.formatUnits(rbtReceived, TOKEN_DECIMALS), // Added comma
        },
        {
          Wallet: "Tesoreria",
          "USDT Change": `-${ethers.utils.formatUnits(
            usdtPaid,
            TOKEN_DECIMALS
          )}`,
          "RBT Change": `-${ethers.utils.formatUnits(rbtPaid, TOKEN_DECIMALS)}`, // Added comma
        },
      ]); // Added semicolon

      // Assertions for withdrawal
      expect(usdtReceived.add(rbtReceived)).to.equal(
        expectedWinnings,
        "Total withdrawn amount mismatch"
      );
      expect(usdtPaid).to.equal(usdtReceived, "Tesoreria USDT paid mismatch");
      expect(rbtPaid).to.equal(rbtReceived, "Tesoreria RBT paid mismatch");
      // Check Tesoreria balances didn't go negative
      expect(postTesoreriaUsdt).to.be.gte(0);
      expect(postTesoreriaRbt).to.be.gte(0);

      const betDataAfter = await ruleta.getBet(GAME_ID, winnerBetId);
      expect(betDataAfter.winnings).to.equal(
        0,
        "Winnings not cleared after withdrawal"
      );

      // Attempt redemption if RBT was received
      if (rbtReceived.gt(0)) {
        console.log(
          `Winner received ${ethers.utils.formatUnits(
            rbtReceived,
            TOKEN_DECIMALS
          )} RBT. Attempting redemption...`
        );
        const prevRedeemUsdt_Contract = await usdtTokenMock.balanceOf(
          redencionDeTokens.address
        );
        const prevRedeemRbt_Winner = await ruletaToken.balanceOf(winnerAddress); // Should equal rbtReceived if no prior balance
        const prevRedeemRbt_Contract = await ruletaToken.balanceOf(
          redencionDeTokens.address
        );

        expect(prevRedeemUsdt_Contract).to.be.gte(
          rbtReceived,
          "Redemption contract has insufficient USDT for this redemption"
        );

        // Approve RedencionDeTokens contract to spend the winner's RBT
        console.log(
          `Approving RedencionDeTokens contract (${redencionDeTokens.address}) to spend RBT...`
        );
        await expect(
          ruletaToken
            .connect(winnerSigner)
            .approve(redencionDeTokens.address, rbtReceived)
        )
          .to.emit(ruletaToken, "Approval")
          .withArgs(winnerAddress, redencionDeTokens.address, rbtReceived);

        // Redeem tokens
        console.log("Calling redimirRuletaTokens...");
        await expect(
          redencionDeTokens
            .connect(winnerSigner)
            .redimirRuletaTokens(rbtReceived)
        ).to.not.be.reverted; // Ideally check for events here too if added

        // Get balances AFTER redemption
        const finalWinnerUsdt = await usdtTokenMock.balanceOf(winnerAddress);
        const finalWinnerRbt = await ruletaToken.balanceOf(winnerAddress);
        const finalRedeemUsdt_Contract = await usdtTokenMock.balanceOf(
          redencionDeTokens.address
        );
        const finalRedeemRbt_Contract = await ruletaToken.balanceOf(
          redencionDeTokens.address
        );

        console.log(`Redemption successful.`);
        console.table([
          {
            Wallet: "Winner",
            "USDT Balance": ethers.utils.formatUnits(
              finalWinnerUsdt,
              TOKEN_DECIMALS
            ),
            "RBT Balance": ethers.utils.formatUnits(
              finalWinnerRbt,
              TOKEN_DECIMALS
            ), // Added comma
          },
          {
            Wallet: "Redencion Contract",
            "USDT Balance": ethers.utils.formatUnits(
              finalRedeemUsdt_Contract,
              TOKEN_DECIMALS
            ),
            "RBT Balance": ethers.utils.formatUnits(
              finalRedeemRbt_Contract,
              TOKEN_DECIMALS
            ), // Added comma
          },
        ]); // Added semicolon

        // Assertions for redemption
        // Winner should have received USDT equivalent to RBT redeemed (1:1 assumed)
        expect(finalWinnerUsdt).to.equal(
          postWinnerUsdt.add(rbtReceived),
          "Winner USDT balance incorrect after redemption"
        );
        // Winner should have no RBT left from this withdrawal if they started with 0
        expect(finalWinnerRbt).to.equal(
          prevRedeemRbt_Winner.sub(rbtReceived),
          "Winner RBT balance incorrect after redemption"
        );
        // Redemption contract should have less USDT
        expect(finalRedeemUsdt_Contract).to.equal(
          prevRedeemUsdt_Contract.sub(rbtReceived),
          "Redemption contract USDT balance incorrect"
        );
        // Redemption contract should have gained the RBT
        expect(finalRedeemRbt_Contract).to.equal(
          prevRedeemRbt_Contract.add(rbtReceived),
          "Redemption contract RBT balance incorrect"
        );
      } else {
        console.log(
          "Winner received only USDT, no redemption needed for this win."
        );
      }
    } // End of winner processing loop

    console.log("\n--- Test Case End ---");
  }); // End of it() block

  // TODO: Add more tests as suggested previously
}); // End of describe() block
