/**
 * Transaction Submitter Node
 * 
 * Submits transactions via ERC-4337 Account Abstraction bundler.
 * Handles UserOperation creation, paymaster integration, and monitoring.
 */

import { ethers } from "ethers";
import { AgentStateType, TransactionStatus } from "../state/agentState.js";

/**
 * ERC-4337 UserOperation structure
 */
interface UserOperation {
    sender: string;
    nonce: string;
    initCode: string;
    callData: string;
    callGasLimit: string;
    verificationGasLimit: string;
    preVerificationGas: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    paymasterAndData: string;
    signature: string;
}

/**
 * Bundler configuration
 */
interface BundlerConfig {
    url: string;
    entryPointAddress: string;
    chainId: number;
}

/**
 * Default bundler configurations
 */
const BUNDLER_CONFIGS: Record<string, BundlerConfig> = {
    subnet: {
        url: process.env.SUBNET_BUNDLER_URL || "http://localhost:4337",
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        chainId: parseInt(process.env.SUBNET_CHAIN_ID || "43114"),
    },
    sepolia: {
        url: process.env.SEPOLIA_BUNDLER_URL || "https://api.pimlico.io/v2/sepolia/rpc",
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        chainId: 11155111,
    },
};

/**
 * Create the transaction submitter node
 */
export function createTransactionSubmitterNode() {
    return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
        const { intent, proofStatus, transactionStatus } = state;

        // Check prerequisites
        if (!intent) {
            return {
                errors: ["No intent available for transaction submission"],
                currentStep: "error",
            };
        }

        if (!proofStatus || proofStatus.state !== "completed") {
            return {
                errors: ["Proof not ready for transaction submission"],
                currentStep: "awaiting_proof",
            };
        }

        // Check if already submitted
        if (transactionStatus?.state === "submitted" || transactionStatus?.state === "confirmed") {
            return {
                messages: ["ℹ️ Transaction already submitted"],
                currentStep: transactionStatus.state === "confirmed" ? "completed" : "awaiting_confirmation",
            };
        }

        try {
            // Build the UserOperation
            const userOp = await buildUserOperation(intent, proofStatus.proof!, proofStatus.publicInputs!);

            // Get bundler config
            const bundlerConfig = BUNDLER_CONFIGS.subnet;

            // Submit to bundler
            const userOpHash = await submitUserOperation(userOp, bundlerConfig);

            const submittedStatus: TransactionStatus = {
                state: "submitted",
                userOpHash,
            };

            return {
                transactionStatus: submittedStatus,
                messages: [`📤 UserOperation submitted: ${userOpHash.slice(0, 18)}...`],
                currentStep: "awaiting_confirmation",
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";

            // Check if we should retry
            if (state.retryCount < state.maxRetries) {
                return {
                    retryCount: state.retryCount + 1,
                    messages: [`⚠️ Submission failed, retrying (${state.retryCount + 1}/${state.maxRetries}): ${errorMessage}`],
                    currentStep: "submission_retry",
                };
            }

            const failedStatus: TransactionStatus = {
                state: "failed",
                error: errorMessage,
            };

            return {
                transactionStatus: failedStatus,
                errors: [`Transaction submission failed: ${errorMessage}`],
                currentStep: "error",
            };
        }
    };
}

/**
 * Build a UserOperation from intent and proof
 */
async function buildUserOperation(
    intent: any,
    proof: string,
    publicInputs: string[]
): Promise<UserOperation> {
    // Get account address (in production: from user's smart account)
    const sender = process.env.SMART_ACCOUNT_ADDRESS || "0x0000000000000000000000000000000000000001";

    // Build calldata based on intent type
    let callData: string;
    const shieldedPoolAddress = process.env.SHIELDED_POOL_ADDRESS || "0x0000000000000000000000000000000000000002";
    const shieldedPoolInterface = new ethers.Interface([
        "function deposit(bytes32 commitment) external payable",
        "function withdraw(bytes calldata proof, bytes32 root, bytes32 nullifier, address recipient, address relayer, uint256 fee) external",
        "function privateTransfer(bytes calldata proof, bytes32 root, bytes32 nullifier1, bytes32 nullifier2, bytes32 newCommitment1, bytes32 newCommitment2) external",
    ]);

    const accountInterface = new ethers.Interface([
        "function execute(address target, uint256 value, bytes calldata data) external",
    ]);

    switch (intent.type) {
        case "deposit":
            const depositCalldata = shieldedPoolInterface.encodeFunctionData("deposit", [
                publicInputs[0] || ethers.ZeroHash, // commitment
            ]);
            callData = accountInterface.encodeFunctionData("execute", [
                shieldedPoolAddress,
                ethers.parseEther(intent.amount || "0.1"),
                depositCalldata,
            ]);
            break;

        case "withdraw":
            const withdrawCalldata = shieldedPoolInterface.encodeFunctionData("withdraw", [
                proof,
                publicInputs[0] || ethers.ZeroHash, // root
                publicInputs[1] || ethers.ZeroHash, // nullifier
                intent.recipient || sender,
                ethers.ZeroAddress, // no relayer
                0, // no fee
            ]);
            callData = accountInterface.encodeFunctionData("execute", [
                shieldedPoolAddress,
                0,
                withdrawCalldata,
            ]);
            break;

        case "transfer":
        case "bridge":
            const transferCalldata = shieldedPoolInterface.encodeFunctionData("privateTransfer", [
                proof,
                publicInputs[0] || ethers.ZeroHash, // root
                publicInputs[1] || ethers.ZeroHash, // nullifier1
                publicInputs[2] || ethers.ZeroHash, // nullifier2  
                publicInputs[3] || ethers.ZeroHash, // newCommitment1
                publicInputs[4] || ethers.ZeroHash, // newCommitment2
            ]);
            callData = accountInterface.encodeFunctionData("execute", [
                shieldedPoolAddress,
                0,
                transferCalldata,
            ]);
            break;

        default:
            throw new Error(`Unsupported intent type: ${intent.type}`);
    }

    // Get paymaster data (for zero-fee)
    const paymasterAddress = process.env.PAYMASTER_ADDRESS || "0x0000000000000000000000000000000000000003";
    const paymasterAndData = paymasterAddress; // In production: include signature

    return {
        sender,
        nonce: "0x0",
        initCode: "0x",
        callData,
        callGasLimit: ethers.toBeHex(500000),
        verificationGasLimit: ethers.toBeHex(500000),
        preVerificationGas: ethers.toBeHex(50000),
        maxFeePerGas: ethers.toBeHex(ethers.parseUnits("10", "gwei")),
        maxPriorityFeePerGas: ethers.toBeHex(ethers.parseUnits("1", "gwei")),
        paymasterAndData,
        signature: "0x", // Will be filled by signing
    };
}

/**
 * Submit UserOperation to bundler
 */
async function submitUserOperation(
    userOp: UserOperation,
    config: BundlerConfig
): Promise<string> {
    // In production: call bundler JSON-RPC
    // eth_sendUserOperation

    const response = await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_sendUserOperation",
            params: [userOp, config.entryPointAddress],
            id: 1,
        }),
    });

    if (!response.ok) {
        throw new Error(`Bundler request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
        throw new Error(result.error.message || "Bundler returned error");
    }

    return result.result as string;
}

/**
 * Create a transaction monitor node
 */
export function createTransactionMonitorNode() {
    return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
        const { transactionStatus } = state;

        if (!transactionStatus?.userOpHash) {
            return {
                errors: ["No UserOperation hash to monitor"],
                currentStep: "error",
            };
        }

        if (transactionStatus.state === "confirmed") {
            return {
                messages: ["✅ Transaction already confirmed"],
                currentStep: "completed",
            };
        }

        try {
            // Poll for transaction receipt
            const receipt = await pollForReceipt(transactionStatus.userOpHash);

            if (receipt) {
                const confirmedStatus: TransactionStatus = {
                    ...transactionStatus,
                    state: "confirmed",
                    transactionHash: receipt.transactionHash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed,
                };

                return {
                    transactionStatus: confirmedStatus,
                    messages: [`✅ Transaction confirmed in block ${receipt.blockNumber}`],
                    currentStep: "completed",
                };
            }

            // Not yet confirmed
            return {
                messages: ["⏳ Waiting for confirmation..."],
                currentStep: "awaiting_confirmation",
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                errors: [`Monitoring failed: ${errorMessage}`],
                currentStep: "error",
            };
        }
    };
}

/**
 * Poll for transaction receipt
 */
async function pollForReceipt(
    userOpHash: string,
    maxAttempts: number = 30,
    delayMs: number = 2000
): Promise<{ transactionHash: string; blockNumber: number; gasUsed: string } | null> {
    const bundlerConfig = BUNDLER_CONFIGS.subnet;

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(bundlerConfig.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_getUserOperationReceipt",
                    params: [userOpHash],
                    id: 1,
                }),
            });

            const result = await response.json();

            if (result.result) {
                return {
                    transactionHash: result.result.receipt.transactionHash,
                    blockNumber: parseInt(result.result.receipt.blockNumber, 16),
                    gasUsed: result.result.actualGasUsed,
                };
            }
        } catch {
            // Ignore errors and retry
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return null;
}
