/**
 * Cash.io Account Abstraction Client
 * 
 * Handles ERC-4337 smart account operations.
 */

import { ethers } from "ethers";

/**
 * AA Client configuration
 */
export interface AAConfig {
    bundlerUrl: string;
    entryPointAddress: string;
    paymasterAddress: string;
    accountFactoryAddress: string;
}

/**
 * User Operation structure
 */
export interface PackedUserOperation {
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
 * User Operation receipt
 */
export interface UserOperationReceipt {
    userOpHash: string;
    transactionHash: string;
    blockNumber: number;
    actualGasUsed: string;
    success: boolean;
}

/**
 * Send operation params
 */
export interface SendOperationParams {
    target: string;
    value: bigint;
    callData: string;
    signer: ethers.Signer;
}

/**
 * Account Abstraction Client
 */
export class AccountAbstractionClient {
    private config: AAConfig;
    private accountAddress: string | null = null;

    constructor(config: AAConfig) {
        this.config = config;
    }

    /**
     * Create a new smart account
     */
    async createAccount(
        owner: string,
        guardians: string[],
        recoveryThreshold: number,
        dailySpendLimit: bigint
    ): Promise<string> {
        const factoryInterface = new ethers.Interface([
            "function createAccount(address owner, address[] guardians, uint256 threshold, uint256 spendLimit, uint256 salt) returns (address)",
            "function getAddress(address owner, address[] guardians, uint256 threshold, uint256 spendLimit, uint256 salt) view returns (address)",
        ]);

        // Get counterfactual address
        const salt = Date.now();
        const address = await this.getAccountAddress(owner, guardians, recoveryThreshold, dailySpendLimit, salt);

        this.accountAddress = address;
        return address;
    }

    /**
     * Get counterfactual account address
     */
    async getAccountAddress(
        owner: string,
        guardians: string[] = [],
        recoveryThreshold: number = 1,
        dailySpendLimit: bigint = ethers.parseEther("100"),
        salt: number = 0
    ): Promise<string> {
        const response = await fetch(this.config.bundlerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{
                    to: this.config.accountFactoryAddress,
                    data: new ethers.Interface([
                        "function getAddress(address,address[],uint256,uint256,uint256) view returns (address)"
                    ]).encodeFunctionData("getAddress", [
                        owner,
                        guardians,
                        recoveryThreshold,
                        dailySpendLimit,
                        salt
                    ]),
                }, "latest"],
                id: 1,
            }),
        });

        const result = await response.json();
        return ethers.getAddress("0x" + result.result.slice(-40));
    }

    /**
     * Send a UserOperation
     */
    async sendUserOperation(params: SendOperationParams): Promise<UserOperationReceipt> {
        const { target, value, callData, signer } = params;

        // Get sender address
        const sender = this.accountAddress || await signer.getAddress();

        // Build account execute calldata
        const accountInterface = new ethers.Interface([
            "function execute(address target, uint256 value, bytes calldata data) external",
        ]);

        const executeData = accountInterface.encodeFunctionData("execute", [
            target,
            value,
            callData,
        ]);

        // Build UserOperation
        const userOp = await this.buildUserOperation(sender, executeData);

        // Sign UserOperation
        const signedUserOp = await this.signUserOperation(userOp, signer);

        // Submit to bundler
        const userOpHash = await this.submitUserOperation(signedUserOp);

        // Wait for receipt
        const receipt = await this.waitForReceipt(userOpHash);

        return receipt;
    }

    /**
     * Build a UserOperation
     */
    private async buildUserOperation(
        sender: string,
        callData: string
    ): Promise<PackedUserOperation> {
        // Get nonce
        const nonce = await this.getNonce(sender);

        // Estimate gas
        const gasEstimate = await this.estimateGas(sender, callData);

        // Get fee data
        const feeData = await this.getFeeData();

        // Build paymaster data
        const paymasterData = await this.getPaymasterData(sender, callData);

        return {
            sender,
            nonce: ethers.toBeHex(nonce),
            initCode: "0x", // Account already deployed
            callData,
            callGasLimit: ethers.toBeHex(gasEstimate.callGasLimit),
            verificationGasLimit: ethers.toBeHex(gasEstimate.verificationGasLimit),
            preVerificationGas: ethers.toBeHex(gasEstimate.preVerificationGas),
            maxFeePerGas: ethers.toBeHex(feeData.maxFeePerGas),
            maxPriorityFeePerGas: ethers.toBeHex(feeData.maxPriorityFeePerGas),
            paymasterAndData: paymasterData,
            signature: "0x",
        };
    }

    /**
     * Sign a UserOperation
     */
    private async signUserOperation(
        userOp: PackedUserOperation,
        signer: ethers.Signer
    ): Promise<PackedUserOperation> {
        // Compute UserOperation hash
        const userOpHash = this.getUserOpHash(userOp);

        // Sign
        const signature = await signer.signMessage(ethers.getBytes(userOpHash));

        return {
            ...userOp,
            signature,
        };
    }

    /**
     * Compute UserOperation hash
     */
    private getUserOpHash(userOp: PackedUserOperation): string {
        const packed = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
            [
                userOp.sender,
                userOp.nonce,
                ethers.keccak256(userOp.initCode),
                ethers.keccak256(userOp.callData),
                userOp.callGasLimit,
                userOp.verificationGasLimit,
                userOp.preVerificationGas,
                userOp.maxFeePerGas,
                userOp.maxPriorityFeePerGas,
                ethers.keccak256(userOp.paymasterAndData),
            ]
        );

        return ethers.keccak256(packed);
    }

    /**
     * Submit UserOperation to bundler
     */
    private async submitUserOperation(userOp: PackedUserOperation): Promise<string> {
        const response = await fetch(this.config.bundlerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_sendUserOperation",
                params: [userOp, this.config.entryPointAddress],
                id: 1,
            }),
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.result;
    }

    /**
     * Wait for UserOperation receipt
     */
    private async waitForReceipt(
        userOpHash: string,
        maxAttempts: number = 60,
        delayMs: number = 2000
    ): Promise<UserOperationReceipt> {
        for (let i = 0; i < maxAttempts; i++) {
            const receipt = await this.getReceipt(userOpHash);
            if (receipt) {
                return receipt;
            }
            await new Promise(r => setTimeout(r, delayMs));
        }

        throw new Error("UserOperation not mined");
    }

    /**
     * Get UserOperation receipt
     */
    private async getReceipt(userOpHash: string): Promise<UserOperationReceipt | null> {
        const response = await fetch(this.config.bundlerUrl, {
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

        if (!result.result) {
            return null;
        }

        return {
            userOpHash,
            transactionHash: result.result.receipt.transactionHash,
            blockNumber: parseInt(result.result.receipt.blockNumber, 16),
            actualGasUsed: result.result.actualGasUsed,
            success: result.result.success,
        };
    }

    /**
     * Get account nonce
     */
    private async getNonce(sender: string): Promise<number> {
        const response = await fetch(this.config.bundlerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{
                    to: this.config.entryPointAddress,
                    data: new ethers.Interface([
                        "function getNonce(address sender, uint192 key) view returns (uint256)"
                    ]).encodeFunctionData("getNonce", [sender, 0]),
                }, "latest"],
                id: 1,
            }),
        });

        const result = await response.json();
        return parseInt(result.result, 16);
    }

    /**
     * Estimate gas for UserOperation
     */
    private async estimateGas(
        sender: string,
        callData: string
    ): Promise<{
        callGasLimit: number;
        verificationGasLimit: number;
        preVerificationGas: number;
    }> {
        // Default estimates (in production: call eth_estimateUserOperationGas)
        return {
            callGasLimit: 500000,
            verificationGasLimit: 500000,
            preVerificationGas: 50000,
        };
    }

    /**
     * Get current fee data
     */
    private async getFeeData(): Promise<{
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
    }> {
        // Default fees (in production: query network)
        return {
            maxFeePerGas: ethers.parseUnits("10", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
        };
    }

    /**
     * Get paymaster data for gas sponsorship
     */
    private async getPaymasterData(
        sender: string,
        callData: string
    ): Promise<string> {
        // Return just the paymaster address for now
        // In production: get signed paymaster data
        return this.config.paymasterAddress;
    }
}
