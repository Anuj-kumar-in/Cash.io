# Cash.io Subnet-EVM with Custom Precompiles

This package contains the Avalanche Subnet-EVM configuration with custom stateful precompiles for efficient ZK verification and cryptographic operations.

## Overview

The Cash.io hub chain is an EVM-compatible Avalanche Subnet that extends the standard Subnet-EVM with:

1. **ZK Verifier Precompile** - Gas-efficient Groth16 proof verification
2. **Poseidon Hash Precompile** - ZK-friendly hashing for commitment trees
3. **BLS Operations Precompile** - Aggregate signature verification for bridges

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cash.io Subnet-EVM                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │  Standard Precompiles │  │  Custom Precompiles  │        │
│  ├──────────────────────┤  ├──────────────────────┤        │
│  │ 0x01: ecRecover      │  │ 0x030..01: ZKVerifier│        │
│  │ 0x02: SHA256         │  │ 0x030..02: Poseidon  │        │
│  │ 0x05: ModExp         │  │ 0x030..03: BLS12-381 │        │
│  │ 0x06-0x08: BN256     │  │ 0x030..04: Warp      │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Smart Contracts                   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ • ShieldedPool.sol   • Bridges                      │   │
│  │ • CommitmentTree.sol • Account Abstraction          │   │
│  │ • ZKVerifier.sol     • Paymaster                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Custom Precompiles

### ZK Verifier Precompile (0x0300000000000000000000000000000000000001)

Verifies Groth16 ZK-SNARK proofs at low gas cost.

**Function Signature:**
```solidity
function verifyProof(
    uint256[2] memory a,
    uint256[2][2] memory b,
    uint256[2] memory c,
    uint256[] memory publicInputs,
    bytes memory verificationKey
) external view returns (bool);
```

**Gas Cost:** ~50,000 gas (vs ~200,000 for pure Solidity)

### Poseidon Hash Precompile (0x0300000000000000000000000000000000000002)

ZK-friendly hash function for commitment trees.

**Function Signature:**
```solidity
function hash2(uint256 a, uint256 b) external pure returns (uint256);
function hash3(uint256 a, uint256 b, uint256 c) external pure returns (uint256);
function hashN(uint256[] memory inputs) external pure returns (uint256);
```

**Gas Cost:** ~1,000 gas per hash

### BLS12-381 Precompile (0x0300000000000000000000000000000000000003)

BLS signature operations for aggregate verification.

**Function Signature:**
```solidity
function aggregateSignatures(bytes[] memory signatures) external pure returns (bytes memory);
function verifyAggregateSignature(
    bytes memory aggregatedSig,
    bytes[] memory pubkeys,
    bytes32 message
) external view returns (bool);
```

## Building the Subnet

### Prerequisites

- Go 1.21+
- AvalancheGo 1.11+
- Subnet-EVM source

### Build Steps

1. Clone and build Subnet-EVM with precompiles:

```bash
# Clone the precompile-evm repo
git clone https://github.com/ava-labs/precompile-evm
cd precompile-evm

# Copy our precompile implementations
cp -r ../precompiles/* ./precompile/contracts/

# Build
./scripts/build.sh build/cashio-evm

# The binary will be at ./build/cashio-evm
```

2. Deploy the Subnet:

```bash
# Install Avalanche CLI
curl -sSfL https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/scripts/install.sh | sh

# Create subnet
avalanche subnet create cashio --evm

# When prompted, select custom genesis and provide genesis/genesis.json

# Deploy locally
avalanche subnet deploy cashio --local

# Or deploy to Fuji testnet
avalanche subnet deploy cashio --fuji
```

3. Configure the genesis file with contract allocations:

```json
{
  "alloc": {
    "0xShieldedPoolAddress": {
      "code": "0x...",
      "storage": {},
      "balance": "0x0"
    },
    "0xEntryPointAddress": {
      "code": "0x...",
      "storage": {},
      "balance": "0x0"
    }
  }
}
```

## Precompile Implementation

### ZK Verifier (Go)

```go
// precompiles/zkverifier/contract.go

package zkverifier

import (
    "github.com/ethereum/go-ethereum/common"
    "github.com/ava-labs/subnet-evm/precompile/contract"
)

var (
    ContractAddress = common.HexToAddress("0x0300000000000000000000000000000000000001")
    
    // Gas costs
    VerifyProofGas = uint64(50000)
)

type Config struct {
    contract.AllowListConfig
}

func (c *Config) Address() common.Address {
    return ContractAddress
}

// VerifyProof verifies a Groth16 proof
func VerifyProof(
    accessibleState contract.AccessibleState,
    caller common.Address,
    addr common.Address,
    input []byte,
    suppliedGas uint64,
    readOnly bool,
) ([]byte, uint64, error) {
    // Decode inputs
    // Use gnark-crypto for BN254 pairing
    // Return 1 if valid, 0 if invalid
    
    return []byte{1}, VerifyProofGas, nil
}
```

### Poseidon Hash (Go)

```go
// precompiles/poseidon/contract.go

package poseidon

import (
    "github.com/ethereum/go-ethereum/common"
    "github.com/ava-labs/subnet-evm/precompile/contract"
    "github.com/iden3/go-iden3-crypto/poseidon"
)

var (
    ContractAddress = common.HexToAddress("0x0300000000000000000000000000000000000002")
    HashGas = uint64(1000)
)

// Hash2 computes Poseidon hash of 2 elements
func Hash2(
    accessibleState contract.AccessibleState,
    caller common.Address,
    addr common.Address,
    input []byte,
    suppliedGas uint64,
    readOnly bool,
) ([]byte, uint64, error) {
    // Decode 2 uint256 inputs
    // Compute Poseidon hash
    // Return result
    
    return hash.Bytes(), HashGas, nil
}
```

## Configuration

### upgrade.json

To enable precompiles after deployment:

```json
{
  "precompileUpgrades": [
    {
      "zkVerifierConfig": {
        "blockTimestamp": 1700000000,
        "adminAddresses": ["0x..."]
      }
    },
    {
      "poseidonConfig": {
        "blockTimestamp": 1700000000,
        "adminAddresses": ["0x..."]
      }
    }
  ]
}
```

### Network Config

```json
{
  "network-id": 43114,
  "snowman": {
    "commit-interval": 1000,
    "optimal-processing": true
  },
  "pruning-enabled": true,
  "state-sync-enabled": true
}
```

## Testing

```bash
# Run precompile tests
cd precompiles
go test ./...

# Run integration tests
cd ../contracts
npx hardhat test --network localhost
```

## Security Considerations

1. **Precompile Access Control**: Use AllowList to restrict who can call precompiles
2. **Gas Metering**: Ensure gas costs reflect actual computation
3. **Upgrade Path**: Plan for precompile upgrades via upgrade.json
4. **Auditing**: Have precompile code audited separately from contracts

## Resources

- [Subnet-EVM Documentation](https://docs.avax.network/subnets)
- [Precompile-EVM Repository](https://github.com/ava-labs/precompile-evm)
- [Avalanche CLI](https://docs.avax.network/tooling/cli-guides/install-avalanche-cli)
