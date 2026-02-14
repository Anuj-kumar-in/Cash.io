/**
 * Cash.io Bridge Relayer Service
 * 
 * Watches for bridge events across chains and relays them to/from the hub.
 * Automatic cross-chain transaction processing with note creation.
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

/**
 * Chain configuration for relayer
 */
interface ChainConfig {
    name: string;
    chainId: number;
    rpcUrl: string;
    bridgeAddress: string;
    category: 'evm' | 'bitcoin' | 'solana';
    hubChainId: number;
    blockConfirmations: number;
}

/**
 * Pending deposit to process
 */
interface PendingDeposit {
    chainId: number;
    depositor: string;
    commitment: string;
    amount: bigint;
    nonce: bigint;
    txHash: string;
    blockNumber: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Bridge ABI for event watching
 */
const BRIDGE_ABI = [
    "event Deposited(address indexed depositor, bytes32 indexed commitment, uint256 amount, uint256 indexed nonce)",
    "event WithdrawalProcessed(address indexed recipient, bytes32 indexed withdrawalHash, uint256 amount)",
    "function processDeposit(bytes calldata _proof, bytes32 _depositHash, address _depositor, uint256 _amount, bytes32 _commitment) external",
    "function relayers(address) external view returns (bool)"
];

/**
 * Hub TransactionRegistry ABI
 */
const TRANSACTION_REGISTRY_ABI = [
    "function recordTransaction(bytes32 _txHash, uint256 _chainId, uint8 _txType, address _sender, uint256 _amount, bytes32 _commitment, uint256 _blockNumber, bytes32 _noteHash, bool _isPrivate) external",
    "event TransactionRecorded(bytes32 indexed txHash, uint256 indexed chainId, uint8 txType, address sender, uint256 amount)"
];

/**
 * Testnet chain configurations
 */
const TESTNET_CHAINS: Record<string, ChainConfig> = {
    sepolia: {
        name: 'Sepolia',
        chainId: 11155111,
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org',
        bridgeAddress: '', // Will be loaded from deployments
        category: 'evm',
        hubChainId: 41021,
        blockConfirmations: 2
    },
    rskTestnet: {
        name: 'RSK Testnet',
        chainId: 31,
        rpcUrl: process.env.RSK_TESTNET_RPC_URL || 'https://public-node.testnet.rsk.co',
        bridgeAddress: '',
        category: 'bitcoin',
        hubChainId: 41021,
        blockConfirmations: 10
    },
    arbitrumSepolia: {
        name: 'Arbitrum Sepolia',
        chainId: 421614,
        rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
        bridgeAddress: '',
        category: 'evm',
        hubChainId: 41021,
        blockConfirmations: 1
    },
    optimismSepolia: {
        name: 'Optimism Sepolia',
        chainId: 11155420,
        rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL || 'https://sepolia.optimism.io',
        bridgeAddress: '',
        category: 'evm',
        hubChainId: 41021,
        blockConfirmations: 1
    },
    baseSepolia: {
        name: 'Base Sepolia',
        chainId: 84532,
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
        bridgeAddress: '',
        category: 'evm',
        hubChainId: 41021,
        blockConfirmations: 1
    },
    polygonAmoy: {
        name: 'Polygon Amoy',
        chainId: 80002,
        rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
        bridgeAddress: '',
        category: 'evm',
        hubChainId: 41021,
        blockConfirmations: 3
    }
};

/**
 * Hub chain configuration
 */
const HUB_CONFIG = {
    testnet: {
        chainId: 41021,
        rpcUrl: process.env.TESTNET_HUB_RPC_URL || 'http://127.0.0.1:9656/ext/bc/2kncNH6LugUTEWwiV87AijZhN2zd9mek77AMzMA93Ak6QTcvKN/rpc',
        transactionRegistry: process.env.TESTNET_TRANSACTION_REGISTRY_ADDRESS || ''
    },
    mainnet: {
        chainId: 4102,
        rpcUrl: process.env.HUB_RPC_URL || 'http://127.0.0.1:9654/ext/bc/weCGw5ozNbEzW1CSvyJ15g1ZnLzcpjxKHjhbV1EVMQQKKa2CM/rpc',
        transactionRegistry: process.env.TRANSACTION_REGISTRY_ADDRESS || ''
    }
};

/**
 * Load bridge addresses from deployments
 */
function loadBridgeAddresses(): void {
    const deploymentsDir = path.resolve(process.cwd(), "../contracts/deployments");
    
    for (const [network, config] of Object.entries(TESTNET_CHAINS)) {
        try {
            const deploymentFile = path.join(deploymentsDir, `${network}-bridges.json`);
            if (fs.existsSync(deploymentFile)) {
                const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
                if (deployment.contracts?.ethBridge) {
                    config.bridgeAddress = deployment.contracts.ethBridge;
                } else if (deployment.contracts?.rootstockBridge) {
                    config.bridgeAddress = deployment.contracts.rootstockBridge;
                }
                console.log(`📋 Loaded ${network} bridge: ${config.bridgeAddress}`);
            }
        } catch (error) {
            console.warn(`⚠️ Could not load ${network} deployment`);
        }
    }
}

/**
 * Bridge Relayer class
 */
class BridgeRelayer {
    private chainConfig: ChainConfig;
    private provider: ethers.JsonRpcProvider;
    private hubProvider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private hubWallet: ethers.Wallet;
    private bridge: ethers.Contract;
    private hubRegistry: ethers.Contract;
    private pendingDeposits: Map<string, PendingDeposit> = new Map();
    private isRunning: boolean = false;

    constructor(chainName: string) {
        const config = TESTNET_CHAINS[chainName];
        if (!config) {
            throw new Error(`Unknown chain: ${chainName}`);
        }
        if (!config.bridgeAddress) {
            throw new Error(`Bridge not deployed on ${chainName}`);
        }

        this.chainConfig = config;
        
        // Set up providers
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.hubProvider = new ethers.JsonRpcProvider(HUB_CONFIG.testnet.rpcUrl);
        
        // Set up wallets
        const privateKey = process.env.RELAYER_PRIVATE_KEY || process.env.VITE_DEPLOYER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("No relayer private key configured");
        }
        
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.hubWallet = new ethers.Wallet(privateKey, this.hubProvider);
        
        // Set up contracts
        this.bridge = new ethers.Contract(config.bridgeAddress, BRIDGE_ABI, this.wallet);
        this.hubRegistry = new ethers.Contract(
            HUB_CONFIG.testnet.transactionRegistry,
            TRANSACTION_REGISTRY_ABI,
            this.hubWallet
        );

        console.log(`🔗 Relayer initialized for ${config.name}`);
        console.log(`   Bridge: ${config.bridgeAddress}`);
        console.log(`   Relayer: ${this.wallet.address}`);
    }

    /**
     * Start watching for bridge events
     */
    async start(): Promise<void> {
        console.log(`\n🚀 Starting relayer for ${this.chainConfig.name}...`);
        
        // Verify relayer authorization
        const isRelayer = await this.bridge.relayers(this.wallet.address);
        if (!isRelayer) {
            console.warn(`⚠️ Warning: ${this.wallet.address} is not an authorized relayer`);
        } else {
            console.log(`✅ Relayer authorized on bridge`);
        }

        this.isRunning = true;

        // Watch for Deposited events
        this.bridge.on("Deposited", async (depositor, commitment, amount, nonce, event) => {
            console.log(`\n📥 Deposit detected on ${this.chainConfig.name}`);
            console.log(`   Depositor: ${depositor}`);
            console.log(`   Amount: ${ethers.formatEther(amount)} ${this.chainConfig.name}`);
            console.log(`   Commitment: ${commitment}`);
            
            const deposit: PendingDeposit = {
                chainId: this.chainConfig.chainId,
                depositor,
                commitment,
                amount,
                nonce,
                txHash: event.log.transactionHash,
                blockNumber: event.log.blockNumber,
                status: 'pending'
            };

            this.pendingDeposits.set(commitment, deposit);
            
            // Wait for confirmations then process
            await this.waitForConfirmations(deposit);
        });

        console.log(`👀 Watching for deposits on ${this.chainConfig.name}...`);
    }

    /**
     * Wait for block confirmations before processing
     */
    private async waitForConfirmations(deposit: PendingDeposit): Promise<void> {
        console.log(`⏳ Waiting for ${this.chainConfig.blockConfirmations} confirmations...`);
        
        const targetBlock = deposit.blockNumber + this.chainConfig.blockConfirmations;
        
        while (this.isRunning) {
            const currentBlock = await this.provider.getBlockNumber();
            if (currentBlock >= targetBlock) {
                console.log(`✅ Deposit confirmed at block ${currentBlock}`);
                await this.processDeposit(deposit);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
        }
    }

    /**
     * Process a confirmed deposit by recording on hub
     */
    private async processDeposit(deposit: PendingDeposit): Promise<void> {
        deposit.status = 'processing';
        console.log(`🔄 Processing deposit to hub chain...`);

        try {
            // Record transaction on hub
            const tx = await this.hubRegistry.recordTransaction(
                deposit.txHash,                    // txHash
                deposit.chainId,                   // chainId
                3,                                 // txType = BRIDGE
                deposit.depositor,                 // sender
                deposit.amount,                    // amount
                deposit.commitment,                // commitment
                deposit.blockNumber,               // blockNumber
                deposit.commitment,                // noteHash (same as commitment for bridge)
                true                               // isPrivate
            );

            const receipt = await tx.wait();
            
            deposit.status = 'completed';
            console.log(`✅ Deposit recorded on hub: ${receipt.hash}`);
            
            // Remove from pending
            this.pendingDeposits.delete(deposit.commitment);
            
        } catch (error: any) {
            deposit.status = 'failed';
            console.error(`❌ Failed to process deposit: ${error.message}`);
        }
    }

    /**
     * Stop the relayer
     */
    stop(): void {
        this.isRunning = false;
        this.bridge.removeAllListeners();
        console.log(`🛑 Relayer stopped for ${this.chainConfig.name}`);
    }

    /**
     * Get relayer status
     */
    getStatus(): object {
        return {
            chain: this.chainConfig.name,
            chainId: this.chainConfig.chainId,
            bridgeAddress: this.chainConfig.bridgeAddress,
            relayerAddress: this.wallet.address,
            pendingDeposits: this.pendingDeposits.size,
            isRunning: this.isRunning
        };
    }
}

/**
 * Multi-chain relayer manager
 */
class RelayerManager {
    private relayers: Map<string, BridgeRelayer> = new Map();

    async startChain(chainName: string): Promise<void> {
        if (this.relayers.has(chainName)) {
            console.log(`⚠️ Relayer for ${chainName} already running`);
            return;
        }

        try {
            const relayer = new BridgeRelayer(chainName);
            await relayer.start();
            this.relayers.set(chainName, relayer);
        } catch (error: any) {
            console.error(`❌ Failed to start ${chainName} relayer: ${error.message}`);
        }
    }

    async startAll(): Promise<void> {
        console.log(`\n🚀 Starting all bridge relayers...\n`);
        
        for (const chainName of Object.keys(TESTNET_CHAINS)) {
            await this.startChain(chainName);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Stagger starts
        }
    }

    stopAll(): void {
        for (const [name, relayer] of this.relayers) {
            relayer.stop();
        }
        this.relayers.clear();
    }

    getStatus(): object[] {
        return Array.from(this.relayers.values()).map(r => r.getStatus());
    }
}

/**
 * Main entry point
 */
async function main() {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`         Cash.io Bridge Relayer Service`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Load bridge addresses from deployments
    loadBridgeAddresses();

    const args = process.argv.slice(2);
    const manager = new RelayerManager();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log(`\n\n🛑 Shutting down relayers...`);
        manager.stopAll();
        process.exit(0);
    });

    if (args.includes('--all')) {
        await manager.startAll();
    } else {
        const chainIndex = args.indexOf('--chain');
        if (chainIndex !== -1 && args[chainIndex + 1]) {
            await manager.startChain(args[chainIndex + 1]);
        } else {
            console.log(`Usage:`);
            console.log(`  npm run relay:sepolia     # Relay Sepolia bridge`);
            console.log(`  npm run relay:rsk         # Relay RSK Testnet bridge`);
            console.log(`  npm run relay:all         # Relay all chains`);
            console.log(`\nAvailable chains: ${Object.keys(TESTNET_CHAINS).join(', ')}`);
            process.exit(0);
        }
    }

    // Keep process running
    console.log(`\n💡 Press Ctrl+C to stop the relayer\n`);
}

main().catch(console.error);

export { BridgeRelayer, RelayerManager, TESTNET_CHAINS, HUB_CONFIG };