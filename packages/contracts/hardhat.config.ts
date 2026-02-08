import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    avalancheSubnet: {
      url: process.env.SUBNET_RPC_URL || "http://127.0.0.1:9650/ext/bc/cashio/rpc",
      chainId: parseInt(process.env.SUBNET_CHAIN_ID || "43114"),
      accounts: process.env.VITE_DEPLOYER_PRIVATE_KEY ? [process.env.VITE_DEPLOYER_PRIVATE_KEY] : [],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/9a06dc3f8b30448f8c0d3e9b01a24939",
      accounts: process.env.VITE_DEPLOYER_PRIVATE_KEY ? [process.env.VITE_DEPLOYER_PRIVATE_KEY] : [],
      gas: 15000000, // Stay under Sepolia's 16,777,216 cap
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
