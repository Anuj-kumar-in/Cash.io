import { ethers } from "hardhat";
import * as fs from "fs";

interface BridgeDeployments {
    network: string;
    chainId: number;
    ethBridge?: string;
    solanaBridge?: string;
    rootstockBridge?: string;
    deployedAt: string;
}

async function main() {
    const network = process.env.HARDHAT_NETWORK;
    console.log(`🚀 Deploying bridge contracts to ${network}...\n`);

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

    const chainId = await deployer.provider.getNetwork().then(n => Number(n.chainId));
    console.log("Chain ID:", chainId);

    // Hub chain IDs
    const HUB_MAINNET_CHAIN_ID = 4102;
    const HUB_TESTNET_CHAIN_ID = 41021;
    
    // Determine which hub to use based on network
    const isTestnet = ['sepolia', 'rskTestnet', 'arbitrumSepolia', 'optimismSepolia', 'baseSepolia', 'polygonAmoy'].includes(network || '');
    const hubChainId = isTestnet ? HUB_TESTNET_CHAIN_ID : HUB_MAINNET_CHAIN_ID;
    
    console.log(`Using hub chain ID: ${hubChainId} (${isTestnet ? 'testnet' : 'mainnet'})\n`);

    const deployments: BridgeDeployments = {
        network: network || 'unknown',
        chainId,
        deployedAt: new Date().toISOString()
    };

    // Deploy appropriate bridge based on network
    switch (network) {
        case 'sepolia':
        case 'arbitrumSepolia':
        case 'optimismSepolia':
        case 'baseSepolia':
        case 'polygonAmoy':
            // Deploy EthBridge for EVM chains
            console.log("📦 Deploying EthBridge...");
            const EthBridge = await ethers.getContractFactory("EthBridge");
            const ethBridge = await EthBridge.deploy(
                "0x0000000000000000000000000000000000000000", // Placeholder - will be set later 
                hubChainId
            );
            await ethBridge.waitForDeployment();
            deployments.ethBridge = await ethBridge.getAddress();
            console.log("   ✅ EthBridge:", deployments.ethBridge);

            // Deploy SolanaBridge (for Ethereum-Solana bridging)
            if (network === 'sepolia') {
                console.log("📦 Deploying SolanaBridge...");
                const SolanaBridge = await ethers.getContractFactory("SolanaBridge");
                const solanaBridge = await SolanaBridge.deploy(
                    "0x0000000000000000000000000000000000000000", // Placeholder
                    hubChainId,
                    "0x0000000000000000000000000000000000000000000000000000000000000000" // Solana program ID
                );
                await solanaBridge.waitForDeployment();
                deployments.solanaBridge = await solanaBridge.getAddress();
                console.log("   ✅ SolanaBridge:", deployments.solanaBridge);
            }
            break;

        case 'rskTestnet':
            // Deploy RootstockBridge for RSK
            console.log("📦 Deploying RootstockBridge...");
            const RootstockBridge = await ethers.getContractFactory("RootstockBridge");
            const rootstockBridge = await RootstockBridge.deploy(
                "0x0000000000000000000000000000000000000000", // Placeholder
                hubChainId
            );
            await rootstockBridge.waitForDeployment();
            deployments.rootstockBridge = await rootstockBridge.getAddress();
            console.log("   ✅ RootstockBridge:", deployments.rootstockBridge);
            break;

        default:
            console.log("❌ Unknown network, no bridges deployed");
            return;
    }

    // Save deployments
    const deploymentsDir = './deployments';
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }

    const filename = `${deploymentsDir}/${network}-bridges.json`;
    fs.writeFileSync(filename, JSON.stringify(deployments, null, 2));
    
    console.log(`\n📄 Deployments saved to ${filename}`);
    console.log("\n🎉 Bridge deployment completed!");
    console.log("\n💡 Next steps:");
    console.log("1. Update .env with new bridge addresses");
    console.log("2. Set up relayers using setup-relayers.js");
    console.log("3. Configure bridge parameters if needed");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });