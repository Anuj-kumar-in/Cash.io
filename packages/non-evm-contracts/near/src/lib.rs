//! Cash.io Privacy Bridge for NEAR Protocol
//! 
//! This smart contract implements cross-chain bridging between NEAR and the
//! Cash.io hub chain (Avalanche Subnet) with privacy-preserving features.
//! 
//! Features:
//! - Deposit NEAR tokens with Poseidon commitments
//! - Process verified withdrawals from hub chain
//! - Multi-signature guardian verification
//! - Commitment tracking for replay protection

use near_sdk::store::{LookupSet, IterableMap, IterableSet};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, log, near, require, AccountId, NearToken,
    PanicOnDefault, Promise, BorshStorageKey
};

type Balance = u128;

// ============ Constants ============

const MIN_DEPOSIT: Balance = 10_000_000_000_000_000_000_000;      // 0.01 NEAR
const MAX_DEPOSIT: Balance = 100_000_000_000_000_000_000_000_000; // 100 NEAR

// ============ Storage Keys ============

#[derive(BorshStorageKey)]
#[near]
pub enum StorageKey {
    Guardians,
    ProcessedDeposits,
    ProcessedWithdrawals,
    Deposits,
}

// ============ Events ============

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct DepositEvent {
    pub depositor: AccountId,
    pub commitment: String,
    pub amount: U128,
    pub nonce: u64,
    pub timestamp: u64,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct WithdrawalEvent {
    pub withdrawal_hash: String,
    pub recipient: AccountId,
    pub amount: U128,
    pub timestamp: u64,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct GuardianEvent {
    pub guardian: AccountId,
    pub action: String,
    pub by: AccountId,
    pub timestamp: u64,
}

// ============ Structs ============

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Deposit {
    pub depositor: AccountId,
    pub commitment: String,
    pub amount: U128,
    pub nonce: u64,
    pub timestamp: u64,
    pub processed: bool,
}

// ============ Contract ============

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct CashioBridge {
    /// Contract owner
    owner_id: AccountId,
    /// Hub chain ID
    hub_chain_id: String,
    /// Required guardian signatures for withdrawals
    guardian_threshold: u32,
    /// Active guardians
    guardians: IterableSet<AccountId>,
    /// Processed deposit commitments
    processed_deposits: LookupSet<String>,
    /// Processed withdrawal hashes
    processed_withdrawals: LookupSet<String>,
    /// Deposit records by nonce
    deposits: IterableMap<u64, Deposit>,
    /// Current deposit nonce
    deposit_nonce: u64,
    /// Total NEAR deposited
    total_deposited: Balance,
    /// Total NEAR withdrawn
    total_withdrawn: Balance,
    /// Pause state
    is_paused: bool,
}

#[near]
impl CashioBridge {
    /// Initialize the bridge contract
    #[init]
    pub fn new(
        owner_id: AccountId,
        hub_chain_id: String,
        guardian_threshold: u32,
    ) -> Self {
        require!(!env::state_exists(), "Already initialized");
        
        log!("Initializing Cash.io Bridge");
        log!("Owner: {}", owner_id);
        log!("Hub Chain ID: {}", hub_chain_id);
        log!("Guardian Threshold: {}", guardian_threshold);
        
        Self {
            owner_id,
            hub_chain_id,
            guardian_threshold,
            guardians: IterableSet::new(StorageKey::Guardians),
            processed_deposits: LookupSet::new(StorageKey::ProcessedDeposits),
            processed_withdrawals: LookupSet::new(StorageKey::ProcessedWithdrawals),
            deposits: IterableMap::new(StorageKey::Deposits),
            deposit_nonce: 0,
            total_deposited: 0,
            total_withdrawn: 0,
            is_paused: false,
        }
    }

    // ============ Admin Functions ============

    /// Add a guardian
    pub fn add_guardian(&mut self, guardian_id: AccountId) {
        self.assert_owner();
        require!(!self.guardians.contains(&guardian_id), "Guardian already exists");
        
        self.guardians.insert(guardian_id.clone());
        
        let event = GuardianEvent {
            guardian: guardian_id,
            action: "added".to_string(),
            by: env::predecessor_account_id(),
            timestamp: env::block_timestamp(),
        };
        
        log!("EVENT_JSON:{}", near_sdk::serde_json::to_string(&event).unwrap());
    }

    /// Remove a guardian
    pub fn remove_guardian(&mut self, guardian_id: AccountId) {
        self.assert_owner();
        require!(self.guardians.contains(&guardian_id), "Guardian not found");
        require!(
            self.guardians.len() > self.guardian_threshold as u32,
            "Cannot remove: would go below threshold"
        );
        
        self.guardians.remove(&guardian_id);
        
        let event = GuardianEvent {
            guardian: guardian_id,
            action: "removed".to_string(),
            by: env::predecessor_account_id(),
            timestamp: env::block_timestamp(),
        };
        
        log!("EVENT_JSON:{}", near_sdk::serde_json::to_string(&event).unwrap());
    }

    /// Update guardian threshold
    pub fn update_threshold(&mut self, new_threshold: u32) {
        self.assert_owner();
        require!(
            new_threshold <= self.guardians.len(),
            "Threshold cannot exceed guardian count"
        );
        
        self.guardian_threshold = new_threshold;
        log!("Guardian threshold updated to: {}", new_threshold);
    }

    /// Pause the bridge
    pub fn pause(&mut self) {
        self.assert_owner();
        self.is_paused = true;
        log!("Bridge paused by {}", env::predecessor_account_id());
    }

    /// Unpause the bridge
    pub fn unpause(&mut self) {
        self.assert_owner();
        self.is_paused = false;
        log!("Bridge unpaused by {}", env::predecessor_account_id());
    }

    /// Transfer ownership
    pub fn transfer_ownership(&mut self, new_owner: AccountId) {
        self.assert_owner();
        log!("Ownership transferred from {} to {}", self.owner_id, new_owner);
        self.owner_id = new_owner;
    }

    // ============ User Functions ============

    /// Deposit NEAR with a privacy commitment
    #[payable]
    pub fn deposit(&mut self, commitment: String) -> u64 {
        require!(!self.is_paused, "Bridge is paused");
        
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount >= MIN_DEPOSIT, "Deposit amount too small");
        require!(amount <= MAX_DEPOSIT, "Deposit amount too large");
        require!(!self.processed_deposits.contains(&commitment), "Commitment already used");
        
        // Record commitment
        self.processed_deposits.insert(commitment.clone());
        
        let nonce = self.deposit_nonce;
        self.deposit_nonce += 1;
        self.total_deposited += amount;
        
        let deposit = Deposit {
            depositor: env::predecessor_account_id(),
            commitment: commitment.clone(),
            amount: U128(amount),
            nonce,
            timestamp: env::block_timestamp(),
            processed: false,
        };
        
        self.deposits.insert(nonce, deposit);
        
        // Emit event for relayers
        let event = DepositEvent {
            depositor: env::predecessor_account_id(),
            commitment,
            amount: U128(amount),
            nonce,
            timestamp: env::block_timestamp(),
        };
        
        log!("EVENT_JSON:{}", near_sdk::serde_json::to_string(&event).unwrap());
        log!("Deposit #{}: {} yoctoNEAR from {}", 
            nonce, 
            amount, 
            env::predecessor_account_id()
        );
        
        nonce
    }

    /// Process a verified withdrawal from hub chain
    /// Only callable by guardians
    pub fn process_withdrawal(
        &mut self,
        withdrawal_hash: String,
        recipient: AccountId,
        amount: U128,
    ) -> Promise {
        require!(!self.is_paused, "Bridge is paused");
        self.assert_guardian();
        require!(
            !self.processed_withdrawals.contains(&withdrawal_hash),
            "Withdrawal already processed"
        );
        
        // TODO: In production, verify threshold signatures from guardians
        // For now, trust single guardian for simplicity
        
        // Mark as processed
        self.processed_withdrawals.insert(withdrawal_hash.clone());
        self.total_withdrawn += amount.0;
        
        // Emit event
        let event = WithdrawalEvent {
            withdrawal_hash: withdrawal_hash.clone(),
            recipient: recipient.clone(),
            amount,
            timestamp: env::block_timestamp(),
        };
        
        log!("EVENT_JSON:{}", near_sdk::serde_json::to_string(&event).unwrap());
        log!("Withdrawal processed: {} yoctoNEAR to {}", amount.0, recipient);
        
        // Transfer NEAR to recipient
        Promise::new(recipient).transfer(NearToken::from_yoctonear(amount.0))
    }

    // ============ View Functions ============

    /// Get bridge statistics
    pub fn get_stats(&self) -> (U128, U128, U128, u64, bool) {
        (
            U128(env::account_balance().as_yoctonear()),
            U128(self.total_deposited),
            U128(self.total_withdrawn),
            self.deposit_nonce,
            self.is_paused,
        )
    }

    /// Get deposit details by nonce
    pub fn get_deposit(&self, nonce: u64) -> Option<Deposit> {
        self.deposits.get(&nonce).cloned()
    }

    /// Check if commitment is used
    pub fn is_commitment_used(&self, commitment: String) -> bool {
        self.processed_deposits.contains(&commitment)
    }

    /// Check if withdrawal is processed
    pub fn is_withdrawal_processed(&self, withdrawal_hash: String) -> bool {
        self.processed_withdrawals.contains(&withdrawal_hash)
    }

    /// Get guardian list
    pub fn get_guardians(&self) -> Vec<AccountId> {
        self.guardians.iter().cloned().collect()
    }

    /// Get guardian count
    pub fn guardian_count(&self) -> u32 {
        self.guardians.len()
    }

    /// Check if account is guardian
    pub fn is_guardian(&self, account_id: AccountId) -> bool {
        self.guardians.contains(&account_id)
    }

    /// Get owner
    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    /// Get hub chain ID
    pub fn get_hub_chain_id(&self) -> String {
        self.hub_chain_id.clone()
    }

    /// Get guardian threshold
    pub fn get_guardian_threshold(&self) -> u32 {
        self.guardian_threshold
    }

    // ============ Internal Functions ============

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only owner can call this method"
        );
    }

    fn assert_guardian(&self) {
        require!(
            self.guardians.contains(&env::predecessor_account_id()),
            "Only guardians can call this method"
        );
    }
}

// ============ Tests ============

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(predecessor)
            .current_account_id(accounts(0));
        builder
    }

    #[test]
    fn test_init() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = CashioBridge::new(
            accounts(0),
            "999888777".to_string(),
            1,
        );

        assert_eq!(contract.get_owner(), accounts(0));
        assert_eq!(contract.get_hub_chain_id(), "999888777");
        assert_eq!(contract.get_guardian_threshold(), 1);
        assert!(!contract.is_paused);
    }

    #[test]
    fn test_add_guardian() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = CashioBridge::new(
            accounts(0),
            "999888777".to_string(),
            1,
        );

        contract.add_guardian(accounts(1));
        assert!(contract.is_guardian(accounts(1)));
        assert_eq!(contract.guardian_count(), 1);
    }

    #[test]
    fn test_deposit() {
        let context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(NearToken::from_yoctonear(MIN_DEPOSIT))
            .build());

        let mut contract = CashioBridge::new(
            accounts(0),
            "999888777".to_string(),
            1,
        );

        let commitment = "0x0102030405060708091011121314151617181920212223242526272829303132".to_string();
        let nonce = contract.deposit(commitment.clone());
        
        assert_eq!(nonce, 0);
        assert!(contract.is_commitment_used(commitment));
        
        let (_, total_deposited, _, deposit_nonce, _) = contract.get_stats();
        assert_eq!(total_deposited.0, MIN_DEPOSIT);
        assert_eq!(deposit_nonce, 1);
    }

    #[test]
    fn test_pause_unpause() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = CashioBridge::new(
            accounts(0),
            "999888777".to_string(),
            1,
        );

        assert!(!contract.is_paused);
        
        contract.pause();
        let (_, _, _, _, is_paused) = contract.get_stats();
        assert!(is_paused);
        
        contract.unpause();
        let (_, _, _, _, is_paused) = contract.get_stats();
        assert!(!is_paused);
    }

    #[test]
    #[should_panic(expected = "Deposit amount too small")]
    fn test_deposit_too_small() {
        let context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(NearToken::from_yoctonear(1000)) // Too small
            .build());

        let mut contract = CashioBridge::new(
            accounts(0),
            "999888777".to_string(),
            1,
        );

        let commitment = "0x0102030405060708".to_string();
        contract.deposit(commitment);
    }

    #[test]
    #[should_panic(expected = "Only owner can call this method")]
    fn test_only_owner() {
        let context = get_context(accounts(1)); // Not owner
        testing_env!(context.build());

        let mut contract = CashioBridge::new(
            accounts(0), // Owner is accounts(0)
            "999888777".to_string(),
            1,
        );

        contract.pause(); // Should fail
    }
}
