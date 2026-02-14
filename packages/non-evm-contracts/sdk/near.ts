import { connect, keyStores, KeyPair, Contract, utils } from "near-api-js";
import { FinalExecutionOutcome } from "near-api-js/lib/providers";

// Contract config - update after deployment
const CONTRACT_ID = {
  testnet: "cashio.testnet",
  mainnet: "cashio.near",
};

export interface BridgeStats {
  vaultBalance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  depositNonce: number;
  isPaused: boolean;
}

export interface Deposit {
  depositor: string;
  commitment: string;
  amount: string;
  nonce: number;
  timestamp: number;
  processed: boolean;
}

export interface DepositEvent {
  depositor: string;
  commitment: string;
  amount: string;
  nonce: number;
  timestamp: number;
}

export interface WithdrawalEvent {
  withdrawalHash: string;
  recipient: string;
  amount: string;
  timestamp: number;
}

export class NearBridgeClient {
  private connection: any;
  private contract: any;
  private accountId: string;
  private network: "testnet" | "mainnet";

  constructor(
    network: "testnet" | "mainnet" = "testnet",
    accountId?: string,
    privateKey?: string
  ) {
    this.network = network;
    this.accountId = accountId || CONTRACT_ID[network];
  }

  /**
   * Initialize the connection
   */
  async initialize(accountId: string, privateKey: string): Promise<void> {
    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(privateKey);
    await keyStore.setKey(this.network, accountId, keyPair);

    const config = {
      networkId: this.network,
      keyStore,
      nodeUrl:
        this.network === "mainnet"
          ? "https://rpc.mainnet.near.org"
          : "https://rpc.testnet.near.org",
      walletUrl:
        this.network === "mainnet"
          ? "https://wallet.mainnet.near.org"
          : "https://wallet.testnet.near.org",
      helperUrl:
        this.network === "mainnet"
          ? "https://helper.mainnet.near.org"
          : "https://helper.testnet.near.org",
    };

    this.connection = await connect(config);
    this.accountId = accountId;

    const account = await this.connection.account(accountId);
    this.contract = new Contract(account, CONTRACT_ID[this.network], {
      viewMethods: [
        "get_stats",
        "get_deposit",
        "is_commitment_used",
        "is_withdrawal_processed",
        "get_guardians",
        "guardian_count",
        "is_guardian",
        "get_owner",
        "get_hub_chain_id",
        "get_guardian_threshold",
      ],
      changeMethods: [
        "deposit",
        "process_withdrawal",
        "add_guardian",
        "remove_guardian",
        "update_threshold",
        "pause",
        "unpause",
        "transfer_ownership",
      ],
    });
  }

  /**
   * Get bridge statistics
   */
  async getStats(): Promise<BridgeStats> {
    const stats = await this.contract.get_stats();
    return {
      vaultBalance: stats[0],
      totalDeposited: stats[1],
      totalWithdrawn: stats[2],
      depositNonce: stats[3],
      isPaused: stats[4],
    };
  }

  /**
   * Get deposit by nonce
   */
  async getDeposit(nonce: number): Promise<Deposit | null> {
    return await this.contract.get_deposit({ nonce });
  }

  /**
   * Deposit NEAR with commitment
   */
  async deposit(
    amountNear: string,
    commitment: string
  ): Promise<FinalExecutionOutcome> {
    const amountYocto = utils.format.parseNearAmount(amountNear);
    if (!amountYocto) {
      throw new Error("Invalid amount");
    }

    return await this.contract.deposit(
      { commitment },
      "300000000000000", // 300 TGas
      amountYocto
    );
  }

  /**
   * Process withdrawal (guardian only)
   */
  async processWithdrawal(
    withdrawalHash: string,
    recipient: string,
    amount: string
  ): Promise<FinalExecutionOutcome> {
    return await this.contract.process_withdrawal(
      {
        withdrawal_hash: withdrawalHash,
        recipient,
        amount,
      },
      "300000000000000" // 300 TGas
    );
  }

  /**
   * Add guardian (owner only)
   */
  async addGuardian(guardianId: string): Promise<FinalExecutionOutcome> {
    return await this.contract.add_guardian(
      { guardian_id: guardianId },
      "100000000000000" // 100 TGas
    );
  }

  /**
   * Remove guardian (owner only)
   */
  async removeGuardian(guardianId: string): Promise<FinalExecutionOutcome> {
    return await this.contract.remove_guardian(
      { guardian_id: guardianId },
      "100000000000000"
    );
  }

  /**
   * Check if commitment is used
   */
  async isCommitmentUsed(commitment: string): Promise<boolean> {
    return await this.contract.is_commitment_used({ commitment });
  }

  /**
   * Check if withdrawal is processed
   */
  async isWithdrawalProcessed(withdrawalHash: string): Promise<boolean> {
    return await this.contract.is_withdrawal_processed({
      withdrawal_hash: withdrawalHash,
    });
  }

  /**
   * Get guardian list
   */
  async getGuardians(): Promise<string[]> {
    return await this.contract.get_guardians();
  }

  /**
   * Check if account is guardian
   */
  async isGuardian(accountId: string): Promise<boolean> {
    return await this.contract.is_guardian({ account_id: accountId });
  }

  /**
   * Get owner
   */
  async getOwner(): Promise<string> {
    return await this.contract.get_owner();
  }

  /**
   * Check if bridge is paused
   */
  async isPaused(): Promise<boolean> {
    const stats = await this.getStats();
    return stats.isPaused;
  }

  /**
   * Pause bridge (owner only)
   */
  async pause(): Promise<FinalExecutionOutcome> {
    return await this.contract.pause({}, "50000000000000");
  }

  /**
   * Unpause bridge (owner only)
   */
  async unpause(): Promise<FinalExecutionOutcome> {
    return await this.contract.unpause({}, "50000000000000");
  }

  /**
   * Get contract ID
   */
  getContractId(): string {
    return CONTRACT_ID[this.network];
  }
}

/**
 * Generate commitment for NEAR
 */
export function generateCommitment(amount: string, secret: string): string {
  const crypto = require("crypto");
  const data = `${amount}:${secret}`;
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Create a new random secret
 */
export function generateSecret(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Parse NEAR events from transaction receipt
 */
export function parseEvents(
  outcome: FinalExecutionOutcome
): Array<{
  type: string;
  data: any;
}> {
  const events: Array<{ type: string; data: any }> = [];

  for (const receipt of outcome.receipts_outcome) {
    for (const log of receipt.outcome.logs) {
      if (log.startsWith("EVENT_JSON:")) {
        try {
          const eventData = JSON.parse(log.replace("EVENT_JSON:", ""));
          events.push({
            type: Object.keys(eventData)[0] || "unknown",
            data: eventData,
          });
        } catch (e) {
          // Skip malformed events
        }
      }
    }
  }

  return events;
}
