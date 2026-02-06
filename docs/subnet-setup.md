# Deploying Cash.io Subnet

This guide walks through deploying the Cash.io Avalanche Subnet with custom precompiles.

## Prerequisites

- **Go 1.21+** for building subnet-evm
- **Node.js 20+** for contract deployment
- **Avalanche CLI** for subnet management
- **Docker** (optional, for local testing)

## Step 1: Install Avalanche CLI

```bash
# macOS/Linux
curl -sSfL https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/scripts/install.sh | sh -s

# Add to PATH
export PATH=~/bin:$PATH

# Verify
avalanche --version
```

## Step 2: Build Custom Subnet-EVM

```bash
cd packages/subnet-evm

# Clone precompile-evm
git clone https://github.com/ava-labs/precompile-evm
cd precompile-evm

# Build with custom precompiles
./scripts/build.sh ../build/cashio-evm

# Verify binary
ls -la ../build/cashio-evm
```

## Step 3: Create Subnet Configuration

```bash
# Create subnet with custom binary
avalanche subnet create cashio \
  --evm \
  --custom-vm ../build/cashio-evm

# When prompted:
# - Chain ID: 43114 (or your choice)
# - Token Symbol: CASH
# - Use custom genesis: yes
# - Genesis file: genesis/genesis.json
```

## Step 4: Deploy Locally (Development)

```bash
# Start local Avalanche network
avalanche network start

# Deploy subnet
avalanche subnet deploy cashio --local

# Note the RPC URL (typically http://127.0.0.1:9650/ext/bc/cashio/rpc)
```

## Step 5: Deploy to Fuji Testnet

```bash
# Configure wallet
avalanche key create cashio-deploy
avalanche key fund --network fuji

# Deploy to Fuji
avalanche subnet deploy cashio --fuji

# Note:
# - Requires AVAX for gas
# - Subnet creation costs ~2 AVAX
# - Validator staking required
```

## Step 6: Deploy Contracts

```bash
cd ../contracts

# Install dependencies
npm install

# Configure .env
cat > .env << EOF
SUBNET_RPC_URL=http://127.0.0.1:9650/ext/bc/cashio/rpc
SUBNET_CHAIN_ID=43114
DEPLOYER_PRIVATE_KEY=your_private_key
EOF

# Compile contracts
npx hardhat compile

# Deploy
npx hardhat run scripts/deploy.ts --network avalancheSubnet
```

## Step 7: Verify Deployment

```bash
# Check subnet status
avalanche subnet status cashio

# Test RPC connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  http://127.0.0.1:9650/ext/bc/cashio/rpc

# Check precompile
cast call 0x0300000000000000000000000000000000000001 "isEnabled()" \
  --rpc-url http://127.0.0.1:9650/ext/bc/cashio/rpc
```

## Deployment Script

Create `scripts/deploy.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Cash.io contracts...");

  // 1. Deploy CommitmentTree
  const CommitmentTree = await ethers.getContractFactory("CommitmentTree");
  const commitmentTree = await CommitmentTree.deploy();
  await commitmentTree.waitForDeployment();
  console.log("CommitmentTree:", await commitmentTree.getAddress());

  // 2. Deploy ZKVerifier
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy();
  await zkVerifier.waitForDeployment();
  console.log("ZKVerifier:", await zkVerifier.getAddress());

  // 3. Deploy ShieldedPool
  const ShieldedPool = await ethers.getContractFactory("ShieldedPool");
  const shieldedPool = await ShieldedPool.deploy(
    await commitmentTree.getAddress(),
    await zkVerifier.getAddress()
  );
  await shieldedPool.waitForDeployment();
  console.log("ShieldedPool:", await shieldedPool.getAddress());

  // 4. Deploy EntryPoint (or use existing)
  const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

  // 5. Deploy AccountFactory
  const CashAccountFactory = await ethers.getContractFactory("CashAccountFactory");
  const factory = await CashAccountFactory.deploy(entryPointAddress);
  await factory.waitForDeployment();
  console.log("AccountFactory:", await factory.getAddress());

  // 6. Deploy Paymaster
  const CashPaymaster = await ethers.getContractFactory("CashPaymaster");
  const paymaster = await CashPaymaster.deploy(
    entryPointAddress,
    await shieldedPool.getAddress()
  );
  await paymaster.waitForDeployment();
  console.log("Paymaster:", await paymaster.getAddress());

  // 7. Fund Paymaster
  const [deployer] = await ethers.getSigners();
  await deployer.sendTransaction({
    to: await paymaster.getAddress(),
    value: ethers.parseEther("10"),
  });
  console.log("Paymaster funded with 10 CASH");

  // 8. Save addresses
  const addresses = {
    commitmentTree: await commitmentTree.getAddress(),
    zkVerifier: await zkVerifier.getAddress(),
    shieldedPool: await shieldedPool.getAddress(),
    entryPoint: entryPointAddress,
    accountFactory: await factory.getAddress(),
    paymaster: await paymaster.getAddress(),
  };

  console.log("\nDeployment complete!");
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch(console.error);
```

## Troubleshooting

### Subnet not starting
```bash
# Check logs
avalanche network logs cashio

# Restart network
avalanche network stop
avalanche network start
```

### Precompile not working
```bash
# Verify precompile is enabled in genesis
cat genesis/genesis.json | jq '.config.zkVerifierConfig'

# Check upgrade file
cat upgrade.json
```

### Contract deployment fails
```bash
# Check gas settings in hardhat.config.ts
# Increase gas limit if needed
```

## Next Steps

1. Deploy bridges on source chains (ETH, RSK)
2. Set up relayer network
3. Deploy blob storage service
4. Configure and start agents
5. Build and deploy web frontend
