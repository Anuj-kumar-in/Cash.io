import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";

// Package ID - deployed to Sui testnet
const PACKAGE_ID = "0xbc4b492312d1a16139c8035cf34e521ac1db96a8850f7447c2318b90cf489366";
const MODULE_NAME = "bridge";
const BRIDGE_STATE_ID = "0x746ddcfab675fcfe7ab931e7f2713d7f4817aeea9a1375746d194f4a76d3f06f";

export interface BridgeStats {
  vaultBalance: bigint;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  depositNonce: bigint;
  isPaused: boolean;
}

export interface DepositEvent {
  depositor: string;
  commitment: string;
  amount: bigint;
  nonce: bigint;
  timestamp: bigint;
}

export interface WithdrawalEvent {
  withdrawalHash: string;
  recipient: string;
  amount: bigint;
  timestamp: bigint;
}

export class SuiBridgeClient {
  private client: SuiClient;
  private keypair?: Ed25519Keypair;
  private bridgeStateId?: string;
  private adminCapId?: string;
  private guardianCapId?: string;

  constructor(network: "testnet" | "mainnet" = "testnet", secretKey?: string) {
    const url = getFullnodeUrl(network);
    this.client = new SuiClient({ url });

    if (secretKey) {
      this.keypair = Ed25519Keypair.fromSecretKey(
        Buffer.from(secretKey, "base64")
      );
    }
  }

  /**
   * Set bridge state object ID
   */
  setBridgeStateId(id: string): void {
    this.bridgeStateId = id;
  }

  /**
   * Set admin capability ID
   */
  setAdminCapId(id: string): void {
    this.adminCapId = id;
  }

  /**
   * Set guardian capability ID
   */
  setGuardianCapId(id: string): void {
    this.guardianCapId = id;
  }

  /**
   * Get bridge statistics
   */
  async getStats(): Promise<BridgeStats> {
    if (!this.bridgeStateId) {
      throw new Error("Bridge state ID not set");
    }

    const object = await this.client.getObject({
      id: this.bridgeStateId,
      options: { showContent: true },
    });

    if (object.data?.content?.dataType !== "moveObject") {
      throw new Error("Invalid bridge state object");
    }

    const fields = (object.data.content as any).fields;

    return {
      vaultBalance: BigInt(fields.vault.fields.balance),
      totalDeposited: BigInt(fields.total_deposited),
      totalWithdrawn: BigInt(fields.total_withdrawn),
      depositNonce: BigInt(fields.deposit_nonce),
      isPaused: fields.is_paused,
    };
  }

  /**
   * Deposit SUI with commitment
   */
  async deposit(amountMist: bigint, commitment: Uint8Array): Promise<string> {
    if (!this.keypair || !this.bridgeStateId) {
      throw new Error("Keypair and bridge state ID required");
    }

    const tx = new TransactionBlock();

    // Split coin for deposit
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(amountMist)]);

    // Get clock object
    const clockId = "0x6";

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::deposit`,
      arguments: [
        tx.object(this.bridgeStateId),
        coin,
        tx.pure(Array.from(commitment)),
        tx.object(clockId),
      ],
    });

    const result = await this.client.signAndExecuteTransactionBlock({
      signer: this.keypair,
      transactionBlock: tx,
      options: {
        showEvents: true,
        showEffects: true,
      },
    });

    return result.digest;
  }

  /**
   * Process withdrawal (guardian only)
   */
  async processWithdrawal(
    withdrawalHash: Uint8Array,
    recipient: string,
    amount: bigint
  ): Promise<string> {
    if (!this.keypair || !this.bridgeStateId || !this.guardianCapId) {
      throw new Error("Keypair, bridge state ID, and guardian cap required");
    }

    const tx = new TransactionBlock();
    const clockId = "0x6";

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::process_withdrawal`,
      arguments: [
        tx.object(this.guardianCapId),
        tx.object(this.bridgeStateId),
        tx.pure(Array.from(withdrawalHash)),
        tx.pure(recipient),
        tx.pure(amount),
        tx.object(clockId),
      ],
    });

    const result = await this.client.signAndExecuteTransactionBlock({
      signer: this.keypair,
      transactionBlock: tx,
      options: {
        showEvents: true,
        showEffects: true,
      },
    });

    return result.digest;
  }

  /**
   * Get deposit events
   */
  async getDepositEvents(limit: number = 100): Promise<DepositEvent[]> {
    const events = await this.client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::DepositEvent`,
      },
      limit,
    });

    return events.data.map((event) => {
      const parsed = event.parsedJson as any;
      return {
        depositor: parsed.depositor,
        commitment: parsed.commitment,
        amount: BigInt(parsed.amount),
        nonce: BigInt(parsed.nonce),
        timestamp: BigInt(parsed.timestamp),
      };
    });
  }

  /**
   * Get withdrawal events
   */
  async getWithdrawalEvents(limit: number = 100): Promise<WithdrawalEvent[]> {
    const events = await this.client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::WithdrawalEvent`,
      },
      limit,
    });

    return events.data.map((event) => {
      const parsed = event.parsedJson as any;
      return {
        withdrawalHash: parsed.withdrawal_hash,
        recipient: parsed.recipient,
        amount: BigInt(parsed.amount),
        timestamp: BigInt(parsed.timestamp),
      };
    });
  }

  /**
   * Check if commitment is used
   */
  async isCommitmentUsed(commitment: Uint8Array): Promise<boolean> {
    // This would require a view function call
    // For now, check via events
    const events = await this.getDepositEvents(1000);
    const commitmentHex = Buffer.from(commitment).toString("hex");
    return events.some((e) => e.commitment === commitmentHex);
  }

  /**
   * Get wallet address
   */
  getAddress(): string | undefined {
    return this.keypair?.toSuiAddress();
  }
}

/**
 * Generate commitment for Sui
 */
export function generateCommitment(
  amount: bigint,
  secret: Uint8Array
): Uint8Array {
  const crypto = require("crypto");
  const amountBytes = Buffer.alloc(8);
  amountBytes.writeBigUInt64LE(amount);
  const data = Buffer.concat([amountBytes, Buffer.from(secret)]);
  return crypto.createHash("sha256").update(data).digest();
}

/**
 * Create a new random secret
 */
export function generateSecret(): Uint8Array {
  const crypto = require("crypto");
  return crypto.randomBytes(32);
}
