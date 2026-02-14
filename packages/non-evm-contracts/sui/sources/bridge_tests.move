#[test_only]
module cashio_bridge::bridge_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin::{Self};
    use sui::sui::SUI;
    use sui::clock::{Self};
    use cashio_bridge::bridge::{Self, BridgeState, AdminCap, GuardianCap, DepositReceipt};

    const ADMIN: address = @0xAD;
    const USER: address = @0x1;
    const GUARDIAN: address = @0x2;

    #[test]
    fun test_init() {
        let mut scenario = ts::begin(ADMIN);
        
        // Initialize bridge
        {
            bridge::init_for_testing(ts::ctx(&mut scenario));
        };
        
        // Check admin cap was created
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            ts::return_to_sender(&scenario, admin_cap);
        };
        
        // Check bridge state
        ts::next_tx(&mut scenario, ADMIN);
        {
            let bridge_state = ts::take_shared<BridgeState>(&scenario);
            let (vault_balance, total_deposited, total_withdrawn, nonce, is_paused) = 
                bridge::get_stats(&bridge_state);
            
            assert!(vault_balance == 0, 0);
            assert!(total_deposited == 0, 1);
            assert!(total_withdrawn == 0, 2);
            assert!(nonce == 0, 3);
            assert!(!is_paused, 4);
            
            ts::return_shared(bridge_state);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_add_guardian() {
        let mut scenario = ts::begin(ADMIN);
        
        // Initialize
        {
            bridge::init_for_testing(ts::ctx(&mut scenario));
        };
        
        // Add guardian
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut bridge_state = ts::take_shared<BridgeState>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            
            bridge::add_guardian(
                &admin_cap,
                &mut bridge_state,
                GUARDIAN,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            assert!(bridge::guardian_count(&bridge_state) == 1, 0);
            assert!(bridge::is_guardian(&bridge_state, GUARDIAN), 1);
            
            clock::destroy_for_testing(clock);
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(bridge_state);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_deposit() {
        let mut scenario = ts::begin(ADMIN);
        
        // Initialize
        {
            bridge::init_for_testing(ts::ctx(&mut scenario));
        };
        
        // User deposits
        ts::next_tx(&mut scenario, USER);
        {
            let mut bridge_state = ts::take_shared<BridgeState>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            
            // Create commitment (mock - in production this is a Poseidon hash)
            let commitment = x"0102030405060708091011121314151617181920212223242526272829303132";
            
            // Mint test SUI
            let deposit_coin = coin::mint_for_testing<SUI>(100_000_000, ts::ctx(&mut scenario));
            
            bridge::deposit(
                &mut bridge_state,
                deposit_coin,
                commitment,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let (vault_balance, total_deposited, _, nonce, _) = bridge::get_stats(&bridge_state);
            assert!(vault_balance == 100_000_000, 0);
            assert!(total_deposited == 100_000_000, 1);
            assert!(nonce == 1, 2);
            assert!(bridge::is_commitment_used(&bridge_state, commitment), 3);
            
            clock::destroy_for_testing(clock);
            ts::return_shared(bridge_state);
        };
        
        // Verify user received deposit receipt
        ts::next_tx(&mut scenario, USER);
        {
            let receipt = ts::take_from_sender<DepositReceipt>(&scenario);
            ts::return_to_sender(&scenario, receipt);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_pause_unpause() {
        let mut scenario = ts::begin(ADMIN);
        
        // Initialize
        {
            bridge::init_for_testing(ts::ctx(&mut scenario));
        };
        
        // Pause
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut bridge_state = ts::take_shared<BridgeState>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            
            bridge::pause(&admin_cap, &mut bridge_state, &clock, ts::ctx(&mut scenario));
            
            let (_, _, _, _, is_paused) = bridge::get_stats(&bridge_state);
            assert!(is_paused, 0);
            
            clock::destroy_for_testing(clock);
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(bridge_state);
        };
        
        // Unpause
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut bridge_state = ts::take_shared<BridgeState>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            
            bridge::unpause(&admin_cap, &mut bridge_state, &clock, ts::ctx(&mut scenario));
            
            let (_, _, _, _, is_paused) = bridge::get_stats(&bridge_state);
            assert!(!is_paused, 0);
            
            clock::destroy_for_testing(clock);
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(bridge_state);
        };
        
        ts::end(scenario);
    }
}
