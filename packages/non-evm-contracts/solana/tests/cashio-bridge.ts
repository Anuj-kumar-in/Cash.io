import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { CashioBridge } from "../target/types/cashio_bridge";

describe("cashio-bridge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CashioBridge as Program<CashioBridge>;
  
  const authority = provider.wallet.publicKey;
  
  // PDAs
  let bridgeStatePDA: PublicKey;
  let vaultPDA: PublicKey;
  
  const HUB_CHAIN_ID = new anchor.BN(999888777);
  const GUARDIAN_THRESHOLD = 1;

  before(async () => {
    // Derive PDAs
    [bridgeStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridge_state")],
      program.programId
    );
    
    [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );
  });

  it("Initializes the bridge", async () => {
    const tx = await program.methods
      .initialize(HUB_CHAIN_ID, GUARDIAN_THRESHOLD)
      .accounts({
        bridgeState: bridgeStatePDA,
        vault: vaultPDA,
        authority: authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize tx:", tx);

    // Verify state
    const bridgeState = await program.account.bridgeState.fetch(bridgeStatePDA);
    expect(bridgeState.authority.toString()).to.equal(authority.toString());
    expect(bridgeState.hubChainId.toString()).to.equal(HUB_CHAIN_ID.toString());
    expect(bridgeState.guardianThreshold).to.equal(GUARDIAN_THRESHOLD);
    expect(bridgeState.isPaused).to.be.false;
    expect(bridgeState.depositNonce.toString()).to.equal("0");
  });

  it("Adds a guardian", async () => {
    const guardianKeypair = Keypair.generate();
    
    const [guardianPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("guardian"), guardianKeypair.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .addGuardian(guardianKeypair.publicKey)
      .accounts({
        bridgeState: bridgeStatePDA,
        guardian: guardianPDA,
        authority: authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Add guardian tx:", tx);

    // Verify guardian
    const guardian = await program.account.guardian.fetch(guardianPDA);
    expect(guardian.isActive).to.be.true;
    expect(guardian.pubkey.toString()).to.equal(guardianKeypair.publicKey.toString());
    
    // Verify bridge state updated
    const bridgeState = await program.account.bridgeState.fetch(bridgeStatePDA);
    expect(bridgeState.guardianCount.toString()).to.equal("1");
  });

  it("Deposits SOL with commitment", async () => {
    const bridgeState = await program.account.bridgeState.fetch(bridgeStatePDA);
    const nonce = bridgeState.depositNonce;
    
    const [depositPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), nonce.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    // Generate a mock commitment (in production, this is a Poseidon hash)
    const commitment = Buffer.alloc(32);
    commitment.fill(1);

    const depositAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    const tx = await program.methods
      .depositSol(depositAmount, Array.from(commitment))
      .accounts({
        bridgeState: bridgeStatePDA,
        deposit: depositPDA,
        vault: vaultPDA,
        depositor: authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Deposit tx:", tx);

    // Verify deposit
    const deposit = await program.account.deposit.fetch(depositPDA);
    expect(deposit.depositor.toString()).to.equal(authority.toString());
    expect(deposit.amount.toString()).to.equal(depositAmount.toString());
    expect(deposit.processed).to.be.false;
    
    // Verify nonce incremented
    const newBridgeState = await program.account.bridgeState.fetch(bridgeStatePDA);
    expect(newBridgeState.depositNonce.toString()).to.equal("1");
    expect(newBridgeState.totalDeposited.toString()).to.equal(depositAmount.toString());
  });

  it("Pauses and unpauses the bridge", async () => {
    // Pause
    await program.methods
      .pause()
      .accounts({
        bridgeState: bridgeStatePDA,
        authority: authority,
      })
      .rpc();

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePDA);
    expect(bridgeState.isPaused).to.be.true;

    // Unpause
    await program.methods
      .unpause()
      .accounts({
        bridgeState: bridgeStatePDA,
        authority: authority,
      })
      .rpc();

    bridgeState = await program.account.bridgeState.fetch(bridgeStatePDA);
    expect(bridgeState.isPaused).to.be.false;
  });

  it("Cannot deposit when paused", async () => {
    // Pause first
    await program.methods
      .pause()
      .accounts({
        bridgeState: bridgeStatePDA,
        authority: authority,
      })
      .rpc();

    const bridgeState = await program.account.bridgeState.fetch(bridgeStatePDA);
    const nonce = bridgeState.depositNonce;
    
    const [depositPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), nonce.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const commitment = Buffer.alloc(32);
    commitment.fill(2);
    const depositAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    try {
      await program.methods
        .depositSol(depositAmount, Array.from(commitment))
        .accounts({
          bridgeState: bridgeStatePDA,
          deposit: depositPDA,
          vault: vaultPDA,
          depositor: authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.toString()).to.include("BridgePaused");
    }

    // Unpause for future tests
    await program.methods
      .unpause()
      .accounts({
        bridgeState: bridgeStatePDA,
        authority: authority,
      })
      .rpc();
  });

  it("Updates guardian threshold", async () => {
    const newThreshold = 1;
    
    await program.methods
      .updateThreshold(newThreshold)
      .accounts({
        bridgeState: bridgeStatePDA,
        authority: authority,
      })
      .rpc();

    const bridgeState = await program.account.bridgeState.fetch(bridgeStatePDA);
    expect(bridgeState.guardianThreshold).to.equal(newThreshold);
  });
});
