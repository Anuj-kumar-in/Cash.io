#!/bin/bash
# ============================================
# Cash.io Non-EVM Bridge Deployment Script
# Supports: Solana, Sui, NEAR
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_banner() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}          ${GREEN}Cash.io Non-EVM Bridge Deployment${NC}         ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check dependencies
check_dependencies() {
    print_step "Checking dependencies..."
    
    # Check Rust
    if command -v rustc &> /dev/null; then
        RUST_VERSION=$(rustc --version)
        print_success "Rust installed: $RUST_VERSION"
    else
        print_error "Rust not installed. Visit https://rustup.rs"
        exit 1
    fi
    
    # Check Solana CLI
    if command -v solana &> /dev/null; then
        SOLANA_VERSION=$(solana --version)
        print_success "Solana CLI installed: $SOLANA_VERSION"
    else
        print_error "Solana CLI not installed"
        echo "Install with: sh -c \"\$(curl -sSfL https://release.solana.com/v1.18.0/install)\""
    fi
    
    # Check Anchor CLI
    if command -v anchor &> /dev/null; then
        ANCHOR_VERSION=$(anchor --version)
        print_success "Anchor CLI installed: $ANCHOR_VERSION"
    else
        print_error "Anchor CLI not installed"
        echo "Install with: cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked"
    fi
    
    # Check Sui CLI
    if command -v sui &> /dev/null; then
        SUI_VERSION=$(sui --version)
        print_success "Sui CLI installed: $SUI_VERSION"
    else
        print_error "Sui CLI not installed"
        echo "Install with: cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet-v1.24.0 sui"
    fi
    
    # Check NEAR CLI
    if command -v near &> /dev/null; then
        NEAR_VERSION=$(near --version)
        print_success "NEAR CLI installed: $NEAR_VERSION"
    else
        print_error "NEAR CLI not installed"
        echo "Install with: npm install -g near-cli-rs"
    fi
    
    echo ""
}

# Build Solana program
build_solana() {
    print_step "Building Solana program..."
    cd "$SCRIPT_DIR/solana"
    
    if anchor build; then
        print_success "Solana program built successfully"
        echo "  Program keypair: target/deploy/cashio_bridge-keypair.json"
        echo "  Program binary: target/deploy/cashio_bridge.so"
    else
        print_error "Solana build failed"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Build Sui contract
build_sui() {
    print_step "Building Sui contract..."
    cd "$SCRIPT_DIR/sui"
    
    if sui move build; then
        print_success "Sui contract built successfully"
    else
        print_error "Sui build failed"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Build NEAR contract
build_near() {
    print_step "Building NEAR contract..."
    cd "$SCRIPT_DIR/near"
    
    # Ensure wasm target is installed
    rustup target add wasm32-unknown-unknown 2>/dev/null || true
    
    if RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release; then
        mkdir -p res
        cp target/wasm32-unknown-unknown/release/cashio_bridge_near.wasm res/
        print_success "NEAR contract built successfully"
        echo "  WASM file: res/cashio_bridge_near.wasm"
    else
        print_error "NEAR build failed"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Deploy Solana program
deploy_solana() {
    local NETWORK="${1:-devnet}"
    print_step "Deploying Solana program to $NETWORK..."
    cd "$SCRIPT_DIR/solana"
    
    # Configure Solana CLI
    if [ "$NETWORK" == "mainnet" ]; then
        solana config set --url https://api.mainnet-beta.solana.com
    else
        solana config set --url https://api.devnet.solana.com
    fi
    
    # Airdrop for devnet
    if [ "$NETWORK" == "devnet" ]; then
        echo "Requesting airdrop..."
        solana airdrop 2 || true
    fi
    
    # Deploy
    if anchor deploy --provider.cluster "$NETWORK"; then
        PROGRAM_ID=$(solana address -k target/deploy/cashio_bridge-keypair.json)
        print_success "Solana program deployed!"
        echo "  Program ID: $PROGRAM_ID"
        echo "  Network: $NETWORK"
        
        # Save deployment info
        mkdir -p ../deployments
        echo "{\"programId\": \"$PROGRAM_ID\", \"network\": \"$NETWORK\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > ../deployments/solana-$NETWORK.json
    else
        print_error "Solana deployment failed"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Deploy Sui contract
deploy_sui() {
    local NETWORK="${1:-testnet}"
    print_step "Deploying Sui contract to $NETWORK..."
    cd "$SCRIPT_DIR/sui"
    
    # Configure Sui CLI
    if [ "$NETWORK" == "mainnet" ]; then
        sui client switch --env mainnet || sui client new-env --alias mainnet --rpc https://fullnode.mainnet.sui.io:443
    else
        sui client switch --env testnet || sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
    fi
    
    # Deploy
    DEPLOY_RESULT=$(sui client publish --gas-budget 100000000 --json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        PACKAGE_ID=$(echo "$DEPLOY_RESULT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
        print_success "Sui contract deployed!"
        echo "  Package ID: $PACKAGE_ID"
        echo "  Network: $NETWORK"
        
        # Save deployment info
        mkdir -p ../deployments
        echo "{\"packageId\": \"$PACKAGE_ID\", \"network\": \"$NETWORK\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > ../deployments/sui-$NETWORK.json
    else
        print_error "Sui deployment failed"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Deploy NEAR contract
deploy_near() {
    local NETWORK="${1:-testnet}"
    local ACCOUNT_ID="${2:-cashio.testnet}"
    
    print_step "Deploying NEAR contract to $NETWORK..."
    cd "$SCRIPT_DIR/near"
    
    # Deploy
    if near deploy "$ACCOUNT_ID" res/cashio_bridge_near.wasm; then
        print_success "NEAR contract deployed!"
        echo "  Account ID: $ACCOUNT_ID"
        echo "  Network: $NETWORK"
        
        # Initialize contract
        echo "Initializing contract..."
        near call "$ACCOUNT_ID" new "{\"owner_id\": \"$ACCOUNT_ID\", \"hub_chain_id\": \"999888777\", \"guardian_threshold\": 1}" --accountId "$ACCOUNT_ID" || true
        
        # Save deployment info
        mkdir -p ../deployments
        echo "{\"accountId\": \"$ACCOUNT_ID\", \"network\": \"$NETWORK\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > ../deployments/near-$NETWORK.json
    else
        print_error "NEAR deployment failed"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Main menu
show_menu() {
    echo "Select an action:"
    echo "  1) Check dependencies"
    echo "  2) Build all contracts"
    echo "  3) Build Solana program"
    echo "  4) Build Sui contract"
    echo "  5) Build NEAR contract"
    echo "  6) Deploy Solana (devnet)"
    echo "  7) Deploy Sui (testnet)"
    echo "  8) Deploy NEAR (testnet)"
    echo "  9) Deploy all (testnet)"
    echo "  0) Exit"
    echo ""
    read -p "Enter choice: " choice
    
    case $choice in
        1) check_dependencies ;;
        2) build_solana && build_sui && build_near ;;
        3) build_solana ;;
        4) build_sui ;;
        5) build_near ;;
        6) deploy_solana devnet ;;
        7) deploy_sui testnet ;;
        8) deploy_near testnet ;;
        9) 
            deploy_solana devnet
            deploy_sui testnet
            deploy_near testnet
            ;;
        0) exit 0 ;;
        *) echo "Invalid option" ;;
    esac
}

# Parse command line arguments
case "${1:-menu}" in
    check)
        print_banner
        check_dependencies
        ;;
    build)
        print_banner
        case "${2:-all}" in
            solana) build_solana ;;
            sui) build_sui ;;
            near) build_near ;;
            all) build_solana && build_sui && build_near ;;
        esac
        ;;
    deploy)
        print_banner
        NETWORK="${3:-testnet}"
        case "${2:-all}" in
            solana) deploy_solana "$NETWORK" ;;
            sui) deploy_sui "$NETWORK" ;;
            near) deploy_near "$NETWORK" "${4:-cashio.testnet}" ;;
            all)
                deploy_solana "$NETWORK"
                deploy_sui "$NETWORK"
                deploy_near "$NETWORK"
                ;;
        esac
        ;;
    menu|*)
        print_banner
        while true; do
            show_menu
            echo ""
        done
        ;;
esac
