# Cash.io Architecture Deep Dive

## System Overview

Cash.io is a privacy-preserving, zero-fee, multi-chain DeFi protocol built on an Avalanche Subnet. This document provides comprehensive technical details about the architecture.

## Table of Contents

1. [Hub Chain Architecture](#hub-chain-architecture)
2. [Shielded Pool Design](#shielded-pool-design)
3. [Cross-Chain Bridges](#cross-chain-bridges)
4. [Account Abstraction](#account-abstraction)
5. [Agent System](#agent-system)
6. [Data Availability](#data-availability)

---

## Hub Chain Architecture

### Avalanche Subnet-EVM

The Cash.io hub chain is an EVM-compatible Avalanche Subnet with custom precompiles:

```
┌─────────────────────────────────────────────────────────────┐
│                    AVALANCHE SUBNET                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Consensus: Snowman (Linear Chain)                         │
│  Block Time: ~2 seconds                                     │
│  Finality: ~1 second (subnet) / ~3 seconds (C-Chain)       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Custom Precompiles                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ • ZK Verifier (Groth16)        - 50,000 gas         │   │
│  │ • Poseidon Hash                - 1,000 gas          │   │
│  │ • BLS12-381 Operations         - 10,000 gas         │   │
│  │ • Warp Messaging               - Native             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Why Subnet-EVM?

1. **EVM Compatibility**: Use existing Solidity tooling and contracts
2. **Customizable**: Add precompiles for ZK operations
3. **Sovereign**: Own validators, own rules
4. **Interoperable**: Avalanche Warp Messaging for C-Chain bridge
5. **Scalable**: Isolated execution from mainnet congestion

---

## Shielded Pool Design

### Notes and Nullifiers Model

Inspired by Zcash and Tornado Cash, the shielded pool uses a UTXO-like model:

```
┌─────────────────────────────────────────────────────────────┐
│                     SHIELDED POOL                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Note = (amount, secret)                                    │
│  Commitment = Poseidon(amount, secret)                      │
│  Nullifier = Poseidon(commitment, leafIndex, secret)        │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Commitment Tree │    │ Nullifier Set   │                │
│  │ (Merkle Tree)   │    │ (Mapping)       │                │
│  │                 │    │                 │                │
│  │     Root        │    │ nullifier1 ✓   │                │
│  │    /    \       │    │ nullifier2 ✓   │                │
│  │   ...   ...     │    │ nullifier3 ✗   │                │
│  │  C1 C2 C3 C4    │    │ ...            │                │
│  └─────────────────┘    └─────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Transaction Types

#### 1. Deposit (Shield)
```
Input:  ETH (public)
Output: Note commitment (added to tree)
Proof:  commitment = Poseidon(amount, secret)
```

#### 2. Withdrawal (Unshield)
```
Input:  ZK Proof of note ownership
Output: ETH to recipient (public)
Action: Add nullifier to spent set
Proof:  
  - Know preimage of commitment in tree
  - Nullifier correctly computed
  - No double-spend
```

#### 3. Private Transfer
```
Input:  2 notes (spent via nullifiers)
Output: 2 new notes (commitments added)
Proof:
  - Input notes exist in tree
  - Know preimages
  - Value conservation: in1 + in2 = out1 + out2
  - Nullifiers not already spent
```

### ZK Circuits

We use Groth16 proofs with Circom circuits:

```circom
template PrivateTransfer() {
    // Public inputs
    signal input root;
    signal input nullifier1, nullifier2;
    signal input newCommitment1, newCommitment2;
    
    // Private inputs
    signal input secret1, amount1, pathElements1[20], pathIndices1[20];
    signal input secret2, amount2, pathElements2[20], pathIndices2[20];
    signal input newSecret1, newAmount1;
    signal input newSecret2, newAmount2;
    
    // 1. Verify input notes exist
    // 2. Verify nullifiers are correct
    // 3. Verify value conservation
    // 4. Verify output commitments
}
```

---

## Cross-Chain Bridges

### Supported Chains

| Chain     | Type        | Bridge Method           |
|-----------|-------------|-------------------------|
| Ethereum  | EVM         | Light client + Merkle   |
| Solana    | Non-EVM     | Guardian network        |
| Rootstock | EVM (BTC)   | Merge-mining proofs     |

### Bridge Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Ethereum   │    │   Solana     │    │  Rootstock   │
│              │    │              │    │   (Bitcoin)  │
│ EthBridge.sol│    │ SolBridge   │    │ RskBridge.sol│
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       │    Deposit/       │    Deposit/       │    Deposit/
       │    Withdraw       │    Withdraw       │    Withdraw
       │                   │                   │
       └───────────────────┼───────────────────┘
                          │
                    ┌─────▼─────┐
                    │  Relayer  │
                    │  Network  │
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │   Hub     │
                    │  Subnet   │
                    │           │
                    │ ShieldedPool
                    └───────────┘
```

### Bridge Flow (Deposit)

1. User deposits to bridge contract on source chain
2. Relayer observes deposit event
3. Relayer generates inclusion proof
4. Relayer submits proof to hub chain
5. Hub chain verifies proof, mints shielded note

### Bridge Flow (Withdrawal)

1. User creates withdrawal request on hub (ZK proof)
2. Relayer observes withdrawal event
3. Relayer submits withdrawal to destination bridge
4. Bridge releases funds to recipient

---

## Account Abstraction

### ERC-4337 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ACCOUNT ABSTRACTION                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User                                                       │
│    │                                                        │
│    ▼                                                        │
│  CashAccount (Smart Wallet)                                 │
│    │ • Social recovery                                      │
│    │ • Session keys                                         │
│    │ • Spending limits                                      │
│    │ • Batched transactions                                 │
│    │                                                        │
│    ▼                                                        │
│  Bundler                                                    │
│    │ • Collects UserOperations                             │
│    │ • Submits bundles to EntryPoint                       │
│    │                                                        │
│    ▼                                                        │
│  EntryPoint (0x5FF1...)                                     │
│    │ • Validates UserOps                                    │
│    │ • Executes transactions                                │
│    │                                                        │
│    ▼                                                        │
│  CashPaymaster                                              │
│    • Sponsors gas fees                                      │
│    • Method whitelisting                                    │
│    • Daily limits per user                                  │
│    • Policy enforcement                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Zero-Fee Flow

1. User creates UserOperation (no gas required)
2. Bundler receives UserOp
3. Bundler forwards to Paymaster for sponsorship check
4. Paymaster approves if:
   - Method is whitelisted (deposit, transfer, withdraw)
   - User under daily limit
   - No suspicious activity
5. Bundler submits to EntryPoint
6. EntryPoint executes, Paymaster pays gas

### Paymaster Policy

```solidity
// Whitelisted methods
deposit(bytes32)           ✓ Sponsored
withdraw(...)              ✓ Sponsored
privateTransfer(...)       ✓ Sponsored
other methods              ✗ Not sponsored

// Daily limits
Default: 1 ETH gas equivalent per user per day
VIP: 10 ETH gas equivalent per user per day

// Large withdrawal protection
> 10 ETH: Requires HITL approval
```

---

## Agent System

### LangGraph.js Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT WORKFLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Intent                                                │
│      │                                                      │
│      ▼                                                      │
│  ┌─────────────────┐                                       │
│  │  Intent Parser  │  Parse natural language               │
│  └────────┬────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │ Proof Generator │  Create ZK proof                      │
│  └────────┬────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │  TX Submitter   │  Submit via AA bundler                │
│  └────────┬────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │    Monitor      │  Track confirmation                   │
│  └─────────────────┘                                       │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  Background Agents:                                         │
│  • Chain Watchers (ETH, Solana, RSK)                       │
│  • Health Monitor                                           │
│  • Fraud Detector                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent State

```typescript
interface AgentState {
  userInput: string;
  intent: TransactionIntent | null;
  proofStatus: ProofStatus | null;
  transactionStatus: TransactionStatus | null;
  chainHealth: Record<string, ChainHealth>;
  pendingApprovals: ApprovalRequest[];
  errors: string[];
  currentStep: string;
}
```

### Workflow Graph

```
        START
          │
          ▼
    ┌───────────┐
    │  Health   │◄──────────────┐
    │   Check   │               │
    └─────┬─────┘               │
          │                     │
    ┌─────▼─────┐               │
    │   Parse   │               │
    │  Intent   │               │
    └─────┬─────┘               │
          │                     │
    ┌─────▼─────┐     ┌────────┴────────┐
    │ Generate  │     │    Handle       │
    │   Proof   │────►│    Error        │
    └─────┬─────┘     └─────────────────┘
          │                     ▲
    ┌─────▼─────┐               │
    │  Submit   │───────────────┘
    │    TX     │
    └─────┬─────┘
          │
    ┌─────▼─────┐
    │  Monitor  │
    │    TX     │
    └─────┬─────┘
          │
          ▼
         END
```

---

## Data Availability

### Blob Storage System

```
┌─────────────────────────────────────────────────────────────┐
│                    BLOB STORAGE                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  On-Chain (Subnet)              Off-Chain (Blob Storage)    │
│  ────────────────────           ────────────────────────    │
│  • Commitment roots             • Encrypted transactions    │
│  • Nullifier set                • Merkle tree data          │
│  • Proof verification           • Proving artifacts         │
│  • State transitions            • Historical states         │
│                                                             │
│  ┌────────────────┐            ┌────────────────────────┐  │
│  │   Hub Chain    │───CID────►│     Blob Storage       │  │
│  │                │            │                        │  │
│  │ commitment =   │            │ ┌──────────────────┐  │  │
│  │ hash(blob_cid) │            │ │ Shard 1 (IPFS)   │  │  │
│  └────────────────┘            │ ├──────────────────┤  │  │
│                                │ │ Shard 2 (IPFS)   │  │  │
│                                │ ├──────────────────┤  │  │
│                                │ │ Shard 3 (IPFS)   │  │  │
│                                │ └──────────────────┘  │  │
│                                └────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Sharding Strategy

Data is sharded by:
- **Rollup ID**: Separate data per rollup batch
- **Epoch**: Time-based partitioning
- **Commitment Prefix**: First 8 chars of CID for distribution

### Indexing Layer

The commitment tree indexer:
1. Syncs on-chain deposit events
2. Reconstructs Merkle tree
3. Serves proof input packages to clients/provers
4. Caches recent proofs for fast retrieval

---

## Security Model

### Trust Assumptions

| Component     | Trust Model                          |
|---------------|--------------------------------------|
| Hub Chain     | Subnet validators (decentralized)    |
| ZK Proofs     | Cryptographic (no trust needed)      |
| Bridges ETH   | Light client + finality             |
| Bridges Sol   | Guardian threshold (2/3)            |
| Bridges RSK   | Merge-mining security               |
| Paymaster     | Operator (can be decentralized)     |
| Blob Storage  | Content-addressed (verifiable)      |

### Attack Vectors & Mitigations

1. **Double Spend**: Nullifier checking on-chain
2. **Front-Running**: Recipient in ZK proof
3. **Relay Censorship**: Multiple relayer operators
4. **Paymaster Drain**: Rate limiting, whitelisting
5. **Bridge Fraud**: Finality requirements, slashing

---

## Performance Characteristics

| Metric                  | Value                    |
|-------------------------|--------------------------|
| Deposit latency         | ~3 seconds              |
| Transfer latency        | ~5 seconds (incl. proof)|
| Proof generation        | 10-30 seconds           |
| Bridge finality (ETH)   | 12 blocks (~3 min)      |
| Bridge finality (Sol)   | 32 slots (~13 sec)      |
| Bridge finality (RSK)   | 100 blocks (~8 min)     |
| Max TPS (hub)           | ~500 tx/s               |
| Commitment tree depth   | 20 (1M notes)           |

---

## Future Improvements

1. **Recursive Proofs**: Reduce proof size and verification cost
2. **Decentralized Provers**: Network of proving nodes
3. **Additional Chains**: Polygon, Arbitrum, Optimism
4. **Hardware Acceleration**: GPU/FPGA proving
5. **Mobile SDK**: React Native / Flutter support
