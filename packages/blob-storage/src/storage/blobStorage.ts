/**
 * Blob Storage Service
 * 
 * Manages encrypted transaction data, witnesses, and proving artifacts.
 * Provides content-addressed storage with sharding for efficient retrieval.
 */

import { Level } from "level";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

/**
 * Blob metadata stored alongside content
 */
export interface BlobMetadata {
    cid: string;
    size: number;
    rollupId: string;
    epoch: number;
    commitmentPrefix: string;
    createdAt: Date;
    encrypted: boolean;
    shardIndex: number;
    totalShards: number;
}

/**
 * Blob with content and metadata
 */
export interface Blob {
    content: Buffer;
    metadata: BlobMetadata;
}

/**
 * Shard configuration
 */
export interface ShardConfig {
    shardCount: number;
    replicationFactor: number;
}

/**
 * Storage backend interface
 */
export interface StorageBackend {
    put(key: string, value: Buffer): Promise<void>;
    get(key: string): Promise<Buffer | null>;
    delete(key: string): Promise<void>;
    list(prefix: string): Promise<string[]>;
}

/**
 * Blob Storage class
 */
export class BlobStorage {
    private db: Level<string, Buffer>;
    private metadataDb: Level<string, string>;
    private encryptionKey: Buffer;
    private shardConfig: ShardConfig;

    constructor(options: {
        dbPath: string;
        encryptionKey?: string;
        shardConfig?: ShardConfig;
    }) {
        this.db = new Level(options.dbPath, { valueEncoding: "buffer" });
        this.metadataDb = new Level(`${options.dbPath}_metadata`, { valueEncoding: "json" });

        // Derive encryption key from provided key or generate new one
        this.encryptionKey = options.encryptionKey
            ? createHash("sha256").update(options.encryptionKey).digest()
            : randomBytes(32);

        this.shardConfig = options.shardConfig || {
            shardCount: 16,
            replicationFactor: 3,
        };
    }

    /**
     * Store a blob with automatic sharding
     */
    async store(
        content: Buffer,
        options: {
            rollupId: string;
            epoch: number;
            encrypt?: boolean;
        }
    ): Promise<BlobMetadata[]> {
        const { rollupId, epoch, encrypt = true } = options;

        // Calculate content hash for CID
        const hash = await sha256.digest(content);
        const cid = CID.create(1, raw.code, hash);
        const cidStr = cid.toString();

        // Determine commitment prefix (first 8 chars of CID)
        const commitmentPrefix = cidStr.slice(0, 8);

        // Encrypt if requested
        let processedContent = content;
        if (encrypt) {
            processedContent = this.encrypt(content);
        }

        // Shard the content
        const shards = this.shard(processedContent);
        const metadataList: BlobMetadata[] = [];

        for (let i = 0; i < shards.length; i++) {
            const shardKey = this.getShardKey(rollupId, epoch, commitmentPrefix, i);

            // Store shard
            await this.db.put(shardKey, shards[i]);

            // Create metadata
            const metadata: BlobMetadata = {
                cid: cidStr,
                size: shards[i].length,
                rollupId,
                epoch,
                commitmentPrefix,
                createdAt: new Date(),
                encrypted: encrypt,
                shardIndex: i,
                totalShards: shards.length,
            };

            // Store metadata
            await this.metadataDb.put(shardKey, JSON.stringify(metadata));
            metadataList.push(metadata);
        }

        return metadataList;
    }

    /**
     * Retrieve a blob by its CID
     */
    async retrieve(cid: string): Promise<Blob | null> {
        // Find metadata by CID
        const metadataList: BlobMetadata[] = [];

        for await (const [key, value] of this.metadataDb.iterator()) {
            const metadata = JSON.parse(value) as BlobMetadata;
            if (metadata.cid === cid) {
                metadataList.push(metadata);
            }
        }

        if (metadataList.length === 0) {
            return null;
        }

        // Sort by shard index
        metadataList.sort((a, b) => a.shardIndex - b.shardIndex);

        // Retrieve and reassemble shards
        const shards: Buffer[] = [];
        for (const metadata of metadataList) {
            const shardKey = this.getShardKey(
                metadata.rollupId,
                metadata.epoch,
                metadata.commitmentPrefix,
                metadata.shardIndex
            );

            const shard = await this.db.get(shardKey);
            shards.push(shard);
        }

        // Reassemble content
        let content = Buffer.concat(shards);

        // Decrypt if encrypted
        if (metadataList[0].encrypted) {
            content = this.decrypt(content);
        }

        return {
            content,
            metadata: {
                ...metadataList[0],
                size: content.length,
                shardIndex: 0,
                totalShards: metadataList.length,
            },
        };
    }

    /**
     * Retrieve by rollup ID and epoch
     */
    async retrieveByEpoch(rollupId: string, epoch: number): Promise<Blob[]> {
        const blobs: Map<string, BlobMetadata[]> = new Map();

        const prefix = `${rollupId}:${epoch}:`;

        for await (const [key, value] of this.metadataDb.iterator()) {
            if (key.startsWith(prefix)) {
                const metadata = JSON.parse(value) as BlobMetadata;
                const existing = blobs.get(metadata.cid) || [];
                existing.push(metadata);
                blobs.set(metadata.cid, existing);
            }
        }

        const results: Blob[] = [];
        for (const [cid] of blobs) {
            const blob = await this.retrieve(cid);
            if (blob) {
                results.push(blob);
            }
        }

        return results;
    }

    /**
     * Get a shard key for storage
     */
    private getShardKey(
        rollupId: string,
        epoch: number,
        commitmentPrefix: string,
        shardIndex: number
    ): string {
        return `${rollupId}:${epoch}:${commitmentPrefix}:${shardIndex}`;
    }

    /**
     * Shard content into chunks
     */
    private shard(content: Buffer): Buffer[] {
        const chunkSize = Math.ceil(content.length / this.shardConfig.shardCount);
        const shards: Buffer[] = [];

        for (let i = 0; i < content.length; i += chunkSize) {
            shards.push(content.slice(i, Math.min(i + chunkSize, content.length)));
        }

        // Pad to consistent shard count
        while (shards.length < this.shardConfig.shardCount) {
            shards.push(Buffer.alloc(0));
        }

        return shards;
    }

    /**
     * Encrypt content using AES-256-GCM
     */
    private encrypt(content: Buffer): Buffer {
        const iv = randomBytes(16);
        const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);

        const encrypted = Buffer.concat([
            cipher.update(content),
            cipher.final(),
        ]);

        const authTag = cipher.getAuthTag();

        // Return iv + authTag + encrypted
        return Buffer.concat([iv, authTag, encrypted]);
    }

    /**
     * Decrypt content
     */
    private decrypt(encrypted: Buffer): Buffer {
        const iv = encrypted.slice(0, 16);
        const authTag = encrypted.slice(16, 32);
        const content = encrypted.slice(32);

        const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([
            decipher.update(content),
            decipher.final(),
        ]);
    }

    /**
     * Calculate content hash
     */
    async hash(content: Buffer): Promise<string> {
        const hash = await sha256.digest(content);
        const cid = CID.create(1, raw.code, hash);
        return cid.toString();
    }

    /**
     * Delete a blob by CID
     */
    async delete(cid: string): Promise<void> {
        const keysToDelete: string[] = [];

        for await (const [key, value] of this.metadataDb.iterator()) {
            const metadata = JSON.parse(value) as BlobMetadata;
            if (metadata.cid === cid) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            await this.db.del(key);
            await this.metadataDb.del(key);
        }
    }

    /**
     * Get storage statistics
     */
    async getStats(): Promise<{
        totalBlobs: number;
        totalSize: number;
        byRollup: Record<string, number>;
        byEpoch: Record<number, number>;
    }> {
        let totalBlobs = 0;
        let totalSize = 0;
        const byRollup: Record<string, number> = {};
        const byEpoch: Record<number, number> = {};
        const seenCids = new Set<string>();

        for await (const [, value] of this.metadataDb.iterator()) {
            const metadata = JSON.parse(value) as BlobMetadata;

            if (!seenCids.has(metadata.cid)) {
                seenCids.add(metadata.cid);
                totalBlobs++;
            }

            totalSize += metadata.size;
            byRollup[metadata.rollupId] = (byRollup[metadata.rollupId] || 0) + metadata.size;
            byEpoch[metadata.epoch] = (byEpoch[metadata.epoch] || 0) + metadata.size;
        }

        return { totalBlobs, totalSize, byRollup, byEpoch };
    }

    /**
     * Close the database
     */
    async close(): Promise<void> {
        await this.db.close();
        await this.metadataDb.close();
    }
}
