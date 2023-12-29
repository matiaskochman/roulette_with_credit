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
const MAX_BETS = 180;

async function setupUsers(usdtTokenMock, ruleta, users) {
  for (let index = 0; index < users.length; index++) {
    await usdtTokenMock.transfer(users[index].address, 1000);
    await usdtTokenMock.connect(users[index]).approve(ruleta.address, 1000);
  }
}

describe("Ruleta with Tesoreria", function () {
  let usdtTokenMock, ruleta, tesoreria, TOTAL_BETS;
  let owner, users;
  const MAX_BET_NUMBER = 36;

  beforeEach(async function () {
    // Obtiene las direcciones de los signatarios (owner y usuarios) de la blockchain de prueba
    [owner, ...users] = await ethers.getSigners();

    // Genera un número aleatorio para TOTAL_BETS entre 37 y 80.
    // Esto determina cuántas apuestas se realizarán en total en la prueba.
    TOTAL_BETS =
      Math.floor(Math.random() * (MAX_BETS - MIN_BETS + 1)) + MIN_BETS;

    // Implementa el mock de token USDT para usarlo en las pruebas
    const UsdtTokenMock = await ethers.getContractFactory("UsdtTokenMock");
    usdtTokenMock = await UsdtTokenMock.deploy();
    await usdtTokenMock.deployed();

    // Implementa un token para la ruleta
    const RuletaToken = await ethers.getContractFactory("RuletaToken");
    ruletaToken = await UsdtTokenMock.deploy(); // Aquí parece que deberías usar RuletaToken.deploy()
    await ruletaToken.deployed();

    // Despliega el contrato Tesoreria con las direcciones de los tokens USDT y de la ruleta
    const Tesoreria = await ethers.getContractFactory("Tesoreria");
    tesoreria = await Tesoreria.deploy(
      usdtTokenMock.address,
      ruletaToken.address,
      owner.address
    );
    await tesoreria.deployed();

    // Despliega el contrato Ruleta con la dirección del token USDT y del contrato Tesoreria
    const Ruleta = await ethers.getContractFactory("Ruleta");
    ruleta = await Ruleta.deploy(usdtTokenMock.address, tesoreria.address);
    await ruleta.deployed();

    // Transfiere la propiedad del contrato Tesoreria a la dirección del contrato Ruleta
    await tesoreria.connect(owner).transferOwnership(ruleta.address);

    // Transfiere tokens de Ruleta al contrato Tesoreria para simular fondos
    await ruletaToken.transfer(tesoreria.address, 1000000);

    // Crea un nuevo juego en el contrato Ruleta
    await ruleta.connect(owner).createGame();

    // Configura los usuarios para las pruebas, dando tokens y aprobación para gastar
    await setupUsers(usdtTokenMock, ruleta, users);

    // Cambia el estado del juego para permitir apuestas
    await ruleta.connect(owner).setGameState(GAME_ID, 1);

    // Realiza apuestas en el juego para cada usuario.
    // Cada usuario apuesta en un número que va ciclando entre 0 y 36.
    for (let i = 0; i < TOTAL_BETS; i++) {
      const betNumber = i % (MAX_BET_NUMBER + 1); // Cicla entre 0 y 36
      await ruleta
        .connect(users[i % users.length])
        .betInGame(GAME_ID, BET_AMOUNT, betNumber);
    }

    // Cambia el estado del juego para cerrar las apuestas
    await ruleta.connect(owner).setGameState(GAME_ID, 2);
  });

  // Prueba para verificar que las cantidades perdidas se depositan en la Tesorería
  it("should deposit lost amounts to Tesoreria", async function () {
    // Establece el número ganador en el contrato de la ruleta
    await ruleta.setWinnerNumber(GAME_ID);

    // Define los ganadores en el contrato de la ruleta
    await ruleta.defineWinners(GAME_ID);

    // Obtiene el total de depósitos en la Tesorería después de definir los ganadores
    const totalDeposits = await tesoreria.totalDeposits();

    // Imprime el total de depósitos para depuración o verificación
    console.log(`totalDeposits: ${totalDeposits}`);

    // Verifica que el total de depósitos sea mayor que 0, asumiendo que hay al menos un perdedor
    expect(totalDeposits).to.be.gt(0);
  });

  // Prueba para verificar que los ganadores pueden retirar sus ganancias
  it("should allow winners to withdraw their winnings", async function () {
    // Obtiene los firmantes (owner y usuarios) para interactuar con los contratos
    [owner, ...users] = await ethers.getSigners();

    // Establece el número ganador y define los ganadores en el contrato de la ruleta
    await ruleta.setWinnerNumber(GAME_ID);
    await ruleta.defineWinners(GAME_ID);

    // Obtiene el número ganador del contrato de la ruleta
    const winningNumber = (await ruleta.games(GAME_ID)).winnerNumber;

    // Inicializa un array para almacenar las apuestas ganadoras
    let winningBets = [];

    // Bucle para revisar todas las apuestas hechas por los usuarios
    for (let i = 0; i < TOTAL_BETS; i++) {
      // Obtiene la apuesta de un usuario basándose en el ID del juego y el índice de la apuesta
      const bet = await ruleta.connect(users[i]).gameToBetMap(GAME_ID, i);

      // Verifica si el número de la apuesta coincide con el número ganador
      if (bet.number === winningNumber) {
        // Agrega la apuesta ganadora al array de apuestas ganadoras
        winningBets.push(bet);

        // Obtiene los saldos en USDT y tokens de Ruleta de la Tesorería y del jugador antes del retiro
        const prev_usdt_tesoreriaBalance = await usdtTokenMock.balanceOf(
          tesoreria.address
        );
        const prev_usdt_Balance = await usdtTokenMock.balanceOf(bet.player);
        const prev_ruleta_tesoreriaBalance = await ruletaToken.balanceOf(
          tesoreria.address
        );
        const previous_ruleta_Balance = await ruletaToken.balanceOf(bet.player);

        // Realiza el retiro para el jugador ganador
        await ruleta.connect(users[i]).withdraw(GAME_ID, bet.id);

        // Obtiene los nuevos saldos en USDT y tokens de Ruleta de la Tesorería y del jugador después del retiro
        const new_usdt_Balance = await usdtTokenMock.balanceOf(bet.player);
        const post_usdt_tesoreriaBalance = await usdtTokenMock.balanceOf(
          tesoreria.address
        );
        const new_ruleta_Balance = await ruletaToken.balanceOf(bet.player);
        const post_ruleta_tesoreriaBalance = await ruletaToken.balanceOf(
          tesoreria.address
        );

        // Obtiene la lista de ganadores del juego
        const winners = await ruleta.getGameWinners(GAME_ID);

        console.log(`Total bets: ${TOTAL_BETS}`);
        // Imprime la cantidad de ganadores y sus direcciones
        console.log(`Cantidad de Ganadores: ${winners.length}`);
        console.log("Direcciones de los Ganadores:", winners);
        // Imprime los saldos antes y después del retiro para verificación
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
    // Comentario para la posible impresión de las apuestas ganadoras
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
