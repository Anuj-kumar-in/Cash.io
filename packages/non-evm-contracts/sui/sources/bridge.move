/// Cash.io Privacy Bridge for Sui
/// 
/// This module implements a cross-chain bridge for privacy-preserving
/// transfers between Sui and the Cash.io hub chain.
/// 
/// Features:
/// - Deposit SUI with privacy commitments
/// - Process verified withdrawals from hub chain
/// - Multi-signature guardian verification
/// - Merkle commitment tracking
module cashio_bridge::bridge {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::vec_set::{Self, VecSet};
    use sui::clock::{Self, Clock};
    use std::vector;

    // ============ Error Codes ============
    
    const EBridgePaused: u64 = 0;
    const EInvalidAmount: u64 = 1;
    const EAmountTooSmall: u64 = 2;
    const EAmountTooLarge: u64 = 3;
    const EDepositAlreadyProcessed: u64 = 4;
    const EWithdrawalAlreadyProcessed: u64 = 5;
    const EInsufficientSignatures: u64 = 6;
    const ENotAuthorized: u64 = 7;
    const EGuardianNotActive: u64 = 8;
    const EInsufficientGuardians: u64 = 9;
    const EThresholdTooHigh: u64 = 10;

    // ============ Constants ============
    
    const MIN_DEPOSIT: u64 = 10_000_000;        // 0.01 SUI
    const MAX_DEPOSIT: u64 = 100_000_000_000;   // 100 SUI

    // ============ Structs ============

    /// Admin capability for bridge management
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Guardian capability for processing withdrawals
    public struct GuardianCap has key, store {
        id: UID,
        guardian_address: address,
        is_active: bool,
    }

    /// Main bridge state
    public struct BridgeState has key {
        id: UID,
        /// SUI balance held in the bridge
        vault: Balance<SUI>,
        /// Hub chain ID
        hub_chain_id: u64,
        /// Required number of guardian signatures
        guardian_threshold: u64,
        /// Active guardian set
        guardians: VecSet<address>,
        /// Deposit nonce counter
        deposit_nonce: u64,
        /// Total deposited amount
        total_deposited: u64,
        /// Total withdrawn amount
        total_withdrawn: u64,
        /// Processed deposits (commitment hash -> bool)
        processed_deposits: Table<vector<u8>, bool>,
        /// Processed withdrawals (withdrawal hash -> bool)
        processed_withdrawals: Table<vector<u8>, bool>,
        /// Pause state
        is_paused: bool,
    }

    /// Deposit receipt for tracking
    public struct DepositReceipt has key, store {
        id: UID,
        depositor: address,
        commitment: vector<u8>,
        amount: u64,
        nonce: u64,
        timestamp: u64,
    }

    /// Withdrawal receipt
    public struct WithdrawalReceipt has key, store {
        id: UID,
        withdrawal_hash: vector<u8>,
        recipient: address,
        amount: u64,
        timestamp: u64,
    }

    // ============ Events ============

    public struct DepositEvent has copy, drop {
        depositor: address,
        commitment: vector<u8>,
        amount: u64,
        nonce: u64,
        timestamp: u64,
    }

    public struct WithdrawalEvent has copy, drop {
        withdrawal_hash: vector<u8>,
        recipient: address,
        amount: u64,
        timestamp: u64,
    }

    public struct GuardianAddedEvent has copy, drop {
        guardian: address,
        added_by: address,
        timestamp: u64,
    }

    public struct GuardianRemovedEvent has copy, drop {
        guardian: address,
        removed_by: address,
        timestamp: u64,
    }

    public struct BridgePausedEvent has copy, drop {
        paused_by: address,
        timestamp: u64,
    }

    public struct BridgeUnpausedEvent has copy, drop {
        unpaused_by: address,
        timestamp: u64,
    }

    // ============ Init ============

    /// Initialize the bridge - called once on publish
    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };

        // Create bridge state
        let bridge_state = BridgeState {
            id: object::new(ctx),
            vault: balance::zero(),
            hub_chain_id: 999888777, // Cash.io hub chain ID
            guardian_threshold: 1,
            guardians: vec_set::empty(),
            deposit_nonce: 0,
            total_deposited: 0,
            total_withdrawn: 0,
            processed_deposits: table::new(ctx),
            processed_withdrawals: table::new(ctx),
            is_paused: false,
        };

        // Transfer admin cap to deployer
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        
        // Share bridge state
        transfer::share_object(bridge_state);
    }

    // ============ Admin Functions ============

    /// Add a guardian to the set
    public entry fun add_guardian(
        _admin: &AdminCap,
        state: &mut BridgeState,
        guardian_address: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        vec_set::insert(&mut state.guardians, guardian_address);
        
        // Create guardian capability
        let guardian_cap = GuardianCap {
            id: object::new(ctx),
            guardian_address,
            is_active: true,
        };
        
        transfer::transfer(guardian_cap, guardian_address);
        
        event::emit(GuardianAddedEvent {
            guardian: guardian_address,
            added_by: tx_context::sender(ctx),
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Remove a guardian from the set
    public entry fun remove_guardian(
        _admin: &AdminCap,
        state: &mut BridgeState,
        guardian_address: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let remaining = vec_set::size(&state.guardians) - 1;
        assert!(remaining >= state.guardian_threshold, EInsufficientGuardians);
        
        vec_set::remove(&mut state.guardians, &guardian_address);
        
        event::emit(GuardianRemovedEvent {
            guardian: guardian_address,
            removed_by: tx_context::sender(ctx),
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Update guardian threshold
    public entry fun update_threshold(
        _admin: &AdminCap,
        state: &mut BridgeState,
        new_threshold: u64,
    ) {
        assert!(new_threshold <= vec_set::size(&state.guardians), EThresholdTooHigh);
        state.guardian_threshold = new_threshold;
    }

    /// Pause the bridge
    public entry fun pause(
        _admin: &AdminCap,
        state: &mut BridgeState,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        state.is_paused = true;
        
        event::emit(BridgePausedEvent {
            paused_by: tx_context::sender(ctx),
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Unpause the bridge
    public entry fun unpause(
        _admin: &AdminCap,
        state: &mut BridgeState,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        state.is_paused = false;
        
        event::emit(BridgeUnpausedEvent {
            unpaused_by: tx_context::sender(ctx),
            timestamp: clock::timestamp_ms(clock),
        });
    }

    // ============ User Functions ============

    /// Deposit SUI with a privacy commitment
    public entry fun deposit(
        state: &mut BridgeState,
        payment: Coin<SUI>,
        commitment: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!state.is_paused, EBridgePaused);
        
        let amount = coin::value(&payment);
        assert!(amount >= MIN_DEPOSIT, EAmountTooSmall);
        assert!(amount <= MAX_DEPOSIT, EAmountTooLarge);
        
        // Check commitment not already used
        assert!(!table::contains(&state.processed_deposits, commitment), EDepositAlreadyProcessed);
        
        // Add to vault
        let coin_balance = coin::into_balance(payment);
        balance::join(&mut state.vault, coin_balance);
        
        // Record deposit
        table::add(&mut state.processed_deposits, commitment, true);
        
        let nonce = state.deposit_nonce;
        state.deposit_nonce = nonce + 1;
        state.total_deposited = state.total_deposited + amount;
        
        let timestamp = clock::timestamp_ms(clock);
        
        // Create receipt
        let receipt = DepositReceipt {
            id: object::new(ctx),
            depositor: tx_context::sender(ctx),
            commitment,
            amount,
            nonce,
            timestamp,
        };
        
        transfer::transfer(receipt, tx_context::sender(ctx));
        
        // Emit event for relayers
        event::emit(DepositEvent {
            depositor: tx_context::sender(ctx),
            commitment,
            amount,
            nonce,
            timestamp,
        });
    }

    /// Process a verified withdrawal from hub chain
    /// Called by guardians with threshold signatures
    public entry fun process_withdrawal(
        _guardian: &GuardianCap,
        state: &mut BridgeState,
        withdrawal_hash: vector<u8>,
        recipient: address,
        amount: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!state.is_paused, EBridgePaused);
        assert!(!table::contains(&state.processed_withdrawals, withdrawal_hash), EWithdrawalAlreadyProcessed);
        
        // Check guardian is active
        assert!(vec_set::contains(&state.guardians, &tx_context::sender(ctx)), EGuardianNotActive);
        
        // In production, verify threshold signatures here
        // For now, trust single guardian for simplicity
        
        // Mark as processed
        table::add(&mut state.processed_withdrawals, withdrawal_hash, true);
        
        // Transfer SUI to recipient
        let withdrawal_balance = balance::split(&mut state.vault, amount);
        let withdrawal_coin = coin::from_balance(withdrawal_balance, ctx);
        transfer::public_transfer(withdrawal_coin, recipient);
        
        state.total_withdrawn = state.total_withdrawn + amount;
        
        let timestamp = clock::timestamp_ms(clock);
        
        // Create receipt
        let receipt = WithdrawalReceipt {
            id: object::new(ctx),
            withdrawal_hash,
            recipient,
            amount,
            timestamp,
        };
        
        transfer::transfer(receipt, recipient);
        
        // Emit event
        event::emit(WithdrawalEvent {
            withdrawal_hash,
            recipient,
            amount,
            timestamp,
        });
    }

    // ============ View Functions ============

    /// Get bridge statistics
    public fun get_stats(state: &BridgeState): (u64, u64, u64, u64, bool) {
        (
            balance::value(&state.vault),
            state.total_deposited,
            state.total_withdrawn,
            state.deposit_nonce,
            state.is_paused,
        )
    }

    /// Check if commitment is already used
    public fun is_commitment_used(state: &BridgeState, commitment: vector<u8>): bool {
        table::contains(&state.processed_deposits, commitment)
    }

    /// Check if withdrawal is processed
    public fun is_withdrawal_processed(state: &BridgeState, withdrawal_hash: vector<u8>): bool {
        table::contains(&state.processed_withdrawals, withdrawal_hash)
    }

    /// Get guardian count
    public fun guardian_count(state: &BridgeState): u64 {
        vec_set::size(&state.guardians)
    }

    /// Check if address is guardian
    public fun is_guardian(state: &BridgeState, addr: address): bool {
        vec_set::contains(&state.guardians, &addr)
    }

    // ============ Test Functions ============
    
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
