/**
 * Cash.io Bridge Client
 * 
 * Handles cross-chain bridging operations for EVM chains, Bitcoin L2s, and Solana.
 */

import { ethers } from "ethers";
import { CashNote, createNote } from "./note.js";

/**
 * Chain category type
 */
export type ChainCategory = 'evm' | 'bitcoin' | 'solana' | 'hub';

/**
 * Supported chain configuration
 */
export interface ChainConfig {
    id: number | string;
    name: string;
    symbol: string;
    category: ChainCategory;
    rpcUrl: string;
    bridgeAddress?: string;
    isTestnet: boolean;
}

/**
 * Bridge configuration
 */
export interface BridgeConfig {
    // EVM chains
    ethBridgeAddress?: string;
    sepoliaBridgeAddress?: string;
    polygonBridgeAddress?: string;
    arbitrumBridgeAddress?: string;
    optimismBridgeAddress?: string;
    avalancheBridgeAddress?: string;
    baseBridgeAddress?: string;
    bscBridgeAddress?: string;
    zkSyncBridgeAddress?: string;
    lineaBridgeAddress?: string;
    scrollBridgeAddress?: string;
    blastBridgeAddress?: string;
    mantleBridgeAddress?: string;

    // Bitcoin L2s
    rootstockBridgeAddress?: string;
    rootstockTestnetBridgeAddress?: string;
    bobBridgeAddress?: string;
    merlinBridgeAddress?: string;
    bitlayerBridgeAddress?: string;
    coreBridgeAddress?: string;

    // Solana
    solanaBridgeAddress?: string;
    solanaDevnetBridgeAddress?: string;
}

/**
 * All supported chains
 */
export const SUPPORTED_CHAINS: ChainConfig[] = [
    // Hub
    { id: 99999, name: 'Cash.io Subnet', symbol: 'CASH', category: 'hub', rpcUrl: 'http://localhost:9650/ext/bc/cash/rpc', isTestnet: false },

    // EVM Mainnets
    { id: 1, name: 'Ethereum', symbol: 'ETH', category: 'evm', rpcUrl: 'https://eth.llamarpc.com', isTestnet: false },
    { id: 137, name: 'Polygon', symbol: 'MATIC', category: 'evm', rpcUrl: 'https://polygon-rpc.com', isTestnet: false },
    { id: 42161, name: 'Arbitrum One', symbol: 'ETH', category: 'evm', rpcUrl: 'https://arb1.arbitrum.io/rpc', isTestnet: false },
    { id: 10, name: 'Optimism', symbol: 'ETH', category: 'evm', rpcUrl: 'https://mainnet.optimism.io', isTestnet: false },
    { id: 43114, name: 'Avalanche', symbol: 'AVAX', category: 'evm', rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', isTestnet: false },
    { id: 56, name: 'BNB Chain', symbol: 'BNB', category: 'evm', rpcUrl: 'https://bsc-dataseed.binance.org', isTestnet: false },
    { id: 8453, name: 'Base', symbol: 'ETH', category: 'evm', rpcUrl: 'https://mainnet.base.org', isTestnet: false },
    { id: 324, name: 'zkSync Era', symbol: 'ETH', category: 'evm', rpcUrl: 'https://mainnet.era.zksync.io', isTestnet: false },
    { id: 59144, name: 'Linea', symbol: 'ETH', category: 'evm', rpcUrl: 'https://rpc.linea.build', isTestnet: false },
    { id: 534352, name: 'Scroll', symbol: 'ETH', category: 'evm', rpcUrl: 'https://rpc.scroll.io', isTestnet: false },
    { id: 250, name: 'Fantom', symbol: 'FTM', category: 'evm', rpcUrl: 'https://rpc.ftm.tools', isTestnet: false },
    { id: 100, name: 'Gnosis', symbol: 'xDAI', category: 'evm', rpcUrl: 'https://rpc.gnosischain.com', isTestnet: false },
    { id: 42220, name: 'Celo', symbol: 'CELO', category: 'evm', rpcUrl: 'https://forno.celo.org', isTestnet: false },
    { id: 5000, name: 'Mantle', symbol: 'MNT', category: 'evm', rpcUrl: 'https://rpc.mantle.xyz', isTestnet: false },
    { id: 81457, name: 'Blast', symbol: 'ETH', category: 'evm', rpcUrl: 'https://rpc.blast.io', isTestnet: false },

    // EVM Testnets
    { id: 11155111, name: 'Sepolia', symbol: 'ETH', category: 'evm', rpcUrl: 'https://sepolia.drpc.org', isTestnet: true },
    { id: 17000, name: 'Holesky', symbol: 'ETH', category: 'evm', rpcUrl: 'https://ethereum-holesky.publicnode.com', isTestnet: true },
    { id: 80002, name: 'Polygon Amoy', symbol: 'MATIC', category: 'evm', rpcUrl: 'https://rpc-amoy.polygon.technology', isTestnet: true },
    { id: 421614, name: 'Arbitrum Sepolia', symbol: 'ETH', category: 'evm', rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc', isTestnet: true },
    { id: 11155420, name: 'Optimism Sepolia', symbol: 'ETH', category: 'evm', rpcUrl: 'https://sepolia.optimism.io', isTestnet: true },
    { id: 43113, name: 'Avalanche Fuji', symbol: 'AVAX', category: 'evm', rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc', isTestnet: true },
    { id: 97, name: 'BSC Testnet', symbol: 'tBNB', category: 'evm', rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545', isTestnet: true },
    { id: 84532, name: 'Base Sepolia', symbol: 'ETH', category: 'evm', rpcUrl: 'https://sepolia.base.org', isTestnet: true },

    // Bitcoin L2s / Sidechains
    { id: 30, name: 'Rootstock', symbol: 'RBTC', category: 'bitcoin', rpcUrl: 'https://public-node.rsk.co', isTestnet: false },
    { id: 31, name: 'Rootstock Testnet', symbol: 'tRBTC', category: 'bitcoin', rpcUrl: 'https://public-node.testnet.rsk.co', isTestnet: true },
    { id: 60808, name: 'BOB', symbol: 'ETH', category: 'bitcoin', rpcUrl: 'https://rpc.gobob.xyz', isTestnet: false },
    { id: 111, name: 'BOB Testnet', symbol: 'ETH', category: 'bitcoin', rpcUrl: 'https://testnet.rpc.gobob.xyz', isTestnet: true },
    { id: 4200, name: 'Merlin Chain', symbol: 'BTC', category: 'bitcoin', rpcUrl: 'https://rpc.merlinchain.io', isTestnet: false },
    { id: 686868, name: 'Merlin Testnet', symbol: 'BTC', category: 'bitcoin', rpcUrl: 'https://testnet-rpc.merlinchain.io', isTestnet: true },
    { id: 200901, name: 'Bitlayer', symbol: 'BTC', category: 'bitcoin', rpcUrl: 'https://rpc.bitlayer.org', isTestnet: false },
    { id: 200810, name: 'Bitlayer Testnet', symbol: 'BTC', category: 'bitcoin', rpcUrl: 'https://testnet-rpc.bitlayer.org', isTestnet: true },
    { id: 1116, name: 'Core', symbol: 'CORE', category: 'bitcoin', rpcUrl: 'https://rpc.coredao.org', isTestnet: false },
    { id: 1115, name: 'Core Testnet', symbol: 'tCORE', category: 'bitcoin', rpcUrl: 'https://rpc.test.btcs.network', isTestnet: true },

    // Solana
    { id: 'solana-mainnet', name: 'Solana', symbol: 'SOL', category: 'solana', rpcUrl: 'https://api.mainnet-beta.solana.com', isTestnet: false },
    { id: 'solana-devnet', name: 'Solana Devnet', symbol: 'SOL', category: 'solana', rpcUrl: 'https://api.devnet.solana.com', isTestnet: true },
    { id: 'solana-testnet', name: 'Solana Testnet', symbol: 'SOL', category: 'solana', rpcUrl: 'https://api.testnet.solana.com', isTestnet: true },
];

/**
 * Bridge deposit result
 */
export interface BridgeDeposit {
    sourceChainId: number | string;
    sourceChainName: string;
    depositHash: string;
    commitment: string;
    amount: bigint;
    note: CashNote;
    transactionHash: string;
    status: "pending" | "confirmed" | "finalized";
    estimatedTime: number; // seconds
}

/**
 * Bridge withdrawal result
 */
export interface BridgeWithdrawal {
    destinationChainId: number | string;
    destinationChainName: string;
    withdrawalHash: string;
    amount: bigint;
    recipient: string;
    transactionHash: string;
    status: "pending" | "processing" | "completed";
    estimatedTime: number; // seconds
}

/**
 * Bridge status
 */
export interface BridgeStatus {
    chainId: number | string;
    chainName: string;
    isHealthy: boolean;
    pendingDeposits: number;
    pendingWithdrawals: number;
    totalLiquidity: bigint;
}

/**
 * Bridge fee estimation
 */
export interface BridgeFeeEstimate {
    bridgeFee: bigint;
    gasFee: bigint;
    relayerFee: bigint;
    totalFee: bigint;
    estimatedTimeSeconds: number;
}

/**
 * Bridge Client
 */
export class BridgeClient {
    private config: BridgeConfig;
    private providers: Map<string, ethers.JsonRpcProvider> = new Map();

    constructor(config: BridgeConfig) {
        this.config = config;
    }

    /**
     * Get chain configuration by ID
     */
    getChain(chainId: number | string): ChainConfig | undefined {
        return SUPPORTED_CHAINS.find(c => c.id === chainId);
    }

    /**
     * Get all chains by category
     */
    getChainsByCategory(category: ChainCategory): ChainConfig[] {
        return SUPPORTED_CHAINS.filter(c => c.category === category);
    }

    /**
     * Get all supported chains
     */
    getAllChains(): ChainConfig[] {
        return [...SUPPORTED_CHAINS];
    }

    /**
     * Get mainnet chains only
     */
    getMainnets(): ChainConfig[] {
        return SUPPORTED_CHAINS.filter(c => !c.isTestnet);
    }

    /**
     * Get testnet chains only
     */
    getTestnets(): ChainConfig[] {
        return SUPPORTED_CHAINS.filter(c => c.isTestnet);
    }

    /**
     * Check if bridge is supported between two chains
     */
    isBridgeSupported(sourceChainId: number | string, destChainId: number | string): boolean {
        const sourceChain = this.getChain(sourceChainId);
        const destChain = this.getChain(destChainId);

        if (!sourceChain || !destChain) return false;

        // All chains can bridge to hub
        if (destChainId === 99999) return true;

        // Hub can bridge to all chains
        if (sourceChainId === 99999) return true;

        // Same category chains can bridge to each other via hub
        return sourceChain.category === destChain.category ||
            sourceChain.category === 'hub' ||
            destChain.category === 'hub';
    }

    /**
     * Initialize provider for a chain
     */
    private async getProvider(chainId: number | string): Promise<ethers.JsonRpcProvider> {
        const key = String(chainId);
        if (this.providers.has(key)) {
            return this.providers.get(key)!;
        }

        const chain = this.getChain(chainId);
        if (!chain) {
            throw new Error(`Unknown chain: ${chainId}`);
        }

        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        this.providers.set(key, provider);
        return provider;
    }

    /**
     * Get bridge contract address for a chain
     */
    private getBridgeAddress(chainId: number | string): string | undefined {
        const addressMap: Record<string, string | undefined> = {
            '1': this.config.ethBridgeAddress,
            '11155111': this.config.sepoliaBridgeAddress,
            '137': this.config.polygonBridgeAddress,
            '42161': this.config.arbitrumBridgeAddress,
            '10': this.config.optimismBridgeAddress,
            '43114': this.config.avalancheBridgeAddress,
            '8453': this.config.baseBridgeAddress,
            '56': this.config.bscBridgeAddress,
            '324': this.config.zkSyncBridgeAddress,
            '59144': this.config.lineaBridgeAddress,
            '534352': this.config.scrollBridgeAddress,
            '81457': this.config.blastBridgeAddress,
            '5000': this.config.mantleBridgeAddress,
            '30': this.config.rootstockBridgeAddress,
            '31': this.config.rootstockTestnetBridgeAddress,
            '60808': this.config.bobBridgeAddress,
            '4200': this.config.merlinBridgeAddress,
            '200901': this.config.bitlayerBridgeAddress,
            '1116': this.config.coreBridgeAddress,
            'solana-mainnet': this.config.solanaBridgeAddress,
            'solana-devnet': this.config.solanaDevnetBridgeAddress,
        };

        return addressMap[String(chainId)];
    }

    /**
     * Deposit from external chain to hub
     */
    async deposit(
        sourceChainId: number | string,
        amount: bigint,
        signer: ethers.Signer
    ): Promise<BridgeDeposit> {
        const sourceChain = this.getChain(sourceChainId);
        if (!sourceChain) {
            throw new Error(`Unsupported chain: ${sourceChainId}`);
        }

        // Create a note for the deposit
        const note = await createNote(amount);

        // Handle Solana separately
        if (sourceChain.category === 'solana') {
            return this.depositFromSolana(sourceChainId as string, amount, note);
        }

        // EVM chains (including Bitcoin L2s which are EVM-compatible)
        const bridgeAddress = this.getBridgeAddress(sourceChainId);
        if (!bridgeAddress) {
            throw new Error(`Bridge not configured for chain: ${sourceChain.name}`);
        }

        const bridgeInterface = new ethers.Interface([
            "function deposit(bytes32 commitment) external payable",
        ]);

        const callData = bridgeInterface.encodeFunctionData("deposit", [
            note.commitment,
        ]);

        // Send transaction
        const tx = await signer.sendTransaction({
            to: bridgeAddress,
            value: amount,
            data: callData,
        });

        const receipt = await tx.wait();

        // Calculate deposit hash
        const depositHash = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "bytes32", "uint256", "uint256"],
                [await signer.getAddress(), note.commitment, amount, receipt!.blockNumber]
            )
        );

        // Estimate time based on chain category
        const estimatedTime = this.getEstimatedBridgeTime(sourceChainId, 99999);

        return {
            sourceChainId,
            sourceChainName: sourceChain.name,
            depositHash,
            commitment: note.commitment,
            amount,
            note,
            transactionHash: tx.hash,
            status: "confirmed",
            estimatedTime,
        };
    }

    /**
     * Handle Solana deposit
     */
    private async depositFromSolana(
        chainId: string,
        amount: bigint,
        note: CashNote
    ): Promise<BridgeDeposit> {
        // Solana deposits require Wormhole or similar bridge
        // This is a placeholder - actual implementation would use @solana/web3.js and Wormhole SDK

        throw new Error("Solana deposits require Solana wallet integration. Please use Phantom or another Solana wallet.");
    }

    /**
     * Withdraw from hub to external chain
     */
    async withdraw(
        destinationChainId: number | string,
        note: CashNote,
        recipient: string,
        signer: ethers.Signer
    ): Promise<BridgeWithdrawal> {
        const destChain = this.getChain(destinationChainId);
        if (!destChain) {
            throw new Error(`Unsupported chain: ${destinationChainId}`);
        }

        // Generate withdrawal request
        const withdrawalHash = ethers.keccak256(
            ethers.solidityPacked(
                ["bytes32", "address", "uint256", "uint256"],
                [note.commitment, recipient, note.amount, Date.now()]
            )
        );

        const estimatedTime = this.getEstimatedBridgeTime(99999, destinationChainId);

        return {
            destinationChainId,
            destinationChainName: destChain.name,
            withdrawalHash,
            amount: note.amount,
            recipient,
            transactionHash: "pending", // Set after relay
            status: "pending",
            estimatedTime,
        };
    }

    /**
     * Get estimated bridge time in seconds
     */
    getEstimatedBridgeTime(sourceChainId: number | string, destChainId: number | string): number {
        const sourceChain = this.getChain(sourceChainId);
        const destChain = this.getChain(destChainId);

        if (!sourceChain || !destChain) return 15 * 60; // 15 minutes default

        // Solana takes longer due to Wormhole
        if (sourceChain.category === 'solana' || destChain.category === 'solana') {
            return 30 * 60; // 30 minutes
        }

        // Bitcoin L2s take longer due to Bitcoin confirmations
        if (sourceChain.category === 'bitcoin' || destChain.category === 'bitcoin') {
            return 20 * 60; // 20 minutes
        }

        // L2s are fast
        const l2ChainIds = [42161, 10, 8453, 324, 59144, 534352, 81457, 5000];
        if (l2ChainIds.includes(sourceChainId as number) || l2ChainIds.includes(destChainId as number)) {
            return 10 * 60; // 10 minutes
        }

        // Default for Ethereum mainnet
        return 15 * 60; // 15 minutes
    }

    /**
     * Estimate bridge fee
     */
    async estimateBridgeFee(
        sourceChainId: number | string,
        destChainId: number | string,
        amount: bigint
    ): Promise<BridgeFeeEstimate> {
        const sourceChain = this.getChain(sourceChainId);
        const destChain = this.getChain(destChainId);

        // Bridge fee: 0.1% of amount
        const bridgeFee = amount / 1000n;

        // Relayer fee: 0.05%
        const relayerFee = amount / 2000n;

        // Gas fee depends on chains
        let gasFee = ethers.parseEther("0.001"); // Default

        if (sourceChain?.category === 'evm') {
            if (sourceChainId === 1) {
                gasFee = ethers.parseEther("0.01"); // Ethereum mainnet is expensive
            }
        } else if (sourceChain?.category === 'solana') {
            gasFee = ethers.parseEther("0.0001"); // Solana is cheap
        } else if (sourceChain?.category === 'bitcoin') {
            gasFee = ethers.parseEther("0.002"); // Bitcoin L2s moderate
        }

        const totalFee = bridgeFee + relayerFee + gasFee;
        const estimatedTimeSeconds = this.getEstimatedBridgeTime(sourceChainId, destChainId);

        return {
            bridgeFee,
            gasFee,
            relayerFee,
            totalFee,
            estimatedTimeSeconds,
        };
    }

    /**
     * Get bridge status for a chain
     */
    async getBridgeStatus(chainId: number | string): Promise<BridgeStatus> {
        const chain = this.getChain(chainId);
        if (!chain) {
            throw new Error(`Unknown chain: ${chainId}`);
        }

        // For Solana, return basic status
        if (chain.category === 'solana') {
            return {
                chainId,
                chainName: chain.name,
                isHealthy: true,
                pendingDeposits: 0,
                pendingWithdrawals: 0,
                totalLiquidity: 0n,
            };
        }

        try {
            const provider = await this.getProvider(chainId);
            const bridgeAddress = this.getBridgeAddress(chainId);

            if (!bridgeAddress) {
                return {
                    chainId,
                    chainName: chain.name,
                    isHealthy: false,
                    pendingDeposits: 0,
                    pendingWithdrawals: 0,
                    totalLiquidity: 0n,
                };
            }

            const bridgeContract = new ethers.Contract(
                bridgeAddress,
                [
                    "function getLiquidity() view returns (uint256)",
                ],
                provider
            );

            const liquidity = await bridgeContract.getLiquidity();

            return {
                chainId,
                chainName: chain.name,
                isHealthy: true,
                pendingDeposits: 0,
                pendingWithdrawals: 0,
                totalLiquidity: liquidity,
            };
        } catch (error) {
            return {
                chainId,
                chainName: chain.name,
                isHealthy: false,
                pendingDeposits: 0,
                pendingWithdrawals: 0,
                totalLiquidity: 0n,
            };
        }
    }

    /**
     * Wait for bridge deposit to finalize
     */
    async waitForDepositFinalization(
        depositHash: string,
        sourceChainId: number | string,
        maxAttempts: number = 60,
        delayMs: number = 10000
    ): Promise<boolean> {
        for (let i = 0; i < maxAttempts; i++) {
            const finalized = await this.checkDepositFinalized(depositHash, sourceChainId);
            if (finalized) {
                return true;
            }
            await new Promise(r => setTimeout(r, delayMs));
        }
        return false;
    }

    /**
     * Check if deposit is finalized on hub chain
     */
    private async checkDepositFinalized(
        depositHash: string,
        sourceChainId: number | string
    ): Promise<boolean> {
        // Query hub chain for deposit finalization
        // This would check the ShieldedPool contract for the deposit event
        return false; // Placeholder
    }
}
