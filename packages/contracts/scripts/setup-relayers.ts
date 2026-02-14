import { ethers } from "hardhat";

async function main() {
    const network = process.env.HARDHAT_NETWORK;
    console.log(`🔧 Setting up relayers for ${network}...\n`);

    const [deployer] = await ethers.getSigners();
    console.log("Setting up with account:", deployer.address);

    // Default relayer addresses (you can customize these)
    const relayerAddresses = [
        deployer.address, // Use deployer as primary relayer for testing
        "0x742dF7CcE59A86B17F0AfDDE9eA5d875cc96aB70", // Example backup relayer
    ];

    try {
        // Load deployment addresses
        const deployments = require(`../deployments/${network}-bridges.json`);
        
        // Set up relayers for each deployed bridge
        if (deployments.ethBridge) {
            console.log("🌉 Setting up EthBridge relayers...");
            const ethBridge = await ethers.getContractAt("EthBridge", deployments.ethBridge);
            
            for (const relayer of relayerAddresses) {
                try {
                    const tx = await ethBridge.setRelayer(relayer, true);
                    await tx.wait();
                    console.log(`   ✅ Added relayer: ${relayer}`);
                } catch (error: any) {
                    console.log(`   ❌ Failed to add relayer ${relayer}: ${error.message}`);
                }
            }
        }

        if (deployments.solanaBridge) {
            console.log("🌉 Setting up SolanaBridge relayers...");
            const solanaBridge = await ethers.getContractAt("SolanaBridge", deployments.solanaBridge);
            
            for (const relayer of relayerAddresses) {
                try {
                    const tx = await solanaBridge.setRelayer(relayer, true);
                    await tx.wait();
                    console.log(`   ✅ Added relayer: ${relayer}`);
                } catch (error: any) {
                    console.log(`   ❌ Failed to add relayer ${relayer}: ${error.message}`);
                }
            }
        }

        if (deployments.rootstockBridge) {
            console.log("🌉 Setting up RootstockBridge relayers...");
            const rootstockBridge = await ethers.getContractAt("RootstockBridge", deployments.rootstockBridge);
            
            for (const relayer of relayerAddresses) {
                try {
                    const tx = await rootstockBridge.setRelayer(relayer, true);
                    await tx.wait();
                    console.log(`   ✅ Added relayer: ${relayer}`);
                } catch (error: any) {
                    console.log(`   ❌ Failed to add relayer ${relayer}: ${error.message}`);
                }
            }
        }

        console.log("\n🎉 Relayer setup completed!");
        console.log("\n💰 Remember to fund these relayer addresses:");
        for (const relayer of relayerAddresses) {
            console.log(`   ${relayer}`);
        }

    } catch (error: any) {
        console.error(`❌ Error setting up relayers: ${error.message}`);
        console.log("Make sure to run deploy-bridges.js first!");
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });