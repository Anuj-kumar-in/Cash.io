import { ethers } from "hardhat";
import * as fs from "fs";

interface HubDeployedAddresses {
    transactionRegistry: string;
    rollupDataAvailability: string;
}

async function main() {
    console.log("🚀 Deploying Cash.io Hub contracts...\n");

    const signers = await ethers.getSigners();
    if (signers.length === 0) {
        throw new Error("No signers found. Please check private key configuration.");
    }
    const deployer = signers[0];
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "CIO\n");

    // 1. Deploy TransactionRegistry
    console.log("📦 Deploying TransactionRegistry...");
    const TransactionRegistry = await ethers.getContractFactory("TransactionRegistry");
    const transactionRegistry = await TransactionRegistry.deploy();
    await transactionRegistry.waitForDeployment();
    const transactionRegistryAddress = await transactionRegistry.getAddress();
    console.log("   ✅ TransactionRegistry:", transactionRegistryAddress);

    // 2. Deploy RollupDataAvailability
    console.log("📦 Deploying RollupDataAvailability...");
    const RollupDataAvailability = await ethers.getContractFactory("RollupDataAvailability");
    const rollupDA = await RollupDataAvailability.deploy();
    await rollupDA.waitForDeployment();
    const rollupDAAddress = await rollupDA.getAddress();
    console.log("   ✅ RollupDataAvailability:", rollupDAAddress);

    // 3. Configure contracts
    console.log("\n⚙️ Configuring hub contracts...");
    
    // Authorize deployer as submitter (already done in constructor, but for clarity)
    console.log("   ✅ Hub contracts configured");

    // 4. Save addresses
    const addresses: HubDeployedAddresses = {
        transactionRegistry: transactionRegistryAddress,
        rollupDataAvailability: rollupDAAddress,
    };

    const networkName = (await deployer.provider.getNetwork()).name || "cashiosubnet";
    const addressesPath = `./deployments/${networkName}-hub.json`;

    // Create deployments directory if it doesn't exist
    if (!fs.existsSync("./deployments")) {
        fs.mkdirSync("./deployments");
    }

    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log(`\n📝 Hub addresses saved to ${addressesPath}`);

    // 5. Update .env file content
    const envContent = `
# Hub Contract Addresses (${networkName})
TRANSACTION_REGISTRY_ADDRESS=${transactionRegistryAddress}
ROLLUP_DATA_AVAILABILITY_ADDRESS=${rollupDAAddress}
`;

    console.log("\n📋 Add these to your .env file:");
    console.log(envContent);

    console.log("\n✨ Hub deployment complete!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("                HUB ADDRESSES");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Object.entries(addresses).forEach(([name, address]) => {
        console.log(`${name.padEnd(26)}: ${address}`);
    });
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Hub deployment failed:", error);
        process.exit(1);
    });
