require("dotenv").config();
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.28",
  paths: {
    sources: "./contracts",  // point to your contracts folder
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    mumbai: {
      url: process.env.MUMBAI_RPC_URL, // from .env
      accounts: [process.env.PRIVATE_KEY]  // from .env
    }
  }
};

