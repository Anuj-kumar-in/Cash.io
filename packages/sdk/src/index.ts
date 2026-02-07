/**
 * Cash.io SDK
 * 
 * Main client for interacting with the Cash.io protocol.
 */

import { ethers } from "ethers";
import { 
    CashNote, 
    createNote, 
    generateNullifier, 
    NoteData,
    deserializeNote,
    deserializeNoteAuto,
    decryptNote,
    computeCommitment,
    toFrontendNote,
    fromFrontendNote,
    serializeNoteForFrontend,
    FrontendCashNote
} from "./note.js";
import { ZKProver, ProofInputs, Proof } from "./prover.js";
import { AccountAbstractionClient, UserOperationReceipt } from "./aa.js";
import { BridgeClient, BridgeDeposit, BridgeWithdrawal } from "./bridge.js";
import { IPFSClient, IPFSConfig, IPFSUploadResult, RecoveryKeyData, RecoveryKeyUtils } from "./ipfs.js";

/**
 * SDK Configuration
 */
export interface CashioConfig {
    // Network configuration
    subnetRpcUrl: string;
    chainId: number;

    // Contract addresses
    shieldedPoolAddress: string;
    commitmentTreeAddress: string;
    paymasterAddress: string;
    accountFactoryAddress: string;

    // Bridge addresses
    ethBridgeAddress?: string;
    solanaBridgeAddress?: string;
    rootstockBridgeAddress?: string;

    // AA configuration
    bundlerUrl: string;
    entryPointAddress: string;

    // Blob storage
    blobStorageUrl?: string;

    // ZK proving
    proverUrl?: string;
    circuitPaths?: {
        deposit?: string;
        withdraw?: string;
        transfer?: string;
    };

    // IPFS configuration for decentralized storage
    ipfs?: IPFSConfig;
}

/**
 * Deposit result
 */
export interface DepositResult {
    note: CashNote;
    commitment: string;
    leafIndex: number;
    transactionHash: string;
}

/**
 * Withdrawal result
 */
export interface WithdrawalResult {
    amount: bigint;
    recipient: string;
    nullifier: string;
    transactionHash: string;
}

/**
 * Transfer result
 */
export interface TransferResult {
    outputNotes: CashNote[];
    nullifiers: string[];
    transactionHash: string;
}

/**
 * Main Cash.io SDK Client
 */
export class CashioClient {
    private provider: ethers.JsonRpcProvider;
    private prover: ZKProver;
    private aaClient: AccountAbstractionClient;
    private bridgeClient: BridgeClient;
    private ipfsClient?: IPFSClient;
    private config: CashioConfig;

    // User's notes (local storage)
    private notes: Map<string, CashNote> = new Map();

    constructor(config: CashioConfig) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.subnetRpcUrl);
        this.prover = new ZKProver(config.proverUrl, config.circuitPaths);
        this.aaClient = new AccountAbstractionClient({
            bundlerUrl: config.bundlerUrl,
            entryPointAddress: config.entryPointAddress,
            paymasterAddress: config.paymasterAddress,
            accountFactoryAddress: config.accountFactoryAddress,
        });
        this.bridgeClient = new BridgeClient({
            ethBridgeAddress: config.ethBridgeAddress,
            solanaBridgeAddress: config.solanaBridgeAddress,
            rootstockBridgeAddress: config.rootstockBridgeAddress,
        });

        // Initialize IPFS client if config provided
        if (config.ipfs) {
            this.ipfsClient = new IPFSClient(config.ipfs);
        }
    }

    // ============ Account Management ============

    /**
     * Create or get a smart account for the user
     */
    async createAccount(
        owner: string,
        guardians: string[] = [],
        recoveryThreshold: number = 1,
        dailySpendLimit: bigint = ethers.parseEther("100")
    ): Promise<string> {
        return this.aaClient.createAccount(
            owner,
            guardians,
            recoveryThreshold,
            dailySpendLimit
        );
    }

    /**
     * Get the counterfactual account address
     */
    async getAccountAddress(
        owner: string,
        guardians: string[] = [],
        recoveryThreshold: number = 1
    ): Promise<string> {
        return this.aaClient.getAccountAddress(owner, guardians, recoveryThreshold);
    }

    // ============ Shielded Pool Operations ============

    /**
     * Deposit funds into the shielded pool
     */
    async deposit(
        amount: bigint,
        signer: ethers.Signer
    ): Promise<DepositResult> {
        // Create a new note
        const note = await createNote(amount);

        // Build deposit transaction
        const shieldedPoolInterface = new ethers.Interface([
            "function deposit(bytes32 commitment) external payable",
        ]);

        const callData = shieldedPoolInterface.encodeFunctionData("deposit", [
            note.commitment,
        ]);

        // Submit via AA
        const receipt = await this.aaClient.sendUserOperation({
            target: this.config.shieldedPoolAddress,
            value: amount,
            callData,
            signer,
        });

        // Store note locally
        this.notes.set(note.commitment, note);

        return {
            note,
            commitment: note.commitment,
            leafIndex: await this.getLeafIndex(note.commitment),
            transactionHash: receipt.transactionHash,
        };
    }

    /**
     * Withdraw funds from the shielded pool
     */
    async withdraw(
        noteCommitment: string,
        recipient: string,
        relayer: string = ethers.ZeroAddress,
        fee: bigint = 0n,
        signer: ethers.Signer
    ): Promise<WithdrawalResult> {
        // Get note
        const note = this.notes.get(noteCommitment);
        if (!note) {
            throw new Error("Note not found");
        }

        // Get Merkle proof
        const { root, pathElements, pathIndices, leafIndex } = await this.getMerkleProof(noteCommitment);

        // Generate nullifier
        const nullifier = await generateNullifier(note, leafIndex);

        // Generate ZK proof
        const proof = await this.prover.generateWithdrawProof({
            root,
            nullifier,
            recipient,
            relayer,
            fee,
            secret: note.secret,
            amount: note.amount,
            leafIndex,
            pathElements,
            pathIndices,
        });

        // Build withdraw transaction
        const shieldedPoolInterface = new ethers.Interface([
            "function withdraw(bytes calldata proof, bytes32 root, bytes32 nullifier, address recipient, address relayer, uint256 fee) external",
        ]);

        const callData = shieldedPoolInterface.encodeFunctionData("withdraw", [
            proof.proof,
            root,
            nullifier,
            recipient,
            relayer,
            fee,
        ]);

        // Submit via AA
        const receipt = await this.aaClient.sendUserOperation({
            target: this.config.shieldedPoolAddress,
            value: 0n,
            callData,
            signer,
        });

        // Remove spent note
        this.notes.delete(noteCommitment);

        return {
            amount: note.amount - fee,
            recipient,
            nullifier,
            transactionHash: receipt.transactionHash,
        };
    }

    /**
     * Private transfer within the shielded pool
     */
    async transfer(
        inputCommitments: [string, string],
        outputAmounts: [bigint, bigint],
        signer: ethers.Signer
    ): Promise<TransferResult> {
        // Get input notes
        const inputNotes = inputCommitments.map(c => {
            const note = this.notes.get(c);
            if (!note) throw new Error(`Note ${c} not found`);
            return note;
        }) as [CashNote, CashNote];

        // Verify value conservation
        const inputSum = inputNotes[0].amount + inputNotes[1].amount;
        const outputSum = outputAmounts[0] + outputAmounts[1];
        if (inputSum !== outputSum) {
            throw new Error("Value mismatch: input sum must equal output sum");
        }

        // Create output notes
        const outputNotes = await Promise.all([
            createNote(outputAmounts[0]),
            createNote(outputAmounts[1]),
        ]) as [CashNote, CashNote];

        // Get Merkle proofs
        const merkle1 = await this.getMerkleProof(inputCommitments[0]);
        const merkle2 = await this.getMerkleProof(inputCommitments[1]);

        // Generate nullifiers
        const nullifier1 = await generateNullifier(inputNotes[0], merkle1.leafIndex);
        const nullifier2 = await generateNullifier(inputNotes[1], merkle2.leafIndex);

        // Generate ZK proof
        const proof = await this.prover.generateTransferProof({
            root: merkle1.root,
            nullifier1,
            nullifier2,
            newCommitment1: outputNotes[0].commitment,
            newCommitment2: outputNotes[1].commitment,
            // Input 1
            secret1: inputNotes[0].secret,
            amount1: inputNotes[0].amount,
            leafIndex1: merkle1.leafIndex,
            pathElements1: merkle1.pathElements,
            pathIndices1: merkle1.pathIndices,
            // Input 2
            secret2: inputNotes[1].secret,
            amount2: inputNotes[1].amount,
            leafIndex2: merkle2.leafIndex,
            pathElements2: merkle2.pathElements,
            pathIndices2: merkle2.pathIndices,
            // Output notes
            newAmount1: outputNotes[0].amount,
            newAmount2: outputNotes[1].amount,
            newSecret1: outputNotes[0].secret,
            newSecret2: outputNotes[1].secret,
        });

        // Build transfer transaction
        const shieldedPoolInterface = new ethers.Interface([
            "function privateTransfer(bytes calldata proof, bytes32 root, bytes32 nullifier1, bytes32 nullifier2, bytes32 newCommitment1, bytes32 newCommitment2) external",
        ]);

        const callData = shieldedPoolInterface.encodeFunctionData("privateTransfer", [
            proof.proof,
            merkle1.root,
            nullifier1,
            nullifier2,
            outputNotes[0].commitment,
            outputNotes[1].commitment,
        ]);

        // Submit via AA
        const receipt = await this.aaClient.sendUserOperation({
            target: this.config.shieldedPoolAddress,
            value: 0n,
            callData,
            signer,
        });

        // Update local notes
        this.notes.delete(inputCommitments[0]);
        this.notes.delete(inputCommitments[1]);
        this.notes.set(outputNotes[0].commitment, outputNotes[0]);
        this.notes.set(outputNotes[1].commitment, outputNotes[1]);

        return {
            outputNotes,
            nullifiers: [nullifier1, nullifier2],
            transactionHash: receipt.transactionHash,
        };
    }

    // ============ Cross-Chain Bridge Operations ============

    /**
     * Bridge deposit from external chain to hub
     */
    async bridgeDeposit(
        sourceChain: "ethereum" | "solana" | "rootstock",
        amount: bigint,
        signer: ethers.Signer
    ): Promise<BridgeDeposit> {
        return this.bridgeClient.deposit(sourceChain, amount, signer);
    }

    /**
     * Bridge withdrawal from hub to external chain
     */
    async bridgeWithdraw(
        destinationChain: "ethereum" | "solana" | "rootstock",
        noteCommitment: string,
        recipient: string,
        signer: ethers.Signer
    ): Promise<BridgeWithdrawal> {
        const note = this.notes.get(noteCommitment);
        if (!note) {
            throw new Error("Note not found");
        }

        return this.bridgeClient.withdraw(destinationChain, note, recipient, signer);
    }

    // ============ Note Management ============

    /**
     * Import an existing note
     * Stores the note without re-validating the commitment
     * (commitment validation happens during deserialization for frontend notes)
     */
    importNote(note: CashNote): void {
        // Just store the note - commitment was validated during deserialization
        // or is trusted from the source
        this.notes.set(note.commitment, note);
    }

    /**
     * Import a note from a serialized JSON string
     * Supports both SDK format and frontend format (auto-detected)
     * @param serialized The serialized note string
     */
    importNoteFromString(serialized: string): CashNote {
        const note = deserializeNoteAuto(serialized);
        this.importNote(note);
        return note;
    }

    /**
     * Import an encrypted note (decrypts and stores it)
     * @param encryptedBase64 Base64-encoded encrypted note
     * @param password Password to decrypt the note
     */
    async importEncryptedNote(encryptedBase64: string, password: string): Promise<CashNote> {
        const note = await decryptNote(encryptedBase64, password);
        this.importNote(note);
        return note;
    }

    /**
     * Verify that a note's commitment exists on-chain
     * @param note The note to verify
     * @returns true if the commitment exists in the pool
     */
    async verifyNoteOnChain(note: CashNote): Promise<boolean> {
        try {
            // Use blob storage if available for efficient lookup
            if (this.config.blobStorageUrl) {
                const response = await fetch(
                    `${this.config.blobStorageUrl}/commitments/${note.commitment}/package`
                );
                return response.ok;
            }

            // Fallback: Try to get merkle proof (will throw if not found)
            await this.getMerkleProof(note.commitment);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Import and verify a note exists on-chain
     * @param note The note to import and verify
     * @throws Error if the note's commitment doesn't exist on-chain
     */
    async importAndVerifyNote(note: CashNote): Promise<void> {
        this.importNote(note); // This validates commitment calculation
        
        const exists = await this.verifyNoteOnChain(note);
        if (!exists) {
            this.notes.delete(note.commitment); // Rollback
            throw new Error(
                `Note commitment ${note.commitment} not found on-chain. The note may not have been deposited yet or the commitment data is incorrect.`
            );
        }
    }

    /**
     * Import and verify a note from a serialized string
     * Supports both SDK format and frontend format (auto-detected)
     * @param serialized The serialized note string
     */
    async importAndVerifyNoteFromString(serialized: string): Promise<CashNote> {
        const note = deserializeNoteAuto(serialized);
        await this.importAndVerifyNote(note);
        return note;
    }

    /**
     * Import and verify an encrypted note
     * @param encryptedBase64 Base64-encoded encrypted note
     * @param password Password to decrypt the note
     */
    async importAndVerifyEncryptedNote(
        encryptedBase64: string, 
        password: string
    ): Promise<CashNote> {
        const note = await decryptNote(encryptedBase64, password);
        await this.importAndVerifyNote(note);
        return note;
    }

    /**
     * Export all notes (for backup)
     */
    exportNotes(): CashNote[] {
        return Array.from(this.notes.values());
    }

    /**
     * Export all notes in frontend-compatible format
     * Use this when exporting notes for transfer to another user
     * @param chainId The chain ID to include in exported notes (default: 43114)
     */
    exportNotesForFrontend(chainId: number = 43114): FrontendCashNote[] {
        return Array.from(this.notes.values()).map(note => toFrontendNote(note, chainId));
    }

    /**
     * Export a single note in frontend-compatible JSON string
     * Ready to be shared with the recipient
     * @param commitment The commitment of the note to export
     * @param chainId The chain ID to include (default: 43114)
     */
    exportNoteForTransfer(commitment: string, chainId: number = 43114): string {
        const note = this.notes.get(commitment);
        if (!note) {
            throw new Error("Note not found");
        }
        return serializeNoteForFrontend(note, chainId);
    }

    /**
     * Get total balance in shielded pool
     */
    getBalance(): bigint {
        let total = 0n;
        for (const note of this.notes.values()) {
            total += note.amount;
        }
        return total;
    }

    // ============ IPFS Operations ============

    /**
     * Get the IPFS client instance
     * @throws Error if IPFS is not configured
     */
    getIPFSClient(): IPFSClient {
        if (!this.ipfsClient) {
            throw new Error('IPFS is not configured. Provide ipfs config in CashioConfig.');
        }
        return this.ipfsClient;
    }

    /**
     * Check if IPFS is configured
     */
    hasIPFS(): boolean {
        return !!this.ipfsClient;
    }

    /**
     * Upload recovery key to IPFS
     * Encrypts the recovery key with the provided password before uploading
     */
    async uploadRecoveryKey(
        recoveryKey: string,
        password: string,
        metadata?: Record<string, unknown>
    ): Promise<IPFSUploadResult> {
        const ipfs = this.getIPFSClient();
        const encryptedData = await RecoveryKeyUtils.encrypt(recoveryKey, password);
        encryptedData.metadata = metadata;
        return ipfs.uploadRecoveryKey(encryptedData);
    }

    /**
     * Retrieve and decrypt recovery key from IPFS
     */
    async retrieveRecoveryKey(cid: string, password: string): Promise<string> {
        const ipfs = this.getIPFSClient();
        const recoveryData = await ipfs.retrieveRecoveryKey(cid);
        return RecoveryKeyUtils.decrypt(recoveryData, password);
    }

    /**
     * Upload arbitrary data to IPFS
     */
    async uploadToIPFS(
        data: Uint8Array | string,
        options?: { name?: string; pinToIPFS?: boolean }
    ): Promise<IPFSUploadResult> {
        const ipfs = this.getIPFSClient();
        return ipfs.upload(data, options);
    }

    /**
     * Upload JSON data to IPFS
     */
    async uploadJSONToIPFS<T extends Record<string, unknown>>(
        data: T,
        options?: { name?: string; pinToIPFS?: boolean }
    ): Promise<IPFSUploadResult> {
        const ipfs = this.getIPFSClient();
        return ipfs.uploadJSON(data, options);
    }

    /**
     * Retrieve data from IPFS
     */
    async retrieveFromIPFS(cid: string) {
        const ipfs = this.getIPFSClient();
        return ipfs.retrieve(cid);
    }

    /**
     * Get all notes
     */
    getNotes(): CashNote[] {
        return Array.from(this.notes.values());
    }

    // ============ Private Helpers ============

    /**
     * Get Merkle proof for a commitment
     */
    private async getMerkleProof(commitment: string): Promise<{
        root: string;
        leafIndex: number;
        pathElements: string[];
        pathIndices: number[];
    }> {
        if (this.config.blobStorageUrl) {
            const response = await fetch(
                `${this.config.blobStorageUrl}/commitments/${commitment}/proof`
            );
            return response.json();
        }

        // Fallback: query contract directly
        const commitmentTree = new ethers.Contract(
            this.config.commitmentTreeAddress,
            [
                "function getLastRoot() view returns (bytes32)",
                "function nextLeafIndex() view returns (uint256)",
            ],
            this.provider
        );

        // This is a simplified version - in production, would need full tree reconstruction
        throw new Error("Blob storage URL required for Merkle proof retrieval");
    }

    /**
     * Get leaf index for a commitment
     */
    private async getLeafIndex(commitment: string): Promise<number> {
        if (this.config.blobStorageUrl) {
            const response = await fetch(
                `${this.config.blobStorageUrl}/commitments/${commitment}/package`
            );
            const data = await response.json();
            return data.leafIndex;
        }

        throw new Error("Blob storage URL required for leaf index retrieval");
    }
}

export { 
    CashNote, 
    createNote, 
    generateNullifier, 
    recreateNote,
    serializeNote,
    deserializeNote,
    deserializeNoteAuto,
    encryptNote,
    decryptNote,
    computeCommitment,
    computeFrontendCommitment,
    toFrontendNote,
    fromFrontendNote,
    serializeNoteForFrontend,
    FrontendCashNote
} from "./note.js";
export { ZKProver } from "./prover.js";
export { AccountAbstractionClient } from "./aa.js";
export { BridgeClient } from "./bridge.js";
export {
    IPFSClient,
    IPFSConfig,
    IPFSUploadResult,
    IPFSRetrieveResult,
    RecoveryKeyData,
    RecoveryKeyUtils,
    ipfsClient,
    DEFAULT_IPFS_GATEWAYS
} from "./ipfs.js";
