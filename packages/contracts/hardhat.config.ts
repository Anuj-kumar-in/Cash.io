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
    cashiosubnet: {
      url: "http://127.0.0.1:9656/ext/bc/2kncNH6LugUTEWwiV87AijZhN2zd9mek77AMzMA93Ak6QTcvKN/rpc",
      chainId: 4102,
      accounts: ["56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027"],
      gas: 30000000, // 30M gas limit for subnet
    },
    cashiosepolia: {
      url: "http://127.0.0.1:9656/ext/bc/2kncNH6LugUTEWwiV87AijZhN2zd9mek77AMzMA93Ak6QTcvKN/rpc",
      chainId: 41021,
      accounts: ["56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027"],
      gas: 30000000, // 30M gas limit for subnet
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/9a06dc3f8b30448f8c0d3e9b01a24939",
      accounts: process.env.VITE_DEPLOYER_PRIVATE_KEY ? [process.env.VITE_DEPLOYER_PRIVATE_KEY] : [],
      gas: 15000000, // Stay under Sepolia's 16,777,216 cap
    },
    rskTestnet: {
      url: process.env.RSK_TESTNET_RPC_URL || "https://public-node.testnet.rsk.co",
      accounts: process.env.VITE_DEPLOYER_PRIVATE_KEY ? [process.env.VITE_DEPLOYER_PRIVATE_KEY] : [],
      chainId: 31,
      gas: 6800000,
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://arbitrum-sepolia.infura.io/v3/9a06dc3f8b30448f8c0d3e9b01a24939",
      accounts: process.env.VITE_DEPLOYER_PRIVATE_KEY ? [process.env.VITE_DEPLOYER_PRIVATE_KEY] : [],
      chainId: 421614,
    },
    optimismSepolia: {
      url: process.env.OPTIMISM_SEPOLIA_RPC_URL || "https://optimism-sepolia.infura.io/v3/9a06dc3f8b30448f8c0d3e9b01a24939",
      accounts: process.env.VITE_DEPLOYER_PRIVATE_KEY ? [process.env.VITE_DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155420,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://base-sepolia.infura.io/v3/9a06dc3f8b30448f8c0d3e9b01a24939",
      accounts: process.env.VITE_DEPLOYER_PRIVATE_KEY ? [process.env.VITE_DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
    },
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://polygon-amoy.infura.io/v3/9a06dc3f8b30448f8c0d3e9b01a24939",
      accounts: process.env.VITE_DEPLOYER_PRIVATE_KEY ? [process.env.VITE_DEPLOYER_PRIVATE_KEY] : [],
      chainId: 80002,
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
