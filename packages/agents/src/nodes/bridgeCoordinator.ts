/**
 * Bridge Coordinator Node
 * 
 * Handles cross-chain bridge operations with note system integration.
 * Supports EVM chains, Bitcoin L2s, and Solana bridging.
 */

import { ethers } from "ethers";
import { AgentStateType, BridgeIntent, TransactionStatus } from "../state/agentState.js";

/**
 * Bridge configuration for different chain types
 */
interface BridgeChainConfig {
    chainId: number;
    name: string;
    category: 'evm' | 'bitcoin' | 'solana';
    bridgeAddress: string;
    rpcUrl: string;
    symbol: string;
    isTestnet: boolean;
    hubChainId: number;
}

/**
 * Testnet bridge configurations
 */
const TESTNET_BRIDGES: Record<string, BridgeChainConfig> = {
    sepolia: {
        chainId: 11155111,
        name: 'Sepolia',
        category: 'evm',
        bridgeAddress: process.env.SEPOLIA_ETH_BRIDGE || '',
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org',
        symbol: 'ETH',
        isTestnet: true,
        hubChainId: 41021
    },
    rskTestnet: {
        chainId: 31,
        name: 'RSK Testnet',
        category: 'bitcoin',
        bridgeAddress: process.env.RSK_TESTNET_BRIDGE || '',
        rpcUrl: process.env.RSK_TESTNET_RPC_URL || 'https://public-node.testnet.rsk.co',
        symbol: 'tRBTC',
        isTestnet: true,
        hubChainId: 41021
    },
    arbitrumSepolia: {
        chainId: 421614,
        name: 'Arbitrum Sepolia',
        category: 'evm',
        bridgeAddress: process.env.ARBITRUM_SEPOLIA_BRIDGE || '',
        rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
        symbol: 'ETH',
        isTestnet: true,
        hubChainId: 41021
    },
    optimismSepolia: {
        chainId: 11155420,
        name: 'Optimism Sepolia',
        category: 'evm',
        bridgeAddress: process.env.OPTIMISM_SEPOLIA_BRIDGE || '',
        rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL || 'https://sepolia.optimism.io',
        symbol: 'ETH',
        isTestnet: true,
        hubChainId: 41021
    },
    baseSepolia: {
        chainId: 84532,
        name: 'Base Sepolia',
        category: 'evm',
        bridgeAddress: process.env.BASE_SEPOLIA_BRIDGE || '',
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
        symbol: 'ETH',
        isTestnet: true,
        hubChainId: 41021
    },
    polygonAmoy: {
        chainId: 80002,
        name: 'Polygon Amoy',
        category: 'evm',
        bridgeAddress: process.env.POLYGON_AMOY_BRIDGE || '',
        rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
        symbol: 'MATIC',
        isTestnet: true,
        hubChainId: 41021
    }
};

/**
 * Bridge ABI for deposits
 */
const BRIDGE_ABI = [
    "function deposit(bytes32 _commitment) external payable",
    "function processDeposit(bytes calldata _proof, bytes32 _depositHash, address _depositor, uint256 _amount, bytes32 _commitment) external",
    "function processWithdrawal(bytes calldata _proof, bytes32 _withdrawalHash, address _recipient, uint256 _amount) external",
    "function relayers(address) external view returns (bool)",
    "function totalDeposited() external view returns (uint256)",
    "function totalWithdrawn() external view returns (uint256)",
    "event Deposited(address indexed depositor, bytes32 indexed commitment, uint256 amount, uint256 indexed nonce)",
    "event WithdrawalProcessed(address indexed recipient, bytes32 indexed withdrawalHash, uint256 amount)"
];

/**
 * Bridge deposit result
 */
interface BridgeDepositResult {
    success: boolean;
    transactionHash?: string;
    commitment?: string;
    sourceChainId: number;
    amount: bigint;
    estimatedTime: number;
    error?: string;
}

/**
 * Bridge withdrawal result
 */
interface BridgeWithdrawalResult {
    success: boolean;
    transactionHash?: string;
    destinationChainId: number;
    recipient: string;
    amount: bigint;
    estimatedTime: number;
    error?: string;
}

/**
 * Get bridge config by chain ID or name
 */
function getBridgeConfig(chainIdOrName: number | string): BridgeChainConfig | undefined {
    if (typeof chainIdOrName === 'number') {
        return Object.values(TESTNET_BRIDGES).find(b => b.chainId === chainIdOrName);
    }
    return TESTNET_BRIDGES[chainIdOrName];
}

/**
 * Get all available bridge chains
 */
export function getAvailableBridgeChains(): BridgeChainConfig[] {
    return Object.values(TESTNET_BRIDGES).filter(b => b.bridgeAddress);
}

/**
 * Create a bridge deposit on source chain
 * This will:
 * 1. Generate a note commitment
 * 2. Deposit to the bridge contract
 * 3. Return the note for the user to claim on hub
 */
export async function createBridgeDeposit(
    sourceChainId: number,
    amount: bigint,
    commitment: string,
    signer: ethers.Signer
): Promise<BridgeDepositResult> {
    const config = getBridgeConfig(sourceChainId);
    if (!config) {
        return {
            success: false,
            sourceChainId,
            amount,
            estimatedTime: 0,
            error: `Unsupported chain: ${sourceChainId}`
        };
    }

    try {
        const bridge = new ethers.Contract(config.bridgeAddress, BRIDGE_ABI, signer);
        
        // Execute deposit
        const tx = await bridge.deposit(commitment, { value: amount });
        const receipt = await tx.wait();

        // Calculate estimated time based on chain
        const estimatedTime = getEstimatedBridgeTime(config.category);

        return {
            success: true,
            transactionHash: receipt.hash,
            commitment,
            sourceChainId,
            amount,
            estimatedTime
        };
    } catch (error: any) {
        return {
            success: false,
            sourceChainId,
            amount,
            estimatedTime: 0,
            error: error.message
        };
    }
}

/**
 * Process a bridge withdrawal to destination chain
 * This will:
 * 1. Verify the ZK proof
 * 2. Process withdrawal on destination bridge
 * 3. Release funds to recipient
 */
export async function processBridgeWithdrawal(
    destinationChainId: number,
    recipient: string,
    amount: bigint,
    proof: string,
    withdrawalHash: string,
    relayerSigner: ethers.Signer
): Promise<BridgeWithdrawalResult> {
    const config = getBridgeConfig(destinationChainId);
    if (!config) {
        return {
            success: false,
            destinationChainId,
            recipient,
            amount,
            estimatedTime: 0,
            error: `Unsupported chain: ${destinationChainId}`
        };
    }

    try {
        const bridge = new ethers.Contract(config.bridgeAddress, BRIDGE_ABI, relayerSigner);
        
        // Verify relayer is authorized
        const isRelayer = await bridge.relayers(await relayerSigner.getAddress());
        if (!isRelayer) {
            return {
                success: false,
                destinationChainId,
                recipient,
                amount,
                estimatedTime: 0,
                error: 'Relayer not authorized'
            };
        }

        // Process withdrawal
        const tx = await bridge.processWithdrawal(proof, withdrawalHash, recipient, amount);
        const receipt = await tx.wait();

        return {
            success: true,
            transactionHash: receipt.hash,
            destinationChainId,
            recipient,
            amount,
            estimatedTime: 0 // Already complete
        };
    } catch (error: any) {
        return {
            success: false,
            destinationChainId,
            recipient,
            amount,
            estimatedTime: 0,
            error: error.message
        };
    }
}

/**
 * Get estimated bridge time based on chain type
 */
function getEstimatedBridgeTime(category: 'evm' | 'bitcoin' | 'solana'): number {
    switch (category) {
        case 'evm': return 300; // 5 minutes for EVM L2s
        case 'bitcoin': return 600; // 10 minutes for Bitcoin L2s
        case 'solana': return 60; // 1 minute for Solana
        default: return 300;
    }
}

/**
 * Create the Bridge Coordinator agent node
 */
export function createBridgeCoordinatorNode() {
    return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
        const { intent } = state;

        // Check if this is a bridge intent
        if (!intent || intent.type !== 'bridge') {
            return {
                currentStep: "parse_intent",
                messages: ["Not a bridge operation, skipping bridge coordinator"]
            };
        }

        const bridgeIntent = intent as BridgeIntent;

        // Validate bridge intent
        if (!bridgeIntent.sourceChainId || !bridgeIntent.destinationChainId) {
            return {
                errors: ["Invalid bridge intent: missing source or destination chain"],
                currentStep: "error"
            };
        }

        // Get chain configurations
        const sourceConfig = getBridgeConfig(bridgeIntent.sourceChainId);
        const destConfig = getBridgeConfig(bridgeIntent.destinationChainId);

        if (!sourceConfig && bridgeIntent.direction === 'deposit') {
            return {
                errors: [`Unsupported source chain: ${bridgeIntent.sourceChainId}`],
                currentStep: "error"
            };
        }

        if (!destConfig && bridgeIntent.direction === 'withdraw') {
            return {
                errors: [`Unsupported destination chain: ${bridgeIntent.destinationChainId}`],
                currentStep: "error"
            };
        }

        // Calculate fees
        const amount = BigInt(bridgeIntent.amount || '0');
        const bridgeFee = amount / 500n; // 0.2% bridge fee
        const relayerFee = amount / 2000n; // 0.05% relayer fee
        const totalFee = bridgeFee + relayerFee;
        const netAmount = amount - totalFee;

        // Log bridge operation
        const messages = [
            `🌉 Bridge Operation Initiated`,
            `   Direction: ${bridgeIntent.direction}`,
            `   Source: ${sourceConfig?.name || bridgeIntent.sourceChainId}`,
            `   Destination: ${destConfig?.name || bridgeIntent.destinationChainId}`,
            `   Amount: ${bridgeIntent.amount}`,
            `   Bridge Fee: ${bridgeFee.toString()}`,
            `   Relayer Fee: ${relayerFee.toString()}`,
            `   Net Amount: ${netAmount.toString()}`
        ];

        // Update state with bridge info
        const bridgeStatus = {
            state: 'pending' as const,
            sourceChainId: bridgeIntent.sourceChainId,
            destinationChainId: bridgeIntent.destinationChainId,
            amount: amount.toString(),
            fee: totalFee.toString(),
            estimatedTime: getEstimatedBridgeTime(sourceConfig?.category || destConfig?.category || 'evm')
        };

        return {
            messages,
            bridgeStatus,
            currentStep: "generate_proof"
        };
    };
}

/**
 * Create the Bridge Relayer node
 * This node handles relaying bridge transactions between chains
 */
export function createBridgeRelayerNode() {
    return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
        const { bridgeStatus, proofStatus } = state;

        if (!bridgeStatus || bridgeStatus.state !== 'awaiting_relay') {
            return {
                currentStep: "submit_transaction",
                messages: ["Bridge not ready for relay"]
            };
        }

        if (!proofStatus?.proof) {
            return {
                errors: ["No proof available for bridge relay"],
                currentStep: "error"
            };
        }

        // In production, this would:
        // 1. Listen for deposit events on source chain
        // 2. Generate inclusion proofs
        // 3. Submit to destination chain
        // 4. Update bridge status

        return {
            bridgeStatus: {
                ...bridgeStatus,
                state: 'relaying'
            },
            messages: ["🔄 Relaying bridge transaction..."],
            currentStep: "monitor"
        };
    };
}

export default {
    createBridgeCoordinatorNode,
    createBridgeRelayerNode,
    createBridgeDeposit,
    processBridgeWithdrawal,
    getAvailableBridgeChains,
    getBridgeConfig,
    TESTNET_BRIDGES
};