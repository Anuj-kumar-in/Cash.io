import { ethers } from "hardhat";
import * as fs from "fs";

interface DeployedAddresses {
    commitmentTree: string;
    zkVerifier: string;
    shieldedPool: string;
    entryPoint: string;
    accountFactory: string;
    paymaster: string;
    ethBridge: string;
    solanaBridge: string;
    rootstockBridge: string;
}

async function main() {
    console.log("🚀 Deploying Cash.io contracts...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

    // 1. Deploy CommitmentTree
    console.log("📦 Deploying CommitmentTree...");
    const CommitmentTree = await ethers.getContractFactory("CommitmentTree");
    const commitmentTree = await CommitmentTree.deploy();
    await commitmentTree.waitForDeployment();
    const commitmentTreeAddress = await commitmentTree.getAddress();
    console.log("   ✅ CommitmentTree:", commitmentTreeAddress);

    // 2. Deploy ZKVerifier
    console.log("📦 Deploying ZKVerifier...");
    const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
    const zkVerifier = await ZKVerifier.deploy();
    await zkVerifier.waitForDeployment();
    const zkVerifierAddress = await zkVerifier.getAddress();
    console.log("   ✅ ZKVerifier:", zkVerifierAddress);

    // 3. Deploy ShieldedPool
    console.log("📦 Deploying ShieldedPool...");
    const ShieldedPool = await ethers.getContractFactory("ShieldedPool");
    const shieldedPool = await ShieldedPool.deploy(
        commitmentTreeAddress,
        zkVerifierAddress
    );
    await shieldedPool.waitForDeployment();
    const shieldedPoolAddress = await shieldedPool.getAddress();
    console.log("   ✅ ShieldedPool:", shieldedPoolAddress);

    // 4. EntryPoint (use existing or deploy)
    const entryPointAddress = process.env.ENTRY_POINT_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    console.log("📦 Using EntryPoint:", entryPointAddress);

    // 5. Deploy CashAccountFactory
    console.log("📦 Deploying CashAccountFactory...");
    const CashAccountFactory = await ethers.getContractFactory("CashAccountFactory");
    const accountFactory = await CashAccountFactory.deploy(entryPointAddress);
    await accountFactory.waitForDeployment();
    const accountFactoryAddress = await accountFactory.getAddress();
    console.log("   ✅ CashAccountFactory:", accountFactoryAddress);

    // 6. Deploy CashPaymaster
    console.log("📦 Deploying CashPaymaster...");
    const CashPaymaster = await ethers.getContractFactory("CashPaymaster");
    const paymaster = await CashPaymaster.deploy(
        entryPointAddress,
        shieldedPoolAddress
    );
    await paymaster.waitForDeployment();
    const paymasterAddress = await paymaster.getAddress();
    console.log("   ✅ CashPaymaster:", paymasterAddress);

    // 7. Deploy Bridges
    console.log("📦 Deploying EthBridge...");
    const EthBridge = await ethers.getContractFactory("EthBridge");
    const ethBridge = await EthBridge.deploy(shieldedPoolAddress);
    await ethBridge.waitForDeployment();
    const ethBridgeAddress = await ethBridge.getAddress();
    console.log("   ✅ EthBridge:", ethBridgeAddress);

    console.log("📦 Deploying SolanaBridge...");
    const SolanaBridge = await ethers.getContractFactory("SolanaBridge");
    const solanaBridge = await SolanaBridge.deploy(
        shieldedPoolAddress,
        2, // Guardian threshold
        [deployer.address] // Initial guardians (replace with actual guardian addresses)
    );
    await solanaBridge.waitForDeployment();
    const solanaBridgeAddress = await solanaBridge.getAddress();
    console.log("   ✅ SolanaBridge:", solanaBridgeAddress);

    console.log("📦 Deploying RootstockBridge...");
    const RootstockBridge = await ethers.getContractFactory("RootstockBridge");
    const rootstockBridge = await RootstockBridge.deploy(
        shieldedPoolAddress,
        30 // RSK chain ID
    );
    await rootstockBridge.waitForDeployment();
    const rootstockBridgeAddress = await rootstockBridge.getAddress();
    console.log("   ✅ RootstockBridge:", rootstockBridgeAddress);

    // 8. Configure contracts
    console.log("\n⚙️ Configuring contracts...");

    // Whitelist shielded pool methods in paymaster
    console.log("   Adding whitelisted methods to Paymaster...");
    await paymaster.addWhitelistedMethod(shieldedPoolAddress, "deposit(bytes32)");
    await paymaster.addWhitelistedMethod(shieldedPoolAddress, "withdraw(bytes,bytes32,bytes32,address,address,uint256)");
    await paymaster.addWhitelistedMethod(shieldedPoolAddress, "privateTransfer(bytes,bytes32,bytes32,bytes32,bytes32,bytes32)");
    console.log("   ✅ Paymaster methods whitelisted");

    // Fund paymaster
    const paymasterFunding = ethers.parseEther("1");
    console.log(`   Funding Paymaster with ${ethers.formatEther(paymasterFunding)} ETH...`);
    await deployer.sendTransaction({
        to: paymasterAddress,
        value: paymasterFunding,
    });
    console.log("   ✅ Paymaster funded");

    // 9. Save addresses
    const addresses: DeployedAddresses = {
        commitmentTree: commitmentTreeAddress,
        zkVerifier: zkVerifierAddress,
        shieldedPool: shieldedPoolAddress,
        entryPoint: entryPointAddress,
        accountFactory: accountFactoryAddress,
        paymaster: paymasterAddress,
        ethBridge: ethBridgeAddress,
        solanaBridge: solanaBridgeAddress,
        rootstockBridge: rootstockBridgeAddress,
    };

    const networkName = (await deployer.provider.getNetwork()).name || "unknown";
    const addressesPath = `./deployments/${networkName}.json`;

    // Create deployments directory if it doesn't exist
    if (!fs.existsSync("./deployments")) {
        fs.mkdirSync("./deployments");
    }

    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log(`\n📝 Addresses saved to ${addressesPath}`);

    // 10. Update .env file
    const envContent = `
# Deployed Contract Addresses (${networkName})
SHIELDED_POOL_ADDRESS=${shieldedPoolAddress}
COMMITMENT_TREE_ADDRESS=${commitmentTreeAddress}
ZK_VERIFIER_ADDRESS=${zkVerifierAddress}
ENTRY_POINT_ADDRESS=${entryPointAddress}
ACCOUNT_FACTORY_ADDRESS=${accountFactoryAddress}
PAYMASTER_ADDRESS=${paymasterAddress}
ETH_BRIDGE_ADDRESS=${ethBridgeAddress}
SOLANA_BRIDGE_ADDRESS=${solanaBridgeAddress}
ROOTSTOCK_BRIDGE_ADDRESS=${rootstockBridgeAddress}
`;

    console.log("\n📋 Add these to your .env file:");
    console.log(envContent);

    console.log("\n✨ Deployment complete!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("                DEPLOYED ADDRESSES");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Object.entries(addresses).forEach(([name, address]) => {
        console.log(`${name.padEnd(18)}: ${address}`);
    });
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
