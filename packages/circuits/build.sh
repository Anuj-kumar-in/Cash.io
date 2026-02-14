#!/bin/bash
# ===========================================
# Cash.io ZK Circuit Build Script
# ===========================================
# This script compiles the circom circuits and generates
# the proving/verification keys needed for ZK proofs.

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "         Cash.io ZK Circuit Builder"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for required tools
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        echo "   For circom: https://docs.circom.io/getting-started/installation/"
        echo "   For snarkjs: npm install -g snarkjs"
        exit 1
    fi
}

echo "🔍 Checking for required tools..."
check_tool circom
check_tool snarkjs
echo "✅ All tools found"
echo ""

# Create build directories
echo "📁 Creating build directories..."
mkdir -p build/transfer
mkdir -p build/deposit
mkdir -p build/withdraw
mkdir -p contracts

# Compile circuits
echo ""
echo "🔨 Compiling circuits..."

echo "  → Compiling transfer.circom..."
circom transfer.circom --r1cs --wasm --sym -o build/transfer || {
    echo "❌ Failed to compile transfer.circom"
    exit 1
}

echo "  → Compiling deposit.circom..."
circom deposit.circom --r1cs --wasm --sym -o build/deposit || {
    echo "❌ Failed to compile deposit.circom"
    exit 1
}

echo "  → Compiling withdraw.circom..."
circom withdraw.circom --r1cs --wasm --sym -o build/withdraw || {
    echo "❌ Failed to compile withdraw.circom"
    exit 1
}
echo "✅ All circuits compiled"

# Generate Powers of Tau
echo ""
echo "🔐 Generating Powers of Tau (this may take a while)..."
if [ ! -f "build/pot16_final.ptau" ]; then
    snarkjs powersoftau new bn128 16 build/pot16_0000.ptau -v
    snarkjs powersoftau prepare phase2 build/pot16_0000.ptau build/pot16_final.ptau -v
    echo "✅ Powers of Tau generated"
else
    echo "✅ Powers of Tau already exists, skipping..."
fi

# Setup proving keys
echo ""
echo "🔑 Setting up proving keys..."

setup_circuit() {
    local name=$1
    echo "  → Setting up $name..."
    
    # Groth16 setup
    snarkjs groth16 setup build/$name/$name.r1cs build/pot16_final.ptau build/$name/${name}_0000.zkey
    
    # Contribute to ceremony (deterministic for reproducibility)
    snarkjs zkey contribute build/$name/${name}_0000.zkey build/$name/${name}_final.zkey --name="Cash.io" -v -e="cash.io random entropy"
    
    # Export verification key
    snarkjs zkey export verificationkey build/$name/${name}_final.zkey build/$name/${name}_vkey.json
    
    echo "  ✅ $name setup complete"
}

setup_circuit "transfer"
setup_circuit "deposit"
setup_circuit "withdraw"

# Export Solidity verifiers
echo ""
echo "📄 Exporting Solidity verifiers..."

snarkjs zkey export solidityverifier build/transfer/transfer_final.zkey contracts/TransferVerifier.sol
snarkjs zkey export solidityverifier build/deposit/deposit_final.zkey contracts/DepositVerifier.sol
snarkjs zkey export solidityverifier build/withdraw/withdraw_final.zkey contracts/WithdrawVerifier.sol

echo "✅ Solidity verifiers exported"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                   BUILD COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Generated files:"
echo "   build/transfer/    - Transfer circuit artifacts"
echo "   build/deposit/     - Deposit circuit artifacts"
echo "   build/withdraw/    - Withdraw circuit artifacts"
echo "   contracts/         - Solidity verifier contracts"
echo ""
echo "🚀 You can now use the ZK proofs in your dApp!"
echo ""
