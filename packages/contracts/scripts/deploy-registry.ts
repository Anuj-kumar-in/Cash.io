import { ethers } from "hardhat";
import * as fs from "fs";

/**
 * Deploy BridgeRegistry to hub chain and register all bridges
 */

interface RegisteredBridge {
    chainId: number;
    bridgeAddress: string;
    chainName: string;
    symbol: string;
    category: string;
}

async function main() {
    const network = process.env.HARDHAT_NETWORK;
    console.log(`\n🚀 Deploying BridgeRegistry to ${network}...\n`);

    const [deployer] = await ethers.getSigners();
    console.log("🔑 Deployer:", deployer.address);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

    // Deploy BridgeRegistry
    console.log("📦 Deploying BridgeRegistry...");
    const BridgeRegistry = await ethers.getContractFactory("BridgeRegistry");
    const registry = await BridgeRegistry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`   ✅ BridgeRegistry: ${registryAddress}\n`);

    // Authorize deployer as relayer
    console.log("🔧 Authorizing deployer as relayer...");
    await (await registry.authorizeRelayer(deployer.address)).wait();
    console.log(`   ✅ Relayer authorized: ${deployer.address}\n`);

    // Register bridges from all deployment files
    const deploymentsDir = './deployments';
    const bridgeFiles = fs.readdirSync(deploymentsDir).filter(f => f.endsWith('-bridges.json'));
    
    const registeredBridges: RegisteredBridge[] = [];

    console.log("📝 Registering bridges from deployment files...\n");
    
    for (const file of bridgeFiles) {
        try {
            const data = JSON.parse(fs.readFileSync(`${deploymentsDir}/${file}`, 'utf8'));
            
            // Register EthBridge
            if (data.contracts?.ethBridge) {
                console.log(`   Registering ${data.network} EthBridge...`);
                await (await registry.registerBridge(
                    data.chainId,
                    data.contracts.ethBridge,
                    data.network,
                    data.symbol || 'ETH',
                    'evm'
                )).wait();
                console.log(`   ✅ Registered: Chain ${data.chainId} -> ${data.contracts.ethBridge}`);
                registeredBridges.push({
                    chainId: data.chainId,
                    bridgeAddress: data.contracts.ethBridge,
                    chainName: data.network,
                    symbol: data.symbol || 'ETH',
                    category: 'evm'
                });
            }
            
            // Register RootstockBridge
            if (data.contracts?.rootstockBridge) {
                console.log(`   Registering ${data.network} RootstockBridge...`);
                await (await registry.registerBridge(
                    data.chainId,
                    data.contracts.rootstockBridge,
                    data.network,
                    data.symbol || 'RBTC',
                    'bitcoin'
                )).wait();
                console.log(`   ✅ Registered: Chain ${data.chainId} -> ${data.contracts.rootstockBridge}`);
                registeredBridges.push({
                    chainId: data.chainId,
                    bridgeAddress: data.contracts.rootstockBridge,
                    chainName: data.network,
                    symbol: data.symbol || 'RBTC',
                    category: 'bitcoin'
                });
            }
            
            // Register SolanaBridge (Solana uses string chain IDs, register as special case)
            if (data.contracts?.solanaBridge) {
                // Use a numeric placeholder for Solana (990001 = Solana Devnet on Sepolia)
                const solanaChainId = data.chainId === 11155111 ? 990001 : 990000;
                console.log(`   Registering SolanaBridge (via ${data.network})...`);
                await (await registry.registerBridge(
                    solanaChainId,
                    data.contracts.solanaBridge,
                    'Solana Devnet',
                    'SOL',
                    'solana'
                )).wait();
                console.log(`   ✅ Registered: Solana -> ${data.contracts.solanaBridge}`);
                registeredBridges.push({
                    chainId: solanaChainId,
                    bridgeAddress: data.contracts.solanaBridge,
                    chainName: 'Solana Devnet',
                    symbol: 'SOL',
                    category: 'solana'
                });
            }
        } catch (error: any) {
            console.log(`   ⚠️ Skipping ${file}: ${error.message}`);
        }
    }

    // Save registry deployment
    const registryDeployment = {
        network,
        registryAddress,
        deployer: deployer.address,
        registeredBridges,
        deployedAt: new Date().toISOString()
    };

    const filename = `${deploymentsDir}/${network}-registry.json`;
    fs.writeFileSync(filename, JSON.stringify(registryDeployment, null, 2));

    console.log(`\n📄 Registry deployment saved to ${filename}`);
    console.log(`\n🎉 BridgeRegistry Setup Complete!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Registry: ${registryAddress}`);
    console.log(`Bridges Registered: ${registeredBridges.length}`);
    console.log(`Relayer: ${deployer.address}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });