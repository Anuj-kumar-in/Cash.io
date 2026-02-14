const { ethers } = require("hardhat");

async function main() {
    const deployments = require("../deployments/sepolia.json");
    
    console.log("🔍 Checking relayer status in deployed contracts...\n");
    
    // Check ETH Bridge
    const ethBridge = await ethers.getContractAt("EthBridge", deployments.ethBridge);
    console.log("📊 ETH Bridge:", deployments.ethBridge);
    
    // Check some common addresses that might be relayers
    const testAddresses = [
        "0x742dF7CcE59A86B17F0AfDDE9eA5d875cc96aB70", // Common test address
        await ethers.provider.getSigner().getAddress(), // Deployer
    ];
    
    for (const addr of testAddresses) {
        try {
            const isRelayer = await ethBridge.relayers(addr);
            console.log(`  ${addr}: ${isRelayer ? "✅ IS RELAYER" : "❌ Not relayer"}`);
        } catch (error) {
            console.log(`  ${addr}: Error checking - ${error.message}`);
        }
    }
    
    console.log("\n📊 Solana Bridge:", deployments.solanaBridge);
    const solanaBridge = await ethers.getContractAt("SolanaBridge", deployments.solanaBridge);
    
    for (const addr of testAddresses) {
        try {
            const isRelayer = await solanaBridge.relayers(addr);
            console.log(`  ${addr}: ${isRelayer ? "✅ IS RELAYER" : "❌ Not relayer"}`);
        } catch (error) {
            console.log(`  ${addr}: Error checking - ${error.message}`);
        }
    }
    
    console.log("\n📊 Rootstock Bridge:", deployments.rootstockBridge);
    const rskBridge = await ethers.getContractAt("RootstockBridge", deployments.rootstockBridge);
    
    for (const addr of testAddresses) {
        try {
            const isRelayer = await rskBridge.relayers(addr);
            console.log(`  ${addr}: ${isRelayer ? "✅ IS RELAYER" : "❌ Not relayer"}`);
        } catch (error) {
            console.log(`  ${addr}: Error checking - ${error.message}`);
        }
    }
    
    console.log("\n💡 To add relayers, use:");
    console.log("npx hardhat run scripts/setup-relayers.js --network sepolia");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });