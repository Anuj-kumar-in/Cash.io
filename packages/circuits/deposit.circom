/*
 * Cash.io Deposit Circuit
 * 
 * Proves a valid deposit into the shielded pool.
 * 
 * Public Inputs:
 * - commitment: The note commitment being created
 * - depositAmount: The deposited amount (publicly visible)
 * 
 * Private Inputs:
 * - secret: Random secret for the note
 * - amount: Amount in the note (should equal depositAmount)
 */

pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

/*
 * Compute note commitment
 * commitment = Poseidon(amount, secret)
 */
template NoteCommitment() {
    signal input amount;
    signal input secret;
    signal output commitment;
    
    component hasher = Poseidon(2);
    hasher.inputs[0] <== amount;
    hasher.inputs[1] <== secret;
    
    commitment <== hasher.out;
}

/*
 * Deposit Circuit
 * Proves that a commitment was correctly constructed from amount and secret
 */
template Deposit() {
    // Public inputs
    signal input commitment;
    signal input depositAmount;
    
    // Private inputs
    signal input secret;
    signal input amount;
    
    // ========== Compute Commitment ==========
    
    component noteCommitment = NoteCommitment();
    noteCommitment.amount <== amount;
    noteCommitment.secret <== secret;
    
    // Verify commitment matches
    commitment === noteCommitment.commitment;
    
    // ========== Verify Amount Matches Deposit ==========
    
    // The private amount must equal the public deposit amount
    amount === depositAmount;
    
    // ========== Range Check ==========
    
    // Ensure amount is within valid range (prevents overflow)
    component rangeCheck = LessThan(252);
    rangeCheck.in[0] <== amount;
    rangeCheck.in[1] <== 2**250;
    rangeCheck.out === 1;
    
    // ========== Ensure Secret is Non-Zero ==========
    
    // Secret must be non-zero to prevent guessing
    component isZero = IsZero();
    isZero.in <== secret;
    isZero.out === 0;
}

component main {public [commitment, depositAmount]} = Deposit();
