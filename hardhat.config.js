require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */

module.exports = {
  networks: {
    hardhat: {
      accounts: {
        // Crear 180 cuentas
        count: 180,
        // Puedes configurar más campos como initialIndex, path, etc.
      },
    },
  },
  solidity: "0.8.17",
  // otras configuraciones
};
