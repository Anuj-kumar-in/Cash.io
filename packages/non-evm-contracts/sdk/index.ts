/**
 * Cash.io Non-EVM Bridge SDK
 * 
 * Unified interface for interacting with Cash.io bridges on
 * Solana, Sui, and NEAR Protocol.
 */

export * from "./solana";
export * from "./sui";
export * from "./near";

import { SolanaBridgeClient } from "./solana";
import { SuiBridgeClient } from "./sui";
import { NearBridgeClient } from "./near";

export type ChainType = "solana" | "sui" | "near";

export interface BridgeConfig {
  chain: ChainType;
  endpoint?: string;
  privateKey?: string;
  accountId?: string;
}

export interface UnifiedBridgeStats {
  chain: ChainType;
  vaultBalance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  depositNonce: number;
  isPaused: boolean;
}

/**
 * Unified bridge client factory
 */
export function createBridgeClient(
  config: BridgeConfig
): SolanaBridgeClient | SuiBridgeClient | NearBridgeClient {
  switch (config.chain) {
    case "solana":
      return new SolanaBridgeClient(config.endpoint);
    case "sui":
      return new SuiBridgeClient(
        config.endpoint as "testnet" | "mainnet",
        config.privateKey
      );
    case "near":
      return new NearBridgeClient(
        config.endpoint as "testnet" | "mainnet",
        config.accountId,
        config.privateKey
      );
    default:
      throw new Error(`Unsupported chain: ${config.chain}`);
  }
}

/**
 * Multi-chain bridge manager for agents
 */
export class NonEvmBridgeManager {
  private solanaClient?: SolanaBridgeClient;
  private suiClient?: SuiBridgeClient;
  private nearClient?: NearBridgeClient;

  constructor() {}

  /**
   * Add Solana bridge
   */
  addSolana(endpoint?: string): this {
    this.solanaClient = new SolanaBridgeClient(endpoint);
    return this;
  }

  /**
   * Add Sui bridge
   */
  addSui(network: "testnet" | "mainnet" = "testnet", privateKey?: string): this {
    this.suiClient = new SuiBridgeClient(network, privateKey);
    return this;
  }

  /**
   * Add NEAR bridge
   */
  addNear(network: "testnet" | "mainnet" = "testnet"): this {
    this.nearClient = new NearBridgeClient(network);
    return this;
  }

  /**
   * Get all bridge stats
   */
  async getAllStats(): Promise<UnifiedBridgeStats[]> {
    const stats: UnifiedBridgeStats[] = [];

    if (this.solanaClient) {
      try {
        const solanaState = await this.solanaClient.getBridgeState();
        stats.push({
          chain: "solana",
          vaultBalance: solanaState.totalDeposited.sub(solanaState.totalWithdrawn).toString(),
          totalDeposited: solanaState.totalDeposited.toString(),
          totalWithdrawn: solanaState.totalWithdrawn.toString(),
          depositNonce: solanaState.depositNonce.toNumber(),
          isPaused: solanaState.isPaused,
        });
      } catch (e) {
        console.warn("Failed to get Solana stats:", e);
      }
    }

    if (this.suiClient) {
      try {
        const suiStats = await this.suiClient.getStats();
        stats.push({
          chain: "sui",
          vaultBalance: suiStats.vaultBalance.toString(),
          totalDeposited: suiStats.totalDeposited.toString(),
          totalWithdrawn: suiStats.totalWithdrawn.toString(),
          depositNonce: Number(suiStats.depositNonce),
          isPaused: suiStats.isPaused,
        });
      } catch (e) {
        console.warn("Failed to get Sui stats:", e);
      }
    }

    if (this.nearClient) {
      try {
        const nearStats = await this.nearClient.getStats();
        stats.push({
          chain: "near",
          vaultBalance: nearStats.vaultBalance,
          totalDeposited: nearStats.totalDeposited,
          totalWithdrawn: nearStats.totalWithdrawn,
          depositNonce: nearStats.depositNonce,
          isPaused: nearStats.isPaused,
        });
      } catch (e) {
        console.warn("Failed to get NEAR stats:", e);
      }
    }

    return stats;
  }

  /**
   * Get client by chain
   */
  getClient(
    chain: ChainType
  ): SolanaBridgeClient | SuiBridgeClient | NearBridgeClient | undefined {
    switch (chain) {
      case "solana":
        return this.solanaClient;
      case "sui":
        return this.suiClient;
      case "near":
        return this.nearClient;
    }
  }

  /**
   * Check if any bridge is paused
   */
  async getActiveBridges(): Promise<ChainType[]> {
    const active: ChainType[] = [];

    if (this.solanaClient) {
      try {
        if (!(await this.solanaClient.isPaused())) {
          active.push("solana");
        }
      } catch {}
    }

    if (this.suiClient) {
      try {
        const stats = await this.suiClient.getStats();
        if (!stats.isPaused) {
          active.push("sui");
        }
      } catch {}
    }

    if (this.nearClient) {
      try {
        if (!(await this.nearClient.isPaused())) {
          active.push("near");
        }
      } catch {}
    }

    return active;
  }
}

/**
 * Generate a random commitment secret
 */
export function generateRandomSecret(): Uint8Array {
  const crypto = require("crypto");
  return crypto.randomBytes(32);
}

/**
 * Convert amount to chain-specific format
 */
export function toChainAmount(amount: number, chain: ChainType): string {
  switch (chain) {
    case "solana":
      return (amount * 1e9).toString(); // lamports
    case "sui":
      return (amount * 1e9).toString(); // mist
    case "near":
      return (amount * 1e24).toString(); // yoctoNEAR
    default:
      throw new Error(`Unknown chain: ${chain}`);
  }
}

/**
 * Convert from chain-specific amount to human-readable
 */
export function fromChainAmount(amount: string, chain: ChainType): number {
  switch (chain) {
    case "solana":
      return Number(amount) / 1e9;
    case "sui":
      return Number(amount) / 1e9;
    case "near":
      return Number(amount) / 1e24;
    default:
      throw new Error(`Unknown chain: ${chain}`);
  }
}
