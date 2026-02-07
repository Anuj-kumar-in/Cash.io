/**
 * IPFS Client for Cash.io SDK
 *
 * Provides IPFS connectivity for uploading recovery keys,
 * encrypted data, and other information in a decentralized manner.
 */

/**
 * IPFS Configuration
 */
export interface IPFSConfig {
    /** IPFS Gateway URL (e.g., https://ipfs.io, https://gateway.pinata.cloud) */
    gatewayUrl: string;
    /** IPFS API URL for uploads (e.g., https://api.pinata.cloud) */
    apiUrl?: string;
    /** API Key for authenticated IPFS services (Pinata, Infura, etc.) */
    apiKey?: string;
    /** API Secret for authenticated IPFS services */
    apiSecret?: string;
    /** JWT token for services like Pinata */
    jwt?: string;
    /** Timeout for requests in milliseconds */
    timeout?: number;
}

/**
 * Result from uploading content to IPFS
 */
export interface IPFSUploadResult {
    /** The IPFS hash (CID) of the uploaded content */
    cid: string;
    /** The full IPFS URI (ipfs://<cid>) */
    ipfsUri: string;
    /** The gateway URL to access the content */
    gatewayUrl: string;
    /** Size of the uploaded content in bytes */
    size: number;
    /** Timestamp of upload */
    timestamp: number;
}

/**
 * Result from retrieving content from IPFS
 */
export interface IPFSRetrieveResult {
    /** The raw content data */
    data: Uint8Array;
    /** Content as string (if applicable) */
    text?: string;
    /** Content as JSON (if applicable) */
    json?: unknown;
    /** Content type */
    contentType?: string;
}

/**
 * Recovery key data structure for IPFS storage
 */
export interface RecoveryKeyData {
    /** Encrypted recovery key */
    encryptedKey: string;
    /** Salt used for encryption */
    salt: string;
    /** Initialization vector */
    iv: string;
    /** Algorithm used */
    algorithm: string;
    /** Version of the recovery format */
    version: number;
    /** Creation timestamp */
    createdAt: number;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
    /** Index signature for compatibility with Record<string, unknown> */
    [key: string]: string | number | Record<string, unknown> | undefined;
}

/**
 * IPFS Client for decentralized storage operations
 */
export class IPFSClient {
    private config: IPFSConfig;
    private defaultTimeout = 30000;

    constructor(config: IPFSConfig) {
        this.config = {
            ...config,
            timeout: config.timeout || this.defaultTimeout,
        };
    }

    /**
     * Upload raw data to IPFS
     */
    async upload(data: Uint8Array | string, options?: {
        name?: string;
        wrapWithDirectory?: boolean;
        pinToIPFS?: boolean;
    }): Promise<IPFSUploadResult> {
        const content = typeof data === 'string' ? new TextEncoder().encode(data) : data;

        // Use Pinata if JWT is provided
        if (this.config.jwt) {
            return this.uploadToPinata(content, options);
        }

        // Use generic IPFS API
        return this.uploadToIPFSAPI(content, options);
    }

    /**
     * Upload JSON data to IPFS
     */
    async uploadJSON<T extends Record<string, unknown>>(data: T, options?: {
        name?: string;
        pinToIPFS?: boolean;
    }): Promise<IPFSUploadResult> {
        const jsonString = JSON.stringify(data, null, 2);
        return this.upload(jsonString, {
            ...options,
            name: options?.name || 'data.json',
        });
    }

    /**
     * Upload recovery key data to IPFS
     */
    async uploadRecoveryKey(recoveryData: RecoveryKeyData, options?: {
        name?: string;
    }): Promise<IPFSUploadResult> {
        const dataWithTimestamp: RecoveryKeyData = {
            ...recoveryData,
            createdAt: recoveryData.createdAt || Date.now(),
            version: recoveryData.version || 1,
        };

        return this.uploadJSON(dataWithTimestamp, {
            name: options?.name || 'recovery-key.json',
            pinToIPFS: true, // Always pin recovery keys
        });
    }

    /**
     * Retrieve data from IPFS by CID
     */
    async retrieve(cid: string): Promise<IPFSRetrieveResult> {
        const gatewayUrl = this.getGatewayUrl(cid);

        const response = await fetch(gatewayUrl, {
            signal: AbortSignal.timeout(this.config.timeout || this.defaultTimeout),
        });

        if (!response.ok) {
            throw new Error(`Failed to retrieve from IPFS: ${response.statusText}`);
        }

        const data = new Uint8Array(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || undefined;

        const result: IPFSRetrieveResult = {
            data,
            contentType,
        };

        // Try to parse as text/JSON
        try {
            const text = new TextDecoder().decode(data);
            result.text = text;

            if (contentType?.includes('application/json') || text.startsWith('{') || text.startsWith('[')) {
                result.json = JSON.parse(text);
            }
        } catch {
            // Not text/JSON, that's okay
        }

        return result;
    }

    /**
     * Retrieve recovery key data from IPFS
     */
    async retrieveRecoveryKey(cid: string): Promise<RecoveryKeyData> {
        const result = await this.retrieve(cid);

        if (!result.json) {
            throw new Error('Retrieved content is not valid JSON');
        }

        const data = result.json as Record<string, unknown>;

        // Validate recovery key structure
        if (!data.encryptedKey || !data.salt || !data.iv || !data.algorithm) {
            throw new Error('Invalid recovery key data structure');
        }

        return data as unknown as RecoveryKeyData;
    }

    /**
     * Check if content exists on IPFS
     */
    async exists(cid: string): Promise<boolean> {
        try {
            const response = await fetch(this.getGatewayUrl(cid), {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get the gateway URL for a CID
     */
    getGatewayUrl(cid: string): string {
        const gateway = this.config.gatewayUrl.replace(/\/$/, '');
        return `${gateway}/ipfs/${cid}`;
    }

    /**
     * Get the IPFS URI for a CID
     */
    getIPFSUri(cid: string): string {
        return `ipfs://${cid}`;
    }

    /**
     * Pin existing content (if using Pinata)
     */
    async pin(cid: string, name?: string): Promise<boolean> {
        if (!this.config.jwt) {
            console.warn('Pinning requires Pinata JWT');
            return false;
        }

        try {
            const response = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.jwt}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hashToPin: cid,
                    pinataMetadata: name ? { name } : undefined,
                }),
                signal: AbortSignal.timeout(this.config.timeout || this.defaultTimeout),
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Unpin content (if using Pinata)
     */
    async unpin(cid: string): Promise<boolean> {
        if (!this.config.jwt) {
            console.warn('Unpinning requires Pinata JWT');
            return false;
        }

        try {
            const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.config.jwt}`,
                },
                signal: AbortSignal.timeout(this.config.timeout || this.defaultTimeout),
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    // ============ Private Methods ============

    /**
     * Upload to Pinata IPFS service
     */
    private async uploadToPinata(
        content: Uint8Array,
        options?: { name?: string; wrapWithDirectory?: boolean; pinToIPFS?: boolean }
    ): Promise<IPFSUploadResult> {
        const formData = new FormData();
        const buffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        formData.append('file', blob, options?.name || 'file');

        if (options?.name) {
            formData.append('pinataMetadata', JSON.stringify({
                name: options.name,
            }));
        }

        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.jwt}`,
            },
            body: formData,
            signal: AbortSignal.timeout(this.config.timeout || this.defaultTimeout),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Pinata upload failed: ${error}`);
        }

        const result = await response.json() as { IpfsHash: string; PinSize: number };

        return {
            cid: result.IpfsHash,
            ipfsUri: this.getIPFSUri(result.IpfsHash),
            gatewayUrl: this.getGatewayUrl(result.IpfsHash),
            size: result.PinSize,
            timestamp: Date.now(),
        };
    }

    /**
     * Upload to generic IPFS API (like Infura or local node)
     */
    private async uploadToIPFSAPI(
        content: Uint8Array,
        options?: { name?: string; wrapWithDirectory?: boolean; pinToIPFS?: boolean }
    ): Promise<IPFSUploadResult> {
        const apiUrl = this.config.apiUrl || 'https://ipfs.infura.io:5001';

        const formData = new FormData();
        const buffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        formData.append('file', blob, options?.name || 'file');

        const headers: Record<string, string> = {};

        // Add auth for Infura-style APIs
        if (this.config.apiKey && this.config.apiSecret) {
            const auth = btoa(`${this.config.apiKey}:${this.config.apiSecret}`);
            headers['Authorization'] = `Basic ${auth}`;
        }

        const url = new URL('/api/v0/add', apiUrl);
        if (options?.pinToIPFS !== false) {
            url.searchParams.set('pin', 'true');
        }
        if (options?.wrapWithDirectory) {
            url.searchParams.set('wrap-with-directory', 'true');
        }

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers,
            body: formData,
            signal: AbortSignal.timeout(this.config.timeout || this.defaultTimeout),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`IPFS upload failed: ${error}`);
        }

        const result = await response.json() as { Hash: string; Size: string };

        return {
            cid: result.Hash,
            ipfsUri: this.getIPFSUri(result.Hash),
            gatewayUrl: this.getGatewayUrl(result.Hash),
            size: parseInt(result.Size, 10),
            timestamp: Date.now(),
        };
    }
}

/**
 * Create an IPFS client from environment variables
 * 
 * Supports the following environment variables:
 * - IPFS_GATEWAY_URL: Gateway for reading content (required)
 * - IPFS_API_URL: API endpoint for uploading
 * - IPFS_API_KEY: API key for authenticated services
 * - IPFS_API_SECRET: API secret for authenticated services
 * - IPFS_JWT: JWT token for Pinata
 * 
 * For frontend (Vite), use VITE_ prefix:
 * - VITE_IPFS_GATEWAY_URL
 * - VITE_IPFS_API_URL
 * - VITE_IPFS_JWT (Pinata JWT)
 */
export function ipfsClient(envPrefix: '' | 'VITE_' = ''): IPFSClient {
    const getEnv = (key: string): string | undefined => {
        // Browser environment (Vite)
        if (typeof import.meta !== 'undefined') {
            const meta = import.meta as unknown as { env?: Record<string, string> };
            if (meta.env) {
                return meta.env[key];
            }
        }
        // Node.js environment
        if (typeof process !== 'undefined' && process.env) {
            return process.env[key];
        }
        return undefined;
    };

    const gatewayUrl = getEnv(`${envPrefix}IPFS_GATEWAY_URL`) || 'https://gateway.pinata.cloud';
    const apiUrl = getEnv(`${envPrefix}IPFS_API_URL`);
    const apiKey = getEnv(`${envPrefix}IPFS_API_KEY`);
    const apiSecret = getEnv(`${envPrefix}IPFS_API_SECRET`);
    const jwt = getEnv(`${envPrefix}IPFS_JWT`);

    return new IPFSClient({
        gatewayUrl,
        apiUrl,
        apiKey,
        apiSecret,
        jwt,
    });
}

/**
 * Default IPFS gateways for fallback
 */
export const DEFAULT_IPFS_GATEWAYS = [
    'https://gateway.pinata.cloud',
    'https://ipfs.io',
    'https://cloudflare-ipfs.com',
    'https://dweb.link',
    'https://w3s.link',
] as const;

/**
 * Encryption utilities for recovery keys (using Web Crypto API)
 */
export const RecoveryKeyUtils = {
    /**
     * Encrypt recovery key data for IPFS storage
     */
    async encrypt(data: string, password: string): Promise<RecoveryKeyData> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);

        // Generate salt and IV
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Derive key from password
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        // Encrypt data
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            dataBuffer
        );

        // Convert to base64
        const encryptedKey = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        const saltB64 = btoa(String.fromCharCode(...salt));
        const ivB64 = btoa(String.fromCharCode(...iv));

        return {
            encryptedKey,
            salt: saltB64,
            iv: ivB64,
            algorithm: 'AES-GCM-256-PBKDF2',
            version: 1,
            createdAt: Date.now(),
        };
    },

    /**
     * Decrypt recovery key data from IPFS
     */
    async decrypt(recoveryData: RecoveryKeyData, password: string): Promise<string> {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        // Decode base64
        const encrypted = Uint8Array.from(atob(recoveryData.encryptedKey), c => c.charCodeAt(0));
        const salt = Uint8Array.from(atob(recoveryData.salt), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(recoveryData.iv), c => c.charCodeAt(0));

        // Derive key from password
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        // Decrypt data
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );

        return decoder.decode(decrypted);
    },
};
