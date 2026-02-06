/**
 * Commitment Tree Indexer
 * 
 * Maintains an index of the commitment tree for efficient proof input retrieval.
 * Reconstructs the tree from on-chain events and serves proof packages to clients.
 */

import { Level } from "level";
import { createHash } from "crypto";

/**
 * Commitment leaf data
 */
export interface CommitmentLeaf {
    commitment: string;
    leafIndex: number;
    blockNumber: number;
    transactionHash: string;
    timestamp: number;
}

/**
 * Merkle proof for a commitment
 */
export interface MerkleProof {
    root: string;
    leaf: string;
    leafIndex: number;
    pathElements: string[];
    pathIndices: number[];
}

/**
 * Proof input package for ZK proving
 */
export interface ProofInputPackage {
    commitment: string;
    leafIndex: number;
    merkleProof: MerkleProof;
    nullifier?: string;
    timestamp: number;
}

/**
 * Tree configuration
 */
const TREE_DEPTH = 20;
const ZERO_VALUE = "0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c";

/**
 * Commitment Tree Indexer
 */
export class CommitmentTreeIndexer {
    private db: Level<string, string>;
    private treeDb: Level<string, string>;
    private leaves: string[] = [];
    private filledSubtrees: string[] = [];
    private zeros: string[] = [];
    private currentRoot: string = "";
    private nextLeafIndex: number = 0;

    constructor(dbPath: string) {
        this.db = new Level(`${dbPath}/commitments`, { valueEncoding: "json" });
        this.treeDb = new Level(`${dbPath}/tree`, { valueEncoding: "json" });

        // Initialize zero hashes
        this.initializeZeros();
    }

    /**
     * Initialize zero hashes for each level
     */
    private initializeZeros(): void {
        this.zeros = [ZERO_VALUE];
        this.filledSubtrees = [ZERO_VALUE];

        for (let i = 1; i < TREE_DEPTH; i++) {
            const prevZero = this.zeros[i - 1];
            this.zeros[i] = this.hashPair(prevZero, prevZero);
            this.filledSubtrees[i] = this.zeros[i];
        }

        // Initial root
        this.currentRoot = this.hashPair(
            this.zeros[TREE_DEPTH - 1],
            this.zeros[TREE_DEPTH - 1]
        );
    }

    /**
     * Hash two values together (Poseidon-like hash using keccak256 for demo)
     */
    private hashPair(left: string, right: string): string {
        const hash = createHash("sha256")
            .update(Buffer.from(left.slice(2), "hex"))
            .update(Buffer.from(right.slice(2), "hex"))
            .digest();
        return "0x" + hash.toString("hex");
    }

    /**
     * Insert a new commitment into the tree
     */
    async insert(leaf: CommitmentLeaf): Promise<{ root: string; proof: MerkleProof }> {
        const { commitment, leafIndex, blockNumber, transactionHash, timestamp } = leaf;

        // Store commitment data
        await this.db.put(`leaf:${leafIndex}`, JSON.stringify(leaf));
        await this.db.put(`commitment:${commitment}`, JSON.stringify(leaf));

        // Add to leaves array
        this.leaves[leafIndex] = commitment;

        // Update tree
        let currentLevelHash = commitment;
        let currentIndex = leafIndex;
        const pathElements: string[] = [];
        const pathIndices: number[] = [];

        for (let i = 0; i < TREE_DEPTH; i++) {
            let left: string;
            let right: string;

            if (currentIndex % 2 === 0) {
                // Current node is left child
                left = currentLevelHash;
                right = this.zeros[i];
                this.filledSubtrees[i] = currentLevelHash;
                pathElements.push(right);
                pathIndices.push(0);
            } else {
                // Current node is right child
                left = this.filledSubtrees[i];
                right = currentLevelHash;
                pathElements.push(left);
                pathIndices.push(1);
            }

            // Store node
            await this.treeDb.put(`node:${i}:${currentIndex}`, currentLevelHash);

            currentLevelHash = this.hashPair(left, right);
            currentIndex = Math.floor(currentIndex / 2);
        }

        // Update root
        this.currentRoot = currentLevelHash;
        this.nextLeafIndex = leafIndex + 1;

        // Store root
        await this.treeDb.put(`root:${leafIndex}`, this.currentRoot);
        await this.treeDb.put("currentRoot", this.currentRoot);
        await this.treeDb.put("nextLeafIndex", String(this.nextLeafIndex));

        const proof: MerkleProof = {
            root: this.currentRoot,
            leaf: commitment,
            leafIndex,
            pathElements,
            pathIndices,
        };

        // Store proof for fast retrieval
        await this.db.put(`proof:${commitment}`, JSON.stringify(proof));

        return { root: this.currentRoot, proof };
    }

    /**
     * Get a Merkle proof for a commitment
     */
    async getProof(commitment: string): Promise<MerkleProof | null> {
        try {
            const proofStr = await this.db.get(`proof:${commitment}`);
            return JSON.parse(proofStr);
        } catch {
            return null;
        }
    }

    /**
     * Get proof by leaf index
     */
    async getProofByIndex(leafIndex: number): Promise<MerkleProof | null> {
        try {
            const leafStr = await this.db.get(`leaf:${leafIndex}`);
            const leaf = JSON.parse(leafStr) as CommitmentLeaf;
            return this.getProof(leaf.commitment);
        } catch {
            return null;
        }
    }

    /**
     * Get a complete proof input package for ZK proving
     */
    async getProofInputPackage(commitment: string): Promise<ProofInputPackage | null> {
        try {
            const leafStr = await this.db.get(`commitment:${commitment}`);
            const leaf = JSON.parse(leafStr) as CommitmentLeaf;

            const proof = await this.getProof(commitment);
            if (!proof) return null;

            return {
                commitment,
                leafIndex: leaf.leafIndex,
                merkleProof: proof,
                timestamp: leaf.timestamp,
            };
        } catch {
            return null;
        }
    }

    /**
     * Verify a Merkle proof
     */
    verifyProof(proof: MerkleProof): boolean {
        let currentHash = proof.leaf;

        for (let i = 0; i < proof.pathElements.length; i++) {
            let left: string;
            let right: string;

            if (proof.pathIndices[i] === 0) {
                left = currentHash;
                right = proof.pathElements[i];
            } else {
                left = proof.pathElements[i];
                right = currentHash;
            }

            currentHash = this.hashPair(left, right);
        }

        return currentHash === proof.root;
    }

    /**
     * Get the current root
     */
    getCurrentRoot(): string {
        return this.currentRoot;
    }

    /**
     * Get the next leaf index
     */
    getNextLeafIndex(): number {
        return this.nextLeafIndex;
    }

    /**
     * Load state from database
     */
    async load(): Promise<void> {
        try {
            const rootStr = await this.treeDb.get("currentRoot");
            this.currentRoot = rootStr;

            const indexStr = await this.treeDb.get("nextLeafIndex");
            this.nextLeafIndex = parseInt(indexStr);

            // Load filled subtrees
            for (let i = 0; i < TREE_DEPTH; i++) {
                try {
                    const subtree = await this.treeDb.get(`filledSubtree:${i}`);
                    this.filledSubtrees[i] = subtree;
                } catch {
                    // Use zero value
                    this.filledSubtrees[i] = this.zeros[i];
                }
            }

            console.log(`Loaded tree: root=${this.currentRoot.slice(0, 18)}..., nextIndex=${this.nextLeafIndex}`);
        } catch {
            console.log("No existing tree state, starting fresh");
        }
    }

    /**
     * Get commitment by index
     */
    async getCommitmentByIndex(leafIndex: number): Promise<CommitmentLeaf | null> {
        try {
            const leafStr = await this.db.get(`leaf:${leafIndex}`);
            return JSON.parse(leafStr);
        } catch {
            return null;
        }
    }

    /**
     * Get all commitments in a range
     */
    async getCommitmentsInRange(
        startIndex: number,
        endIndex: number
    ): Promise<CommitmentLeaf[]> {
        const results: CommitmentLeaf[] = [];

        for (let i = startIndex; i <= endIndex; i++) {
            const leaf = await this.getCommitmentByIndex(i);
            if (leaf) {
                results.push(leaf);
            }
        }

        return results;
    }

    /**
     * Check if a root is known (historical)
     */
    async isKnownRoot(root: string): Promise<boolean> {
        if (root === this.currentRoot) return true;

        // Check historical roots
        for await (const [key, value] of this.treeDb.iterator()) {
            if (key.startsWith("root:") && value === root) {
                return true;
            }
        }

        return false;
    }

    /**
     * Close databases
     */
    async close(): Promise<void> {
        await this.db.close();
        await this.treeDb.close();
    }
}
