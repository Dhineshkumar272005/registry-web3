require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];
module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    amoy: { url: process.env.AMOY_RPC || "https://polygon-amoy.g.alchemy.com/v2/alch_XJaWp9zWnEBjBAaY2K6eV", chainId: 80002, accounts },
    sepolia: { url: process.env.SEPOLIA_RPC || "", chainId: 11155111, accounts },
  },
};
