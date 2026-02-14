# Cash.io dApp - Component Status & Setup Guide

This document summarizes the fixes made and instructions for enabling all components.

## Quick Status Overview

| Component | Status | Action Required |
|-----------|--------|-----------------|
| EVM Contracts | ✅ Working | None |
| Solana Bridge | ✅ Working | None |
| Sui Bridge | ✅ Working | None |
| NEAR Bridge | 🔧 Fixed | Rebuild & redeploy |
| SDK | ✅ Working | None |
| Agents (AI) | ✅ Fixed | Install deps |
| Blob Storage | ✅ Working | None |
| Frontend | ✅ Fixed | Has .env config |
| Relayer | ✅ Fixed | Has bridge JSONs |
| ZK Circuits | 🔧 Ready | Compile circuits |
| Subnet Genesis | ✅ Fixed | Chain ID corrected |

---

## Fixes Applied

### 1. Subnet Genesis Chain ID (FIXED ✅)
**File:** `packages/subnet-evm/genesis/genesis.json`  
**Issue:** Chain ID was 43114 (Avalanche C-Chain mainnet)  
**Fix:** Changed to 4102 (Cash.io Subnet)

```json
"chainId": 4102  // Was: 43114
```

### 2. NEAR Bridge Deserialization Error (FIXED ✅)
**Files:**
- `packages/non-evm-contracts/near/Cargo.toml`
- `packages/non-evm-contracts/near/src/lib.rs`

**Issue:** near-sdk 4.1.1 had borsh serialization incompatibility causing init failures

**Fix:** Updated to near-sdk 5.6.0 with new macro syntax:
```toml
near-sdk = "5.6.0"
near-contract-standards = "5.6.0"
```

**To complete:**
```bash
cd packages/non-evm-contracts/near
cargo build --target wasm32-unknown-unknown --release
near deploy cashio-bridge-v1.testnet target/wasm32-unknown-unknown/release/cashio_bridge_near.wasm \
  --initFunction new \
  --initArgs '{"owner_id":"cashio-bridge-v1.testnet","hub_chain_id":"4102","guardian_threshold":1}'
```

### 3. Relayer Bridge Deployment Files (FIXED ✅)
**Issue:** Missing bridge deployment JSON files for testnet chains

**Created:**
- `packages/contracts/deployments/rskTestnet-bridges.json`
- `packages/contracts/deployments/arbitrumSepolia-bridges.json`
- `packages/contracts/deployments/optimismSepolia-bridges.json`
- `packages/contracts/deployments/baseSepolia-bridges.json`
- `packages/contracts/deployments/polygonAmoy-bridges.json`

**Also created:**
- `packages/relayer/.env` with RELAYER_PRIVATE_KEY

### 4. Frontend Environment (VERIFIED ✅)
**File:** `apps/web/.env`  
**Status:** Already had all required VITE_* variables configured

### 5. Agents AI Configuration (FIXED ✅)
**Files:**
- `packages/agents/package.json` - Added dotenv dependency
- `packages/agents/src/index.ts` - Added dotenv initialization
- `packages/agents/.env` - Created with OPENAI_API_KEY

### 6. ZK Circuits Build System (READY ✅)
**Files:**
- `packages/circuits/build.sh` - Created comprehensive build script
- `packages/circuits/package.json` - Added build:all script

**To compile:**
```bash
# Prerequisites: Install circom and snarkjs globally
npm install -g snarkjs
# Install circom: https://docs.circom.io/getting-started/installation/

# Build circuits
cd packages/circuits
npm install
npm run build:all
# OR: bash build.sh
```

---

## Running the dApp

### Option 1: Start All Services (Windows)
```cmd
start-all.bat
```

### Option 2: Start All Services (WSL/Linux)
```bash
chmod +x start-all.sh
./start-all.sh
```

### Option 3: Start Individual Services
```bash
# 1. Blob Storage (required first)
cd packages/blob-storage
npm run start

# 2. AI Agents
cd packages/agents
npm install
npm run dev

# 3. Relayer
cd packages/relayer
npm install
npm run start -- --chain sepolia

# 4. Frontend
cd apps/web
npm install
npm run dev
```

---

## Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Main web application |
| Blob Storage | http://localhost:3001 | Encrypted blob storage API |
| Agents | http://localhost:3002 | AI transaction agents |
| Relayer | N/A (background) | Bridge event processor |

---

## Deployed Contracts

### EVM (Sepolia)
- Shielded Pool: `0x688e2C8dF27C925bdCBa5c7DFafD939A760d0466`
- ZK Verifier: `0x176A451EaABfFB08DDe514C2dA9F56BBAd12919B`
- Commitment Tree: `0xedF026f2DA00e4b693b99AdB17bB3Cad01330b25`
- ETH Bridge: `0x639Ac649093D13bAe4A674D7aD6b377525fDB486`

### Solana (Devnet)
- Program ID: `FeRHaZXb3tbmjWWSwZXQX1HH7DSvAM7nR3mdSxN6VjpJ`

### Sui (Testnet)
- Package ID: `0xbc4b492312d1a16139c8035cf34e521ac1db96a8850f7447c2318b90cf489366`
- Bridge State: `0x746ddcfab675fcfe7ab931e7f2713d7f4817aeea9a1375746d194f4a76d3f06f`

### NEAR (Testnet)
- Contract: `cashio-bridge-v1.testnet`
- Status: Needs rebuild with near-sdk 5.6.0

### Hub Chain
- Mainnet Chain ID: 4102
- Testnet Chain ID: 41021
- Transaction Registry: `0xa4DfF80B4a1D748BF28BC4A271eD834689Ea3407`

---

## Additional Notes

1. **Private Keys**: The `.env` file contains testnet private keys. Never use these on mainnet!

2. **OPENAI_API_KEY**: Already configured in root `.env` and `packages/agents/.env`

3. **Hub Chain**: The subnet RPC URLs are local. For remote deployment, update the RPC URLs.

4. **ZK Circuits**: Compilation requires circom (Rust-based) installed globally.
