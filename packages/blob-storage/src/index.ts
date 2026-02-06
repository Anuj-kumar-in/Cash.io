/**
 * Blob Storage Service - Main Entry Point
 * 
 * Provides HTTP API for blob storage and commitment tree indexing.
 */

import express from "express";
import { BlobStorage } from "./storage/blobStorage.js";
import { CommitmentTreeIndexer } from "./indexer/commitmentTreeIndexer.js";

export { BlobStorage, CommitmentTreeIndexer };

/**
 * Create and start the blob storage service
 */
export async function createBlobStorageService(config: {
    port: number;
    dbPath: string;
    encryptionKey?: string;
}): Promise<express.Application> {
    const app = express();
    app.use(express.json());
    app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));

    // Initialize storage
    const storage = new BlobStorage({
        dbPath: `${config.dbPath}/blobs`,
        encryptionKey: config.encryptionKey,
    });

    // Initialize indexer
    const indexer = new CommitmentTreeIndexer(`${config.dbPath}/indexer`);
    await indexer.load();

    // ============ Blob Storage API ============

    /**
     * Store a blob
     * POST /blobs
     */
    app.post("/blobs", async (req, res) => {
        try {
            const { rollupId, epoch, encrypt = true } = req.query as any;
            const content = req.body as Buffer;

            if (!rollupId || !epoch) {
                return res.status(400).json({ error: "rollupId and epoch are required" });
            }

            const metadata = await storage.store(content, {
                rollupId,
                epoch: parseInt(epoch),
                encrypt: encrypt === "true" || encrypt === true,
            });

            res.json({ success: true, metadata });
        } catch (error) {
            console.error("Store error:", error);
            res.status(500).json({ error: "Failed to store blob" });
        }
    });

    /**
     * Retrieve a blob by CID
     * GET /blobs/:cid
     */
    app.get("/blobs/:cid", async (req, res) => {
        try {
            const { cid } = req.params;
            const blob = await storage.retrieve(cid);

            if (!blob) {
                return res.status(404).json({ error: "Blob not found" });
            }

            res.set("Content-Type", "application/octet-stream");
            res.set("X-Blob-Metadata", JSON.stringify(blob.metadata));
            res.send(blob.content);
        } catch (error) {
            console.error("Retrieve error:", error);
            res.status(500).json({ error: "Failed to retrieve blob" });
        }
    });

    /**
     * Get blobs by rollup and epoch
     * GET /blobs/rollup/:rollupId/epoch/:epoch
     */
    app.get("/blobs/rollup/:rollupId/epoch/:epoch", async (req, res) => {
        try {
            const { rollupId, epoch } = req.params;
            const blobs = await storage.retrieveByEpoch(rollupId, parseInt(epoch));

            res.json({
                count: blobs.length,
                blobs: blobs.map(b => ({
                    cid: b.metadata.cid,
                    size: b.metadata.size,
                    createdAt: b.metadata.createdAt,
                })),
            });
        } catch (error) {
            console.error("List error:", error);
            res.status(500).json({ error: "Failed to list blobs" });
        }
    });

    /**
     * Delete a blob
     * DELETE /blobs/:cid
     */
    app.delete("/blobs/:cid", async (req, res) => {
        try {
            const { cid } = req.params;
            await storage.delete(cid);
            res.json({ success: true });
        } catch (error) {
            console.error("Delete error:", error);
            res.status(500).json({ error: "Failed to delete blob" });
        }
    });

    /**
     * Get storage statistics
     * GET /blobs/stats
     */
    app.get("/stats", async (req, res) => {
        try {
            const stats = await storage.getStats();
            res.json(stats);
        } catch (error) {
            console.error("Stats error:", error);
            res.status(500).json({ error: "Failed to get stats" });
        }
    });

    // ============ Commitment Tree API ============

    /**
     * Insert a commitment
     * POST /commitments
     */
    app.post("/commitments", async (req, res) => {
        try {
            const { commitment, blockNumber, transactionHash, timestamp } = req.body;

            if (!commitment) {
                return res.status(400).json({ error: "commitment is required" });
            }

            const result = await indexer.insert({
                commitment,
                leafIndex: indexer.getNextLeafIndex(),
                blockNumber: blockNumber || 0,
                transactionHash: transactionHash || "0x",
                timestamp: timestamp || Date.now(),
            });

            res.json({
                success: true,
                root: result.root,
                leafIndex: result.proof.leafIndex,
            });
        } catch (error) {
            console.error("Insert commitment error:", error);
            res.status(500).json({ error: "Failed to insert commitment" });
        }
    });

    /**
     * Get proof for a commitment
     * GET /commitments/:commitment/proof
     */
    app.get("/commitments/:commitment/proof", async (req, res) => {
        try {
            const { commitment } = req.params;
            const proof = await indexer.getProof(commitment);

            if (!proof) {
                return res.status(404).json({ error: "Commitment not found" });
            }

            res.json(proof);
        } catch (error) {
            console.error("Get proof error:", error);
            res.status(500).json({ error: "Failed to get proof" });
        }
    });

    /**
     * Get complete proof input package
     * GET /commitments/:commitment/package
     */
    app.get("/commitments/:commitment/package", async (req, res) => {
        try {
            const { commitment } = req.params;
            const package_ = await indexer.getProofInputPackage(commitment);

            if (!package_) {
                return res.status(404).json({ error: "Commitment not found" });
            }

            res.json(package_);
        } catch (error) {
            console.error("Get package error:", error);
            res.status(500).json({ error: "Failed to get proof package" });
        }
    });

    /**
     * Verify a proof
     * POST /commitments/verify
     */
    app.post("/commitments/verify", async (req, res) => {
        try {
            const proof = req.body;
            const valid = indexer.verifyProof(proof);
            res.json({ valid });
        } catch (error) {
            console.error("Verify error:", error);
            res.status(500).json({ error: "Failed to verify proof" });
        }
    });

    /**
     * Get current tree state
     * GET /tree/state
     */
    app.get("/tree/state", async (req, res) => {
        try {
            res.json({
                root: indexer.getCurrentRoot(),
                nextLeafIndex: indexer.getNextLeafIndex(),
            });
        } catch (error) {
            console.error("State error:", error);
            res.status(500).json({ error: "Failed to get tree state" });
        }
    });

    /**
     * Check if root is known
     * GET /tree/roots/:root
     */
    app.get("/tree/roots/:root", async (req, res) => {
        try {
            const { root } = req.params;
            const known = await indexer.isKnownRoot(root);
            res.json({ known });
        } catch (error) {
            console.error("Root check error:", error);
            res.status(500).json({ error: "Failed to check root" });
        }
    });

    // ============ Health Check ============

    app.get("/health", (req, res) => {
        res.json({
            status: "healthy",
            timestamp: new Date().toISOString(),
            treeRoot: indexer.getCurrentRoot().slice(0, 18) + "...",
            nextLeafIndex: indexer.getNextLeafIndex(),
        });
    });

    // Start server
    app.listen(config.port, () => {
        console.log(`📦 Blob Storage Service running on port ${config.port}`);
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
        console.log("Shutting down...");
        await storage.close();
        await indexer.close();
        process.exit(0);
    });

    return app;
}

// Run if executed directly
if (process.argv[1]?.includes("index")) {
    const port = parseInt(process.env.PORT || "3001");
    const dbPath = process.env.DB_PATH || "./data";
    const encryptionKey = process.env.ENCRYPTION_KEY;

    createBlobStorageService({ port, dbPath, encryptionKey });
}
