use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("FeRHaZXb3tbmjWWSwZXQX1HH7DSvAM7nR3mdSxN6VjpJ");

/// Cash.io Privacy Bridge Program for Solana
/// 
/// This program handles cross-chain deposits and withdrawals between
/// Solana and the Cash.io hub chain (Avalanche Subnet).
/// 
/// Features:
/// - Deposit SOL/SPL tokens with privacy commitments
/// - Process verified withdrawals from hub chain
/// - Guardian-based verification system
/// - Merkle tree commitment tracking
#[program]
pub mod cashio_bridge {
    use super::*;

    /// Initialize the bridge with configuration
    pub fn initialize(
        ctx: Context<Initialize>,
        hub_chain_id: u64,
        guardian_threshold: u8,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.authority = ctx.accounts.authority.key();
        bridge.hub_chain_id = hub_chain_id;
        bridge.guardian_threshold = guardian_threshold;
        bridge.deposit_nonce = 0;
        bridge.total_deposited = 0;
        bridge.total_withdrawn = 0;
        bridge.is_paused = false;
        bridge.bump = ctx.bumps.bridge_state;
        
        msg!("Cash.io Bridge initialized");
        msg!("Hub Chain ID: {}", hub_chain_id);
        msg!("Guardian Threshold: {}", guardian_threshold);
        
        Ok(())
    }

    /// Add a guardian to the verification set
    pub fn add_guardian(
        ctx: Context<ManageGuardian>,
        guardian_pubkey: Pubkey,
    ) -> Result<()> {
        let guardian_account = &mut ctx.accounts.guardian;
        guardian_account.pubkey = guardian_pubkey;
        guardian_account.is_active = true;
        guardian_account.added_at = Clock::get()?.unix_timestamp;
        
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.guardian_count += 1;
        
        emit!(GuardianAdded {
            guardian: guardian_pubkey,
            added_by: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Remove a guardian from the verification set
    pub fn remove_guardian(ctx: Context<ManageGuardian>) -> Result<()> {
        let guardian = &mut ctx.accounts.guardian;
        require!(guardian.is_active, BridgeError::GuardianNotActive);
        
        guardian.is_active = false;
        
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.guardian_count -= 1;
        
        require!(
            bridge.guardian_count >= bridge.guardian_threshold as u64,
            BridgeError::InsufficientGuardians
        );
        
        emit!(GuardianRemoved {
            guardian: guardian.pubkey,
            removed_by: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Deposit SOL with a privacy commitment
    /// This creates a shielded note on the hub chain
    pub fn deposit_sol(
        ctx: Context<DepositSol>,
        amount: u64,
        commitment: [u8; 32],  // Poseidon hash commitment
    ) -> Result<()> {
        let bridge = &ctx.accounts.bridge_state;
        require!(!bridge.is_paused, BridgeError::BridgePaused);
        require!(amount >= MIN_DEPOSIT, BridgeError::AmountTooSmall);
        require!(amount <= MAX_DEPOSIT, BridgeError::AmountTooLarge);

        // Transfer SOL to bridge vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        // Create deposit record
        let deposit = &mut ctx.accounts.deposit;
        deposit.depositor = ctx.accounts.depositor.key();
        deposit.commitment = commitment;
        deposit.amount = amount;
        deposit.nonce = ctx.accounts.bridge_state.deposit_nonce;
        deposit.timestamp = Clock::get()?.unix_timestamp;
        deposit.processed = false;
        deposit.bump = ctx.bumps.deposit;

        // Update bridge state
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.deposit_nonce += 1;
        bridge.total_deposited += amount;

        emit!(DepositEvent {
            depositor: ctx.accounts.depositor.key(),
            commitment,
            amount,
            nonce: deposit.nonce,
            timestamp: deposit.timestamp,
        });

        msg!("Deposit {} lamports with commitment", amount);
        
        Ok(())
    }

    /// Deposit SPL tokens with a privacy commitment
    pub fn deposit_token(
        ctx: Context<DepositToken>,
        amount: u64,
        commitment: [u8; 32],
    ) -> Result<()> {
        let bridge = &ctx.accounts.bridge_state;
        require!(!bridge.is_paused, BridgeError::BridgePaused);
        require!(amount >= MIN_DEPOSIT, BridgeError::AmountTooSmall);

        // Transfer tokens to bridge vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Create deposit record
        let deposit = &mut ctx.accounts.token_deposit;
        deposit.depositor = ctx.accounts.depositor.key();
        deposit.mint = ctx.accounts.mint.key();
        deposit.commitment = commitment;
        deposit.amount = amount;
        deposit.nonce = ctx.accounts.bridge_state.deposit_nonce;
        deposit.timestamp = Clock::get()?.unix_timestamp;
        deposit.processed = false;
        deposit.bump = ctx.bumps.token_deposit;

        // Update bridge state
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.deposit_nonce += 1;

        emit!(TokenDepositEvent {
            depositor: ctx.accounts.depositor.key(),
            mint: ctx.accounts.mint.key(),
            commitment,
            amount,
            nonce: deposit.nonce,
            timestamp: deposit.timestamp,
        });

        Ok(())
    }

    /// Process a verified withdrawal from the hub chain
    /// Requires guardian signatures
    pub fn process_withdrawal(
        ctx: Context<ProcessWithdrawal>,
        withdrawal_hash: [u8; 32],
        amount: u64,
        guardian_signatures: Vec<[u8; 64]>,
    ) -> Result<()> {
        let bridge = &ctx.accounts.bridge_state;
        require!(!bridge.is_paused, BridgeError::BridgePaused);
        require!(
            guardian_signatures.len() >= bridge.guardian_threshold as usize,
            BridgeError::InsufficientSignatures
        );

        // Verify the withdrawal hasn't been processed
        let withdrawal = &ctx.accounts.withdrawal;
        require!(!withdrawal.processed, BridgeError::WithdrawalAlreadyProcessed);

        // TODO: Verify Ed25519 signatures from guardians
        // In production, use ed25519 signature verification
        // For each guardian signature, verify against the withdrawal message
        
        // Mark as processed
        let withdrawal = &mut ctx.accounts.withdrawal;
        withdrawal.withdrawal_hash = withdrawal_hash;
        withdrawal.recipient = ctx.accounts.recipient.key();
        withdrawal.amount = amount;
        withdrawal.processed = true;
        withdrawal.timestamp = Clock::get()?.unix_timestamp;
        withdrawal.bump = ctx.bumps.withdrawal;

        // Transfer SOL from vault to recipient
        let transfer_amount = amount;
        **ctx.accounts.vault.try_borrow_mut_lamports()? -= transfer_amount;
        **ctx.accounts.recipient.try_borrow_mut_lamports()? += transfer_amount;

        // Update bridge state
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.total_withdrawn += amount;

        emit!(WithdrawalEvent {
            withdrawal_hash,
            recipient: ctx.accounts.recipient.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Processed withdrawal of {} lamports", amount);
        
        Ok(())
    }

    /// Emergency pause the bridge
    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.is_paused = true;
        msg!("Bridge paused");
        Ok(())
    }

    /// Unpause the bridge
    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge_state;
        bridge.is_paused = false;
        msg!("Bridge unpaused");
        Ok(())
    }

    /// Update guardian threshold
    pub fn update_threshold(
        ctx: Context<AdminAction>,
        new_threshold: u8,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge_state;
        require!(
            new_threshold as u64 <= bridge.guardian_count,
            BridgeError::ThresholdTooHigh
        );
        bridge.guardian_threshold = new_threshold;
        
        emit!(ThresholdUpdated {
            old_threshold: bridge.guardian_threshold,
            new_threshold,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

// ============ Constants ============

pub const MIN_DEPOSIT: u64 = 10_000_000;      // 0.01 SOL (10M lamports)
pub const MAX_DEPOSIT: u64 = 100_000_000_000; // 100 SOL

// ============ State Accounts ============

#[account]
#[derive(Default)]
pub struct BridgeState {
    /// Bridge authority (admin)
    pub authority: Pubkey,
    /// Hub chain ID (Avalanche Subnet)
    pub hub_chain_id: u64,
    /// Number of signatures required
    pub guardian_threshold: u8,
    /// Number of active guardians
    pub guardian_count: u64,
    /// Deposit nonce counter
    pub deposit_nonce: u64,
    /// Total SOL deposited
    pub total_deposited: u64,
    /// Total SOL withdrawn
    pub total_withdrawn: u64,
    /// Pause flag
    pub is_paused: bool,
    /// PDA bump
    pub bump: u8,
}

#[account]
pub struct Guardian {
    /// Guardian public key
    pub pubkey: Pubkey,
    /// Whether guardian is active
    pub is_active: bool,
    /// When guardian was added
    pub added_at: i64,
}

#[account]
pub struct Deposit {
    /// Depositor's public key
    pub depositor: Pubkey,
    /// Poseidon commitment hash
    pub commitment: [u8; 32],
    /// Deposit amount in lamports
    pub amount: u64,
    /// Unique deposit nonce
    pub nonce: u64,
    /// Unix timestamp
    pub timestamp: i64,
    /// Whether deposit was relayed to hub
    pub processed: bool,
    /// PDA bump
    pub bump: u8,
}

#[account]
pub struct TokenDeposit {
    /// Depositor's public key
    pub depositor: Pubkey,
    /// Token mint address
    pub mint: Pubkey,
    /// Poseidon commitment hash
    pub commitment: [u8; 32],
    /// Deposit amount
    pub amount: u64,
    /// Unique deposit nonce
    pub nonce: u64,
    /// Unix timestamp
    pub timestamp: i64,
    /// Whether deposit was relayed to hub
    pub processed: bool,
    /// PDA bump
    pub bump: u8,
}

#[account]
pub struct Withdrawal {
    /// Hash of the withdrawal request from hub chain
    pub withdrawal_hash: [u8; 32],
    /// Recipient's public key
    pub recipient: Pubkey,
    /// Withdrawal amount
    pub amount: u64,
    /// Whether withdrawal was processed
    pub processed: bool,
    /// Unix timestamp
    pub timestamp: i64,
    /// PDA bump
    pub bump: u8,
}

// ============ Contexts ============

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1 + 8 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    /// CHECK: This is the SOL vault PDA
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageGuardian<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump = bridge_state.bump,
        has_one = authority
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 32 + 1 + 8,
        seeds = [b"guardian", guardian.key().as_ref()],
        bump
    )]
    pub guardian: Account<'info, Guardian>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, commitment: [u8; 32])]
pub struct DepositSol<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump = bridge_state.bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(
        init,
        payer = depositor,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"deposit", bridge_state.deposit_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub deposit: Account<'info, Deposit>,
    
    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, commitment: [u8; 32])]
pub struct DepositToken<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump = bridge_state.bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(
        init,
        payer = depositor,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"token_deposit", bridge_state.deposit_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub token_deposit: Account<'info, TokenDeposit>,
    
    /// CHECK: Token mint
    pub mint: UncheckedAccount<'info>,
    
    #[account(
        mut,
        constraint = depositor_token_account.owner == depositor.key()
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault_token", mint.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(withdrawal_hash: [u8; 32])]
pub struct ProcessWithdrawal<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump = bridge_state.bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 8 + 1 + 8 + 1,
        seeds = [b"withdrawal", withdrawal_hash.as_ref()],
        bump
    )]
    pub withdrawal: Account<'info, Withdrawal>,
    
    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    
    /// CHECK: Withdrawal recipient
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump = bridge_state.bump,
        has_one = authority
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    pub authority: Signer<'info>,
}

// ============ Events ============

#[event]
pub struct DepositEvent {
    pub depositor: Pubkey,
    pub commitment: [u8; 32],
    pub amount: u64,
    pub nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenDepositEvent {
    pub depositor: Pubkey,
    pub mint: Pubkey,
    pub commitment: [u8; 32],
    pub amount: u64,
    pub nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawalEvent {
    pub withdrawal_hash: [u8; 32],
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct GuardianAdded {
    pub guardian: Pubkey,
    pub added_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct GuardianRemoved {
    pub guardian: Pubkey,
    pub removed_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ThresholdUpdated {
    pub old_threshold: u8,
    pub new_threshold: u8,
    pub timestamp: i64,
}

// ============ Errors ============

#[error_code]
pub enum BridgeError {
    #[msg("Bridge is currently paused")]
    BridgePaused,
    #[msg("Deposit amount is too small")]
    AmountTooSmall,
    #[msg("Deposit amount is too large")]
    AmountTooLarge,
    #[msg("Insufficient guardian signatures")]
    InsufficientSignatures,
    #[msg("Withdrawal has already been processed")]
    WithdrawalAlreadyProcessed,
    #[msg("Guardian is not active")]
    GuardianNotActive,
    #[msg("Cannot have fewer guardians than threshold")]
    InsufficientGuardians,
    #[msg("Threshold is higher than guardian count")]
    ThresholdTooHigh,
    #[msg("Invalid signature")]
    InvalidSignature,
}
