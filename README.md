# Cash.io - Multi-Chain ZK-Privacy dApp

> [!IMPORTANT]
> **Active Integration Phase**: Cash.io is currently in its frontend integration phase. Some features, particularly those involving cross-chain bridging and real-time proof generation, may be experimental or non-functional in the current build as we synchronize our agents, relayers, and frontend components.

## 🏗️ Architecture Overview
POA
Cash.io is a cutting-edge decentralized application that provides **zero-fee**, **privacy-preserving** cross-chain transactions across Ethereum, Solana, and Bitcoin (via Rootstock) networks, all rolled up on an **Avalanche Subnet-EVM** hub chain.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CASH.IO ARCHITECTURE                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐      │
│  │  Ethereum   │   │   Solana    │   │  Rootstock  │   │   Bitcoin   │      │
│  │   Bridge    │   │   Bridge    │   │   Bridge    │   │   (via RSK) │      │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘      │
│         │                 │                 │                 │              │
│         └────────────────┬┴─────────────────┴─────────────────┘              │
│                          │                                                   │
│                    ┌─────▼─────┐                                            │
│                    │  Relayer  │  ← Cross-chain event watchers              │
│                    │  Network  │                                            │
│                    └─────┬─────┘                                            │
│                          │                                                   │
│         ┌────────────────┴────────────────┐                                 │
│         │                                 │                                 │
│  ┌──────▼──────┐                  ┌──────▼──────┐                          │
│  │    ZK       │                  │  Blob       │                          │
│  │  Prover     │                  │  Storage    │                          │
│  │  Network    │                  │  (Sharded)  │                          │
│  └──────┬──────┘                  └──────┬──────┘                          │
│         │                                 │                                 │
│         └────────────────┬────────────────┘                                 │
│                          │                                                   │
│              ┌───────────▼────────────┐                                     │
│              │   AVALANCHE SUBNET     │                                     │
│              │   (EVM-Compatible)     │                                     │
│              ├────────────────────────┤                                     │
│              │ • ZK Verifier Precompile│                                    │
│              │ • Shielded Pool Contract│                                    │
│              │ • Bridge Contracts     │                                     │
│              │ • ERC-4337 EntryPoint  │                                     │
│              │ • Paymaster (Zero-Fee) │                                     │
│              └───────────┬────────────┘                                     │
│                          │                                                   │
│              ┌───────────▼────────────┐                                     │
│              │   LANGGRAPH.JS AGENTS  │                                     │
│              ├────────────────────────┤                                     │
│              │ • Intent Parser        │                                     │
│              │ • Proof Coordinator    │                                     │
│              │ • TX Submitter         │                                     │
│              │ • Health Monitor       │                                     │
│              └────────────────────────┘                                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 🎯 Key Features

### 1. **Multi-Chain Support**
- **Ethereum** - Direct bridge with Merkle proof verification
- **Solana** - Cross-chain messaging with SPL token support
- **Bitcoin** - Via Rootstock (RSK) EVM-compatible sidechain
- **Rollup Aggregation** - All transactions rolled up on Avalanche Subnet

### 2. **Privacy (ZK Proofs)**
- **Shielded Pool Model** - Notes + Nullifiers system
- **ZK-SNARKs** - Groth16 proofs for transaction privacy
- **Commitment Tree** - Merkle tree for balance tracking
- **Batch Proving** - Validity rollup style batching

### 3. **Zero-Fee UX (Account Abstraction)**
- **ERC-4337 Integration** - Full Account Abstraction support
- **Paymaster** - Gas sponsorship for users
- **Bundler** - UserOperation batching and submission
- **Smart Accounts** - Social recovery, spending limits

### 4. **AI Agents (LangGraph.js)**
- **Intent Parser Agent** - Natural language to transaction
- **Proof Coordinator Agent** - ZK proof generation workflow
- **TX Submitter Agent** - AA bundler interaction
- **Health Monitor Agent** - Cross-chain health checks

### 5. **Blob Storage & Sharding**
- **Data Availability** - Encrypted transaction data storage
- **Content-Addressed** - IPFS/Arweave integration
- **Sharded Retrieval** - Efficient proof input serving
- **Indexing Layer** - Commitment tree reconstruction

### 6. **IPFS Storage (Decentralized)**
- **Recovery Key Backup** - Encrypted recovery keys stored on IPFS
- **Pinata Integration** - Reliable IPFS pinning service
- **Password Encryption** - AES-GCM-256 encryption for sensitive data
- **Gateway Fallback** - Multiple IPFS gateway support

## 📁 Project Structure

```
Cash.io/
├── packages/
│   ├── subnet-evm/              # Avalanche Subnet with custom precompiles
│   │   ├── precompiles/         # Go precompile implementations
│   │   │   ├── zkverifier/      # ZK proof verification precompile
│   │   │   └── cryptoops/       # Elliptic curve operations
│   │   └── genesis/             # Subnet genesis configuration
│   │
│   ├── contracts/               # Solidity smart contracts
│   │   ├── core/                # Core protocol contracts
│   │   │   ├── ShieldedPool.sol # Privacy pool (notes/nullifiers)
│   │   │   ├── CommitmentTree.sol
│   │   │   └── ZKVerifier.sol
│   │   ├── bridges/             # Cross-chain bridge contracts
│   │   │   ├── EthBridge.sol
│   │   │   ├── SolanaBridge.sol
│   │   │   └── RootstockBridge.sol
│   │   ├── aa/                  # Account Abstraction
│   │   │   ├── CashAccount.sol  # Smart account
│   │   │   ├── CashPaymaster.sol
│   │   │   └── CashAccountFactory.sol
│   │   └── rollup/              # Rollup components
│   │       ├── BatchSubmitter.sol
│   │       └── StateManager.sol
│   │
│   ├── circuits/                # ZK circuits (Circom)
│   │   ├── transfer.circom      # Private transfer circuit
│   │   ├── deposit.circom       # Shield deposit circuit
│   │   ├── withdraw.circom      # Unshield withdraw circuit
│   │   └── batch.circom         # Batch proof aggregation
│   │
│   ├── relayer/                 # Cross-chain relayer service
│   │   ├── src/
│   │   │   ├── watchers/        # Chain-specific event watchers
│   │   │   ├── provers/         # Proof generation
│   │   │   └── submitters/      # Transaction submission
│   │   └── package.json
│   │
│   ├── agents/                  # LangGraph.js AI agents
│   │   ├── src/
│   │   │   ├── graphs/          # Agent workflow graphs
│   │   │   ├── nodes/           # Agent action nodes
│   │   │   ├── tools/           # Agent tools
│   │   │   └── state/           # Shared agent state
│   │   └── package.json
│   │
│   ├── blob-storage/            # Blob storage service
│   │   ├── src/
│   │   │   ├── storage/         # Storage backends
│   │   │   ├── sharding/        # Data sharding logic
│   │   │   └── indexer/         # Commitment tree indexer
│   │   └── package.json
│   │
│   └── sdk/                     # TypeScript SDK
│       ├── src/
│       │   ├── client/          # Main SDK client
│       │   ├── aa/              # Account abstraction helpers
│       │   ├── zk/              # ZK proof generation
│       │   ├── bridges/         # Bridge interaction
│       │   └── ipfs/            # IPFS storage integration
│       └── package.json
│
├── apps/
│   └── web/                     # Web application
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   └── hooks/
│       └── package.json
│
├── docker/                      # Docker configurations
├── scripts/                     # Deployment scripts
└── docs/                        # Documentation
```

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/cash-io.git
cd cash-io

# Install dependencies
npm install

# Build all packages
npm run build

# Start local development
npm run dev
```

## 🌐 IPFS Integration

The SDK provides built-in IPFS support for decentralized storage of recovery keys and other data.

### Environment Variables

Add the following to your `.env` file (or `.env.local` for frontend):

```bash
# Frontend (Vite) - use VITE_ prefix
VITE_IPFS_GATEWAY_URL=https://gateway.pinata.cloud
VITE_IPFS_API_URL=https://api.pinata.cloud
VITE_IPFS_JWT=your-pinata-jwt-token

# Backend/Node.js
IPFS_GATEWAY_URL=https://gateway.pinata.cloud
IPFS_API_URL=https://api.pinata.cloud
IPFS_JWT=your-pinata-jwt-token
```

### Usage in Frontend

```typescript
import { 
  CashioClient, 
  IPFSClient, 
  ipfsClient,
  RecoveryKeyUtils 
} from '@cash-io/sdk';

// Option 1: Create IPFS client from environment variables
const ipfs = ipfsClient('VITE_');

// Option 2: Use through CashioClient
const cashio = new CashioClient({
  // ... other config
  ipfs: {
    gatewayUrl: import.meta.env.VITE_IPFS_GATEWAY_URL,
    jwt: import.meta.env.VITE_IPFS_JWT,
  },
});

// Upload recovery key (encrypted with password)
const result = await cashio.uploadRecoveryKey(
  'your-recovery-key-data',
  'user-password',
  { userId: 'user-123' } // optional metadata
);
console.log('Recovery key stored at:', result.cid);

// Retrieve and decrypt recovery key
const recoveryKey = await cashio.retrieveRecoveryKey(result.cid, 'user-password');

// Upload arbitrary JSON data
const jsonResult = await cashio.uploadJSONToIPFS({
  type: 'wallet-backup',
  data: { /* ... */ }
});
console.log('JSON stored at:', jsonResult.ipfsUri);
```

### Direct IPFS Client Usage

```typescript
import { IPFSClient, RecoveryKeyUtils } from '@cash-io/sdk';

const ipfs = new IPFSClient({
  gatewayUrl: 'https://gateway.pinata.cloud',
  jwt: 'your-pinata-jwt',
});

// Upload raw data
const result = await ipfs.upload('Hello IPFS!', { name: 'hello.txt' });

// Upload JSON
const jsonResult = await ipfs.uploadJSON({ foo: 'bar' });

// Retrieve data
const data = await ipfs.retrieve(result.cid);
console.log(data.text); // "Hello IPFS!"

// Encrypt and upload recovery key
const encryptedData = await RecoveryKeyUtils.encrypt('secret-key', 'password');
const recoveryResult = await ipfs.uploadRecoveryKey(encryptedData);

// Retrieve and decrypt
const recoveryData = await ipfs.retrieveRecoveryKey(recoveryResult.cid);
const secret = await RecoveryKeyUtils.decrypt(recoveryData, 'password');
```

## 📚 Documentation

- [Architecture Deep Dive](./docs/architecture.md)
- [Subnet Setup Guide](./docs/subnet-setup.md)
- [Smart Contract Reference](./docs/contracts.md)
- [Agent System Guide](./docs/agents.md)
- [SDK Documentation](./docs/sdk.md)

## 🔐 Security

This project is in active development. Do not use in production without thorough security audits.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.
