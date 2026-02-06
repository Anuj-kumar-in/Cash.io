/**
 * Cash.io ZK Prover
 * 
 * Handles ZK proof generation for privacy transactions.
 */

import * as snarkjs from "snarkjs";

/**
 * Proof data structure
 */
export interface Proof {
    proof: string;
    publicSignals: string[];
}

/**
 * Deposit proof inputs
 */
export interface DepositProofInputs {
    commitment: string;
    depositAmount: bigint;
    secret: bigint;
    amount: bigint;
}

/**
 * Withdraw proof inputs
 */
export interface WithdrawProofInputs {
    root: string;
    nullifier: string;
    recipient: string;
    relayer: string;
    fee: bigint;
    secret: bigint;
    amount: bigint;
    leafIndex: number;
    pathElements: string[];
    pathIndices: number[];
}

/**
 * Transfer proof inputs
 */
export interface TransferProofInputs {
    root: string;
    nullifier1: string;
    nullifier2: string;
    newCommitment1: string;
    newCommitment2: string;
    // Input 1
    secret1: bigint;
    amount1: bigint;
    leafIndex1: number;
    pathElements1: string[];
    pathIndices1: number[];
    // Input 2
    secret2: bigint;
    amount2: bigint;
    leafIndex2: number;
    pathElements2: string[];
    pathIndices2: number[];
    // Outputs
    newAmount1: bigint;
    newAmount2: bigint;
    newSecret1: bigint;
    newSecret2: bigint;
}

/**
 * Union type for all proof inputs
 */
export type ProofInputs = DepositProofInputs | WithdrawProofInputs | TransferProofInputs;

/**
 * ZK Prover class
 */
export class ZKProver {
    private proverUrl?: string;
    private circuitPaths?: {
        deposit?: string;
        withdraw?: string;
        transfer?: string;
    };

    constructor(
        proverUrl?: string,
        circuitPaths?: { deposit?: string; withdraw?: string; transfer?: string }
    ) {
        this.proverUrl = proverUrl;
        this.circuitPaths = circuitPaths;
    }

    /**
     * Generate deposit proof
     */
    async generateDepositProof(inputs: DepositProofInputs): Promise<Proof> {
        const circuitInputs = {
            commitment: BigInt(inputs.commitment),
            depositAmount: inputs.depositAmount,
            secret: inputs.secret,
            amount: inputs.amount,
        };

        return this.generateProof("deposit", circuitInputs);
    }

    /**
     * Generate withdrawal proof
     */
    async generateWithdrawProof(inputs: WithdrawProofInputs): Promise<Proof> {
        const circuitInputs = {
            root: BigInt(inputs.root),
            nullifier: BigInt(inputs.nullifier),
            recipient: BigInt(inputs.recipient),
            relayer: BigInt(inputs.relayer),
            fee: inputs.fee,
            secret: inputs.secret,
            amount: inputs.amount,
            leafIndex: inputs.leafIndex,
            pathElements: inputs.pathElements.map(e => BigInt(e)),
            pathIndices: inputs.pathIndices,
        };

        return this.generateProof("withdraw", circuitInputs);
    }

    /**
     * Generate transfer proof
     */
    async generateTransferProof(inputs: TransferProofInputs): Promise<Proof> {
        const circuitInputs = {
            root: BigInt(inputs.root),
            nullifier1: BigInt(inputs.nullifier1),
            nullifier2: BigInt(inputs.nullifier2),
            newCommitment1: BigInt(inputs.newCommitment1),
            newCommitment2: BigInt(inputs.newCommitment2),
            // Input 1
            secret1: inputs.secret1,
            amount1: inputs.amount1,
            leafIndex1: inputs.leafIndex1,
            pathElements1: inputs.pathElements1.map(e => BigInt(e)),
            pathIndices1: inputs.pathIndices1,
            // Input 2
            secret2: inputs.secret2,
            amount2: inputs.amount2,
            leafIndex2: inputs.leafIndex2,
            pathElements2: inputs.pathElements2.map(e => BigInt(e)),
            pathIndices2: inputs.pathIndices2,
            // Outputs
            newAmount1: inputs.newAmount1,
            newAmount2: inputs.newAmount2,
            newSecret1: inputs.newSecret1,
            newSecret2: inputs.newSecret2,
        };

        return this.generateProof("transfer", circuitInputs);
    }

    /**
     * Generate proof using remote prover or locally
     */
    private async generateProof(
        circuitType: "deposit" | "withdraw" | "transfer",
        inputs: Record<string, any>
    ): Promise<Proof> {
        // Try remote prover first
        if (this.proverUrl) {
            try {
                return await this.generateProofRemote(circuitType, inputs);
            } catch (error) {
                console.warn("Remote prover failed, falling back to local:", error);
            }
        }

        // Fall back to local proving
        return this.generateProofLocal(circuitType, inputs);
    }

    /**
     * Generate proof using remote prover service
     */
    private async generateProofRemote(
        circuitType: string,
        inputs: Record<string, any>
    ): Promise<Proof> {
        const response = await fetch(`${this.proverUrl}/prove/${circuitType}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                inputs: this.serializeInputs(inputs),
            }),
        });

        if (!response.ok) {
            throw new Error(`Prover request failed: ${response.status}`);
        }

        const result = await response.json();
        return {
            proof: result.proof,
            publicSignals: result.publicSignals,
        };
    }

    /**
     * Generate proof locally using snarkjs
     */
    private async generateProofLocal(
        circuitType: string,
        inputs: Record<string, any>
    ): Promise<Proof> {
        const circuitPath = this.circuitPaths?.[circuitType as keyof typeof this.circuitPaths];
        if (!circuitPath) {
            throw new Error(`No circuit path configured for ${circuitType}`);
        }

        const wasmPath = `${circuitPath}/${circuitType}_js/${circuitType}.wasm`;
        const zkeyPath = `${circuitPath}/${circuitType}_final.zkey`;

        // Generate proof using snarkjs
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            inputs,
            wasmPath,
            zkeyPath
        );

        // Format proof for Solidity verifier
        const formattedProof = this.formatProofForSolidity(proof);

        return {
            proof: formattedProof,
            publicSignals: publicSignals.map((s: any) => s.toString()),
        };
    }

    /**
     * Format proof for Solidity verifier
     */
    private formatProofForSolidity(proof: any): string {
        const pA = proof.pi_a.slice(0, 2);
        const pB = proof.pi_b.slice(0, 2).map((p: any) => p.reverse());
        const pC = proof.pi_c.slice(0, 2);

        // Encode as bytes
        const abiCoder = new (require("ethers").AbiCoder)();
        return abiCoder.encode(
            ["uint256[2]", "uint256[2][2]", "uint256[2]"],
            [pA, pB, pC]
        );
    }

    /**
     * Serialize inputs for JSON transport
     */
    private serializeInputs(inputs: Record<string, any>): Record<string, string | string[]> {
        const serialized: Record<string, string | string[]> = {};

        for (const [key, value] of Object.entries(inputs)) {
            if (Array.isArray(value)) {
                serialized[key] = value.map(v => v.toString());
            } else {
                serialized[key] = value.toString();
            }
        }

        return serialized;
    }

    /**
     * Verify a proof
     */
    async verifyProof(
        circuitType: "deposit" | "withdraw" | "transfer",
        proof: string,
        publicSignals: string[]
    ): Promise<boolean> {
        const circuitPath = this.circuitPaths?.[circuitType];
        if (!circuitPath) {
            throw new Error(`No circuit path configured for ${circuitType}`);
        }

        const vkeyPath = `${circuitPath}/${circuitType}_vkey.json`;
        const vkey = await import(vkeyPath, { assert: { type: "json" } });

        // Decode proof
        const abiCoder = new (require("ethers").AbiCoder)();
        const [pA, pB, pC] = abiCoder.decode(
            ["uint256[2]", "uint256[2][2]", "uint256[2]"],
            proof
        );

        const snarkjsProof = {
            pi_a: [...pA, "1"],
            pi_b: [pB[0].reverse(), pB[1].reverse(), ["1", "0"]],
            pi_c: [...pC, "1"],
            protocol: "groth16",
            curve: "bn128",
        };

        return snarkjs.groth16.verify(
            vkey.default,
            publicSignals,
            snarkjsProof
        );
    }
}
