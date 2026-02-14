# Cash.io Non-EVM Bridge Contracts

Smart contracts for bridging to Cash.io from non-EVM chains: **Solana**, **Sui**, and **NEAR Protocol**.

## 📁 Structure

```
non-evm-contracts/
├── solana/           # Solana Anchor program
├── sui/              # Sui Move contract
├── near/             # NEAR Rust contract
├── deployments/      # Deployment artifacts
├── deploy.sh         # Deployment script
└── package.json      # Workspace config
```

## 🚀 Quick Start

### Prerequisites

Install the required toolchains:

```bash
# Rust (required for all)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Solana CLI + Anchor
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked

# Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet-v1.24.0 sui

# NEAR CLI
npm install -g near-cli-rs
```

### Build All Contracts

```bash
# Build all
npm run build:all

# Or individually
npm run build:solana
npm run build:sui
npm run build:near
```

### Deploy to Testnets

```bash
# Interactive deployment
./deploy.sh

# Or direct commands
npm run deploy:solana:devnet
npm run deploy:sui:testnet
npm run deploy:near:testnet

# Deploy all to testnets
npm run deploy:all:testnet
```

## 📝 Contracts

### Solana Bridge (Anchor)

```rust
// Programs
- initialize(hub_chain_id, guardian_threshold)
- add_guardian(guardian_pubkey)
- remove_guardian()
- deposit_sol(amount, commitment)
- deposit_token(amount, commitment)
- process_withdrawal(withdrawal_hash, amount, signatures)
- pause() / unpause()
```

**Features:**
- SOL and SPL token deposits
- Poseidon commitment tracking
- Guardian-based withdrawal verification
- Emergency pause capability

### Sui Bridge (Move)

```move
// Entry functions
- add_guardian(guardian_address)
- remove_guardian(guardian_address)
- deposit(payment, commitment)
- process_withdrawal(withdrawal_hash, recipient, amount)
- pause() / unpause()
```

**Features:**
- Native SUI deposits
- Object-based state management
- Event emission for relayers
- Receipt NFTs for deposits/withdrawals

### NEAR Bridge (Rust)

```rust
// Contract methods
- add_guardian(guardian_id)
- remove_guardian(guardian_id)
- deposit(commitment) // payable
- process_withdrawal(withdrawal_hash, recipient, amount)
- pause() / unpause()
```

**Features:**
- NEAR token deposits
- JSON event logs for indexing
- Cross-contract call support
- Storage management

## 🔐 Security Features

All contracts implement:

1. **Guardian System**: Multi-sig verification for withdrawals
2. **Replay Protection**: Commitment/nullifier tracking
3. **Pause Mechanism**: Emergency stop capability
4. **Amount Limits**: Min/max deposit bounds
5. **Owner Controls**: Administrative functions

## 🌐 Hub Chain Integration

These contracts bridge to the Cash.io hub chain (Avalanche Subnet) by:

1. **Deposits**: User deposits with a Poseidon commitment → Relayer observes → Relayer submits to hub → Shielded note created
2. **Withdrawals**: User creates ZK proof on hub → Relayer verifies → Relayer calls bridge → Funds released

## 🔧 Configuration

### Environment Variables

```bash
# Solana
SOLANA_PRIVATE_KEY=<base58-encoded-key>
ANCHOR_WALLET=~/.config/solana/id.json

# Sui
SUI_PRIVATE_KEY=<base64-encoded-key>

# NEAR
NEAR_ACCOUNT_ID=cashio.testnet
NEAR_PRIVATE_KEY=<private-key>
```

### Network Configuration

| Chain  | Testnet                  | Mainnet                 |
|--------|--------------------------|-------------------------|
| Solana | devnet                   | mainnet-beta            |
| Sui    | testnet                  | mainnet                 |
| NEAR   | testnet                  | mainnet                 |

## 📊 Deployments

After deployment, artifacts are saved to `deployments/`:

```json
// deployments/solana-devnet.json
{
  "programId": "CAShio...",
  "network": "devnet",
  "timestamp": "2026-02-09T12:00:00Z"
}
```

## 🧪 Testing

```bash
# Run all tests
npm run test:all

# Individual
npm run test:solana   # Anchor tests
npm run test:sui      # Move tests
npm run test:near     # Cargo tests
```

## 📚 Related Docs

- [Main Architecture](../../docs/architecture.md)
- [Bridge Design](../../docs/architecture.md#cross-chain-bridges)
- [Agent System](../../docs/architecture.md#agent-system)

## 🤖 Agent Integration

The deployed contracts work with the Cash.io agent system:

```typescript
// agents can monitor deposits
const deposits = await solanaBridge.getDeposits();

// agents can process withdrawals
await nearBridge.processWithdrawal(hash, recipient, amount);
```

## License

MIT
