/**
 * Cash.io Bridge Note Integration
 * 
 * Connects the note system with cross-chain bridge operations.
 * Enables seamless shielded cross-chain transfers.
 */

import { ethers } from "ethers";
import { CashNote, createNote, serializeNote, deserializeNote } from "./note.js";

/**
 * Bridge note - extends CashNote with bridge-specific data
 */
export interface BridgeNote extends CashNote {
    sourceChainId: number;
    destinationChainId: number;
    bridgeDepositTxHash?: string;
    bridgeWithdrawTxHash?: string;
    hubRecordTxHash?: string;
    status: 'pending' | 'deposited' | 'claimed' | 'withdrawn';
    createdAt: number;
}

/**
 * Bridge deposit parameters
 */
export interface BridgeDepositParams {
    sourceChainId: number;
    destinationChainId: number;
    amount: bigint;
    bridgeAddress: string;
    signer: ethers.Signer;
}

/**
 * Bridge withdrawal parameters
 */
export interface BridgeWithdrawParams {
    note: BridgeNote;
    destinationChainId: number;
    recipient: string;
    bridgeAddress: string;
    proof: string;
    signer: ethers.Signer;
}

/**
 * Bridge contract ABI
 */
const BRIDGE_ABI = [
    "function deposit(bytes32 _commitment) external payable",
    "function processWithdrawal(bytes calldata _proof, bytes32 _withdrawalHash, address _recipient, uint256 _amount) external",
    "event Deposited(address indexed depositor, bytes32 indexed commitment, uint256 amount, uint256 indexed nonce)"
];

/**
 * Create a note for bridge deposit
 * This generates a new shielded note that will be deposited to a bridge contract
 */
export async function createBridgeNote(
    amount: bigint,
    sourceChainId: number,
    destinationChainId: number
): Promise<BridgeNote> {
    const note = await createNote(amount);
    
    return {
        ...note,
        sourceChainId,
        destinationChainId,
        status: 'pending',
        createdAt: Date.now()
    };
}

/**
 * Execute bridge deposit
 * Deposits funds to source chain bridge and returns the note for claiming
 */
export async function executeBridgeDeposit(
    params: BridgeDepositParams
): Promise<{ note: BridgeNote; txHash: string }> {
    const { sourceChainId, destinationChainId, amount, bridgeAddress, signer } = params;
    
    // Create the bridge note
    const note = await createBridgeNote(amount, sourceChainId, destinationChainId);
    
    // Connect to bridge contract
    const bridge = new ethers.Contract(bridgeAddress, BRIDGE_ABI, signer);
    
    // Execute deposit
    const tx = await bridge.deposit(note.commitment, { value: amount });
    const receipt = await tx.wait();
    
    // Update note with deposit tx hash
    note.bridgeDepositTxHash = receipt.hash;
    note.status = 'deposited';
    
    return { note, txHash: receipt.hash };
}

/**
 * Claim bridge note on hub chain
 * After deposit is finalized on source chain, claim the shielded note on hub
 */
export async function claimBridgeNote(
    note: BridgeNote,
    shieldedPoolAddress: string,
    proof: string,
    signer: ethers.Signer
): Promise<{ note: BridgeNote; txHash: string }> {
    const SHIELDED_POOL_ABI = [
        "function processDeposit(bytes32 _commitment, uint256 _amount, bytes32 _sourceChainTxHash, uint256 _sourceChainId) external"
    ];
    
    const pool = new ethers.Contract(shieldedPoolAddress, SHIELDED_POOL_ABI, signer);
    
    const tx = await pool.processDeposit(
        note.commitment,
        note.amount,
        note.bridgeDepositTxHash || ethers.ZeroHash,
        note.sourceChainId
    );
    const receipt = await tx.wait();
    
    note.hubRecordTxHash = receipt.hash;
    note.status = 'claimed';
    
    return { note, txHash: receipt.hash };
}

/**
 * Execute bridge withdrawal
 * Withdraw from hub and receive funds on destination chain
 */
export async function executeBridgeWithdrawal(
    params: BridgeWithdrawParams
): Promise<{ txHash: string }> {
    const { note, destinationChainId, recipient, bridgeAddress, proof, signer } = params;
    
    const bridge = new ethers.Contract(bridgeAddress, BRIDGE_ABI, signer);
    
    // Generate withdrawal hash
    const withdrawalHash = ethers.keccak256(
        ethers.solidityPacked(
            ['bytes32', 'address', 'uint256'],
            [note.commitment, recipient, note.amount]
        )
    );
    
    // Execute withdrawal
    const tx = await bridge.processWithdrawal(
        proof,
        withdrawalHash,
        recipient,
        note.amount
    );
    const receipt = await tx.wait();
    
    note.bridgeWithdrawTxHash = receipt.hash;
    note.status = 'withdrawn';
    
    return { txHash: receipt.hash };
}

/**
 * Serialize bridge note for storage
 */
export function serializeBridgeNote(note: BridgeNote): string {
    return JSON.stringify({
        amount: note.amount.toString(),
        secret: note.secret.toString(),
        nullifierSeed: note.nullifierSeed.toString(),
        commitment: note.commitment,
        sourceChainId: note.sourceChainId,
        destinationChainId: note.destinationChainId,
        bridgeDepositTxHash: note.bridgeDepositTxHash,
        bridgeWithdrawTxHash: note.bridgeWithdrawTxHash,
        hubRecordTxHash: note.hubRecordTxHash,
        status: note.status,
        createdAt: note.createdAt
    });
}

/**
 * Deserialize bridge note from storage
 */
export function deserializeBridgeNote(serialized: string): BridgeNote {
    const data = JSON.parse(serialized);
    return {
        amount: BigInt(data.amount),
        secret: BigInt(data.secret),
        nullifierSeed: BigInt(data.nullifierSeed),
        commitment: data.commitment,
        sourceChainId: data.sourceChainId,
        destinationChainId: data.destinationChainId,
        bridgeDepositTxHash: data.bridgeDepositTxHash,
        bridgeWithdrawTxHash: data.bridgeWithdrawTxHash,
        hubRecordTxHash: data.hubRecordTxHash,
        status: data.status,
        createdAt: data.createdAt
    };
}

/**
 * Calculate bridge fees
 */
export interface BridgeFees {
    bridgeFee: bigint;      // 0.2% to protocol
    relayerFee: bigint;     // 0.05% to relayers
    gasFee: bigint;         // Estimated gas costs
    totalFee: bigint;
    netAmount: bigint;
}

export function calculateBridgeFees(amount: bigint, gasCostEstimate?: bigint): BridgeFees {
    const bridgeFee = amount / 500n; // 0.2%
    const relayerFee = amount / 2000n; // 0.05%
    const gasFee = gasCostEstimate || 0n;
    const totalFee = bridgeFee + relayerFee + gasFee;
    const netAmount = amount - totalFee;
    
    return {
        bridgeFee,
        relayerFee,
        gasFee,
        totalFee,
        netAmount
    };
}

/**
 * Get estimated bridge time in seconds
 */
export function getEstimatedBridgeTime(
    sourceChainId: number,
    destinationChainId: number
): number {
    // Bitcoin L2s take longer due to Bitcoin block times
    const bitcoinL2s = [30, 31, 60808, 111, 4200, 686868, 200901, 200810, 1116, 1115];
    
    if (bitcoinL2s.includes(sourceChainId) || bitcoinL2s.includes(destinationChainId)) {
        return 600; // 10 minutes for Bitcoin L2s
    }
    
    // Solana is faster
    if (sourceChainId === 990000 || sourceChainId === 990001 || 
        destinationChainId === 990000 || destinationChainId === 990001) {
        return 60; // 1 minute for Solana
    }
    
    // Default EVM chains
    return 300; // 5 minutes for standard EVM
}

/**
 * Bridge chain configurations (matching deployed contracts)
 */
export const BRIDGE_CHAINS = {
    // Testnets
    sepolia: { chainId: 11155111, name: 'Sepolia', category: 'evm', hubChainId: 41021 },
    rskTestnet: { chainId: 31, name: 'RSK Testnet', category: 'bitcoin', hubChainId: 41021 },
    arbitrumSepolia: { chainId: 421614, name: 'Arbitrum Sepolia', category: 'evm', hubChainId: 41021 },
    optimismSepolia: { chainId: 11155420, name: 'Optimism Sepolia', category: 'evm', hubChainId: 41021 },
    baseSepolia: { chainId: 84532, name: 'Base Sepolia', category: 'evm', hubChainId: 41021 },
    polygonAmoy: { chainId: 80002, name: 'Polygon Amoy', category: 'evm', hubChainId: 41021 },
    
    // Hub chains
    cashioMainnet: { chainId: 4102, name: 'Cash.io Hub', category: 'hub', hubChainId: 4102 },
    cashioTestnet: { chainId: 41021, name: 'Cash.io Testnet', category: 'hub', hubChainId: 41021 },
} as const;

export default {
    createBridgeNote,
    executeBridgeDeposit,
    claimBridgeNote,
    executeBridgeWithdrawal,
    serializeBridgeNote,
    deserializeBridgeNote,
    calculateBridgeFees,
    getEstimatedBridgeTime,
    BRIDGE_CHAINS
};