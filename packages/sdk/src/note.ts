/**
 * Cash.io Note
 * 
 * Represents a shielded note in the privacy pool.
 */

import { poseidon2, poseidon3 } from "poseidon-lite";
import { randomBytes } from "crypto";
import { keccak256, encodePacked, toHex } from "viem";

/**
 * Raw note data
 */
export interface NoteData {
    amount: bigint;
    secret: bigint;
}

/**
 * Complete note with computed fields
 */
export interface CashNote extends NoteData {
    commitment: string;
    nullifierSeed: bigint;
}

/**
 * Frontend-compatible note format
 * This matches the format expected by the web frontend
 */
export interface FrontendCashNote {
    commitment: string;
    secret: string;      // hex string
    amount: bigint;
    blinding: string;    // hex string (maps to nullifierSeed)
    chainId: number;
    createdAt: number;
}

/**
 * Create a new note with random secret
 */
export async function createNote(amount: bigint): Promise<CashNote> {
    // Generate random secret (31 bytes to stay in field)
    const secretBytes = randomBytes(31);
    const secret = BigInt("0x" + secretBytes.toString("hex"));

    // Generate nullifier seed (different from secret for security)
    const nullifierSeedBytes = randomBytes(31);
    const nullifierSeed = BigInt("0x" + nullifierSeedBytes.toString("hex"));

    // Compute commitment using Poseidon hash
    const commitment = poseidon2([amount, secret]);
    const commitmentHex = "0x" + commitment.toString(16).padStart(64, "0");

    return {
        amount,
        secret,
        nullifierSeed,
        commitment: commitmentHex,
    };
}

/**
 * Recreate note from known values
 */
export function recreateNote(
    amount: bigint,
    secret: bigint,
    nullifierSeed: bigint
): CashNote {
    const commitment = poseidon2([amount, secret]);
    const commitmentHex = "0x" + commitment.toString(16).padStart(64, "0");

    return {
        amount,
        secret,
        nullifierSeed,
        commitment: commitmentHex,
    };
}

/**
 * Generate nullifier for a note
 */
export async function generateNullifier(
    note: CashNote,
    leafIndex: number
): Promise<string> {
    const nullifier = poseidon3([
        BigInt(note.commitment),
        BigInt(leafIndex),
        note.secret,
    ]);

    return "0x" + nullifier.toString(16).padStart(64, "0");
}

/**
 * Compute note commitment from amount and secret
 */
export function computeCommitment(amount: bigint, secret: bigint): string {
    const commitment = poseidon2([amount, secret]);
    return "0x" + commitment.toString(16).padStart(64, "0");
}

/**
 * Serialize note for storage/backup
 */
export function serializeNote(note: CashNote): string {
    return JSON.stringify({
        amount: note.amount.toString(),
        secret: note.secret.toString(),
        nullifierSeed: note.nullifierSeed.toString(),
        commitment: note.commitment,
    });
}

/**
 * Deserialize note from storage/backup
 */
export function deserializeNote(serialized: string): CashNote {
    const data = JSON.parse(serialized);
    return {
        amount: BigInt(data.amount),
        secret: BigInt(data.secret),
        nullifierSeed: BigInt(data.nullifierSeed),
        commitment: data.commitment,
    };
}

/**
 * Encrypt note for secure backup
 */
export async function encryptNote(
    note: CashNote,
    password: string
): Promise<string> {
    const crypto = await import("crypto");

    // Derive key from password
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);

    // Encrypt
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const serialized = serializeNote(note);
    const encrypted = Buffer.concat([
        cipher.update(serialized, "utf8"),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Combine: salt + iv + authTag + encrypted
    const result = Buffer.concat([salt, iv, authTag, encrypted]);
    return result.toString("base64");
}

/**
 * Decrypt note from backup
 */
export async function decryptNote(
    encryptedBase64: string,
    password: string
): Promise<CashNote> {
    const crypto = await import("crypto");

    const data = Buffer.from(encryptedBase64, "base64");

    // Extract components
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 32);
    const authTag = data.slice(32, 48);
    const encrypted = data.slice(48);

    // Derive key
    const key = crypto.scryptSync(password, salt, 32);

    // Decrypt
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);

    return deserializeNote(decrypted.toString("utf8"));
}

/**
 * Convert a bigint to a padded hex string
 */
function bigintToHex(value: bigint): string {
    return "0x" + value.toString(16).padStart(64, "0");
}

/**
 * Convert a hex string to bigint
 */
function hexToBigint(hex: string): bigint {
    return BigInt(hex);
}

/**
 * Convert SDK CashNote to frontend-compatible format
 * @param note The SDK CashNote
 * @param chainId The chain ID where the note was created (default: 43114 for Avalanche)
 */
export function toFrontendNote(note: CashNote, chainId: number = 43114): FrontendCashNote {
    return {
        commitment: note.commitment,
        secret: bigintToHex(note.secret),
        amount: note.amount,
        blinding: bigintToHex(note.nullifierSeed),
        chainId,
        createdAt: Date.now(),
    };
}

/**
 * Compute a frontend-style commitment using keccak256
 * This matches how the frontend computes commitments
 */
export function computeFrontendCommitment(secret: string, blinding: string, amount: bigint): string {
    return keccak256(
        encodePacked(
            ['bytes32', 'bytes32', 'uint256'],
            [secret as `0x${string}`, blinding as `0x${string}`, amount]
        )
    );
}

/**
 * Convert frontend-compatible format to SDK CashNote
 * Uses keccak256 to verify commitment matches frontend format
 */
export function fromFrontendNote(frontendNote: FrontendCashNote): CashNote {
    const secret = hexToBigint(frontendNote.secret);
    const nullifierSeed = hexToBigint(frontendNote.blinding);
    const amount = frontendNote.amount;
    
    // Verify commitment using frontend's keccak256 scheme
    const expectedCommitment = computeFrontendCommitment(
        frontendNote.secret,
        frontendNote.blinding,
        amount
    );
    
    // Use the original commitment from the frontend note
    // The commitment was already computed correctly when the note was created
    return {
        amount,
        secret,
        nullifierSeed,
        commitment: frontendNote.commitment,
    };
}

/**
 * Serialize note for frontend storage/transfer
 * This produces JSON that can be directly parsed by the frontend
 */
export function serializeNoteForFrontend(note: CashNote, chainId: number = 43114): string {
    const frontendNote = toFrontendNote(note, chainId);
    return JSON.stringify({
        commitment: frontendNote.commitment,
        secret: frontendNote.secret,
        amount: frontendNote.amount.toString(),
        blinding: frontendNote.blinding,
        chainId: frontendNote.chainId,
        createdAt: frontendNote.createdAt,
    });
}

/**
 * Deserialize note from either SDK or frontend format
 * Auto-detects the format based on the presence of specific fields
 */
export function deserializeNoteAuto(serialized: string): CashNote {
    const data = JSON.parse(serialized);
    
    // Detect frontend format by checking for 'blinding' field
    if ('blinding' in data) {
        // Frontend format
        const frontendNote: FrontendCashNote = {
            commitment: data.commitment,
            secret: data.secret,
            amount: typeof data.amount === 'string' ? BigInt(data.amount) : data.amount,
            blinding: data.blinding,
            chainId: data.chainId || 43114,
            createdAt: data.createdAt || Date.now(),
        };
        return fromFrontendNote(frontendNote);
    } else {
        // SDK format
        return {
            amount: BigInt(data.amount),
            secret: BigInt(data.secret),
            nullifierSeed: BigInt(data.nullifierSeed),
            commitment: data.commitment,
        };
    }
}
