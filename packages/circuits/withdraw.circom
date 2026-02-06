/*
 * Cash.io Withdraw Circuit
 * 
 * Proves a valid withdrawal from the shielded pool.
 * 
 * Public Inputs:
 * - root: Merkle tree root
 * - nullifier: Nullifier to prevent double-spend
 * - recipient: Address receiving the withdrawal
 * - relayer: Optional relayer address
 * - fee: Fee paid to relayer
 * 
 * Private Inputs:
 * - secret: Note secret
 * - amount: Note amount
 * - leafIndex: Position in Merkle tree
 * - pathElements: Merkle proof path
 * - pathIndices: Path direction indices
 */

pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/mux1.circom";

var TREE_DEPTH = 20;

/*
 * Compute note commitment
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
 * Compute nullifier
 */
template Nullifier() {
    signal input commitment;
    signal input leafIndex;
    signal input secret;
    signal output nullifier;
    
    component hasher = Poseidon(3);
    hasher.inputs[0] <== commitment;
    hasher.inputs[1] <== leafIndex;
    hasher.inputs[2] <== secret;
    
    nullifier <== hasher.out;
}

/*
 * Merkle proof verifier
 */
template MerkleProofVerifier(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    component hashers[levels];
    component selectors[levels][2];
    
    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;
    
    for (var i = 0; i < levels; i++) {
        // Validate path index is binary
        pathIndices[i] * (1 - pathIndices[i]) === 0;
        
        // Select left and right based on path index
        selectors[i][0] = Mux1();
        selectors[i][0].c[0] <== levelHashes[i];
        selectors[i][0].c[1] <== pathElements[i];
        selectors[i][0].s <== pathIndices[i];
        
        selectors[i][1] = Mux1();
        selectors[i][1].c[0] <== pathElements[i];
        selectors[i][1].c[1] <== levelHashes[i];
        selectors[i][1].s <== pathIndices[i];
        
        // Hash the pair
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== selectors[i][0].out;
        hashers[i].inputs[1] <== selectors[i][1].out;
        
        levelHashes[i + 1] <== hashers[i].out;
    }
    
    // Verify root matches
    root === levelHashes[levels];
}

/*
 * Withdrawal Circuit
 */
template Withdraw() {
    // Public inputs
    signal input root;
    signal input nullifier;
    signal input recipient;
    signal input relayer;
    signal input fee;
    
    // Private inputs
    signal input secret;
    signal input amount;
    signal input leafIndex;
    signal input pathElements[TREE_DEPTH];
    signal input pathIndices[TREE_DEPTH];
    
    // ========== Compute Note Commitment ==========
    
    component noteCommitment = NoteCommitment();
    noteCommitment.amount <== amount;
    noteCommitment.secret <== secret;
    
    // ========== Verify Nullifier ==========
    
    component nullifierCalc = Nullifier();
    nullifierCalc.commitment <== noteCommitment.commitment;
    nullifierCalc.leafIndex <== leafIndex;
    nullifierCalc.secret <== secret;
    
    nullifier === nullifierCalc.nullifier;
    
    // ========== Verify Merkle Proof ==========
    
    component merkleVerifier = MerkleProofVerifier(TREE_DEPTH);
    merkleVerifier.leaf <== noteCommitment.commitment;
    merkleVerifier.root <== root;
    
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkleVerifier.pathElements[i] <== pathElements[i];
        merkleVerifier.pathIndices[i] <== pathIndices[i];
    }
    
    // ========== Verify Fee is Valid ==========
    
    // Fee must be less than or equal to amount
    component feeCheck = LessEqThan(252);
    feeCheck.in[0] <== fee;
    feeCheck.in[1] <== amount;
    feeCheck.out === 1;
    
    // ========== Compute Withdrawal Amount ==========
    
    signal withdrawAmount;
    withdrawAmount <== amount - fee;
    
    // Withdrawal amount must be positive
    component withdrawCheck = LessThan(252);
    withdrawCheck.in[0] <== 0;
    withdrawCheck.in[1] <== withdrawAmount + 1;
    withdrawCheck.out === 1;
    
    // ========== Include Recipient and Relayer in Circuit ==========
    
    // These are included to prevent front-running
    // (changing recipient/relayer would invalidate the proof)
    signal recipientSquare;
    recipientSquare <== recipient * recipient;
    
    signal relayerSquare;
    relayerSquare <== relayer * relayer;
}

component main {public [root, nullifier, recipient, relayer, fee]} = Withdraw();
