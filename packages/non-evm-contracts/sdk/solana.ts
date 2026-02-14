import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Program ID - deployed on devnet
const PROGRAM_ID = new PublicKey("FeRHaZXb3tbmjWWSwZXQX1HH7DSvAM7nR3mdSxN6VjpJ");

export interface BridgeState {
  authority: PublicKey;
  hubChainId: BN;
  guardianThreshold: number;
  guardianCount: BN;
  depositNonce: BN;
  totalDeposited: BN;
  totalWithdrawn: BN;
  isPaused: boolean;
}

export interface Deposit {
  depositor: PublicKey;
  commitment: Uint8Array;
  amount: BN;
  nonce: BN;
  timestamp: BN;
  processed: boolean;
}

export interface DepositEvent {
  depositor: PublicKey;
  commitment: Uint8Array;
  amount: BN;
  nonce: BN;
  timestamp: BN;
}

export class SolanaBridgeClient {
  private connection: Connection;
  private program: Program | null = null;
  private provider: AnchorProvider | null = null;
  private bridgeStatePDA: PublicKey;
  private vaultPDA: PublicKey;

  constructor(
    endpoint: string = "https://api.devnet.solana.com",
    private wallet?: Keypair
  ) {
    this.connection = new Connection(endpoint, "confirmed");

    // Derive PDAs
    [this.bridgeStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridge_state")],
      PROGRAM_ID
    );

    [this.vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      PROGRAM_ID
    );
  }

  /**
   * Initialize the Anchor program
   */
  async initialize(idl: any): Promise<void> {
    if (!this.wallet) {
      throw new Error("Wallet required for initialization");
    }

    const wallet = new Wallet(this.wallet);
    this.provider = new AnchorProvider(this.connection, wallet, {
      commitment: "confirmed",
    });
    this.program = new Program(idl, PROGRAM_ID, this.provider);
  }

  /**
   * Get bridge state
   */
  async getBridgeState(): Promise<BridgeState> {
    if (!this.program) {
      throw new Error("Program not initialized");
    }

    const state = await this.program.account.bridgeState.fetch(
      this.bridgeStatePDA
    );
    return state as BridgeState;
  }

  /**
   * Get deposit by nonce
   */
  async getDeposit(nonce: BN): Promise<Deposit> {
    if (!this.program) {
      throw new Error("Program not initialized");
    }

    const [depositPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), nonce.toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );

    const deposit = await this.program.account.deposit.fetch(depositPDA);
    return deposit as Deposit;
  }

  /**
   * Deposit SOL with commitment
   */
  async depositSol(
    amount: number,
    commitment: Uint8Array
  ): Promise<string> {
    if (!this.program || !this.wallet) {
      throw new Error("Program not initialized");
    }

    const bridgeState = await this.getBridgeState();
    const nonce = bridgeState.depositNonce;

    const [depositPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), nonce.toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );

    const depositAmount = new BN(amount * LAMPORTS_PER_SOL);

    const tx = await this.program.methods
      .depositSol(depositAmount, Array.from(commitment))
      .accounts({
        bridgeState: this.bridgeStatePDA,
        deposit: depositPDA,
        vault: this.vaultPDA,
        depositor: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Get all deposit events (for relayer)
   */
  async getDepositEvents(fromSlot?: number): Promise<DepositEvent[]> {
    const signatures = await this.connection.getSignaturesForAddress(PROGRAM_ID, {
      limit: 100,
    });

    const events: DepositEvent[] = [];

    for (const sig of signatures) {
      const tx = await this.connection.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (tx?.meta?.logMessages) {
        for (const log of tx.meta.logMessages) {
          if (log.includes("Deposit")) {
            // Parse deposit event from logs
            // In production, use Anchor event parsing
            console.log("Deposit event found:", log);
          }
        }
      }
    }

    return events;
  }

  /**
   * Get vault balance
   */
  async getVaultBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.vaultPDA);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Check if bridge is paused
   */
  async isPaused(): Promise<boolean> {
    const state = await this.getBridgeState();
    return state.isPaused;
  }

  /**
   * Get program ID
   */
  getProgramId(): PublicKey {
    return PROGRAM_ID;
  }
}

/**
 * Generate Poseidon-style commitment for Solana
 * Note: For actual Poseidon, use a proper implementation
 */
export function generateCommitment(amount: BN, secret: Uint8Array): Uint8Array {
  const crypto = require("crypto");
  const data = Buffer.concat([
    amount.toArrayLike(Buffer, "le", 8),
    Buffer.from(secret),
  ]);
  return crypto.createHash("sha256").update(data).digest();
}

/**
 * Create a new random secret
 */
export function generateSecret(): Uint8Array {
  const crypto = require("crypto");
  return crypto.randomBytes(32);
}
