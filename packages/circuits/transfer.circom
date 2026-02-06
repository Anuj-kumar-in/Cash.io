/*
 * Cash.io Transfer Circuit
 * 
 * Proves a valid private transfer within the shielded pool.
 * 
 * Public Inputs:
 * - root: Merkle tree root
 * - nullifier1: First input note nullifier
 * - nullifier2: Second input note nullifier  
 * - newCommitment1: First output note commitment
 * - newCommitment2: Second output note commitment
 * 
 * Private Inputs:
 * - secret1, secret2: Note secrets for input notes
 * - amount1, amount2: Input note amounts
 * - newAmount1, newAmount2: Output note amounts
 * - newSecret1, newSecret2: Output note secrets
 * - pathElements1, pathElements2: Merkle paths
 * - pathIndices1, pathIndices2: Path indices
 */

pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/mux1.circom";

// Tree depth
var TREE_DEPTH = 20;

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
 * Compute nullifier from note commitment and secret
 * nullifier = Poseidon(commitment, leafIndex, secret)
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
 * Verify Merkle proof
 */
template MerkleProofVerifier(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    component hashers[levels];
    component mux[levels];
    
    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;
    
    for (var i = 0; i < levels; i++) {
        // Validate path index is binary
        pathIndices[i] * (1 - pathIndices[i]) === 0;
        
        // Mux to select left/right ordering
        mux[i] = Mux1();
        mux[i].c[0] <== levelHashes[i];
        mux[i].c[1] <== pathElements[i];
        mux[i].s <== pathIndices[i];
        
        // Hash the pair
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out;
        hashers[i].inputs[1] <== pathIndices[i] === 0 ? pathElements[i] : levelHashes[i];
        
        levelHashes[i + 1] <== hashers[i].out;
    }
    
    // Verify root matches
    root === levelHashes[levels];
}

/*
 * Main Transfer Circuit
 * Proves: 2 inputs → 2 outputs with value conservation
 */
template PrivateTransfer() {
    // Public inputs
    signal input root;
    signal input nullifier1;
    signal input nullifier2;
    signal input newCommitment1;
    signal input newCommitment2;
    
    // Private inputs - Input note 1
    signal input secret1;
    signal input amount1;
    signal input leafIndex1;
    signal input pathElements1[TREE_DEPTH];
    signal input pathIndices1[TREE_DEPTH];
    
    // Private inputs - Input note 2
    signal input secret2;
    signal input amount2;
    signal input leafIndex2;
    signal input pathElements2[TREE_DEPTH];
    signal input pathIndices2[TREE_DEPTH];
    
    // Private inputs - Output notes
    signal input newAmount1;
    signal input newAmount2;
    signal input newSecret1;
    signal input newSecret2;
    
    // ========== Verify Input Note 1 ==========
    
    // Compute commitment for input note 1
    component inputCommitment1 = NoteCommitment();
    inputCommitment1.amount <== amount1;
    inputCommitment1.secret <== secret1;
    
    // Verify nullifier 1
    component nullifierCalc1 = Nullifier();
    nullifierCalc1.commitment <== inputCommitment1.commitment;
    nullifierCalc1.leafIndex <== leafIndex1;
    nullifierCalc1.secret <== secret1;
    nullifier1 === nullifierCalc1.nullifier;
    
    // Verify Merkle proof for input 1
    component merkleVerifier1 = MerkleProofVerifier(TREE_DEPTH);
    merkleVerifier1.leaf <== inputCommitment1.commitment;
    merkleVerifier1.root <== root;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkleVerifier1.pathElements[i] <== pathElements1[i];
        merkleVerifier1.pathIndices[i] <== pathIndices1[i];
    }
    
    // ========== Verify Input Note 2 ==========
    
    // Compute commitment for input note 2
    component inputCommitment2 = NoteCommitment();
    inputCommitment2.amount <== amount2;
    inputCommitment2.secret <== secret2;
    
    // Verify nullifier 2
    component nullifierCalc2 = Nullifier();
    nullifierCalc2.commitment <== inputCommitment2.commitment;
    nullifierCalc2.leafIndex <== leafIndex2;
    nullifierCalc2.secret <== secret2;
    nullifier2 === nullifierCalc2.nullifier;
    
    // Verify Merkle proof for input 2
    component merkleVerifier2 = MerkleProofVerifier(TREE_DEPTH);
    merkleVerifier2.leaf <== inputCommitment2.commitment;
    merkleVerifier2.root <== root;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkleVerifier2.pathElements[i] <== pathElements2[i];
        merkleVerifier2.pathIndices[i] <== pathIndices2[i];
    }
    
    // ========== Verify Output Notes ==========
    
    // Compute output commitments
    component outputCommitment1 = NoteCommitment();
    outputCommitment1.amount <== newAmount1;
    outputCommitment1.secret <== newSecret1;
    newCommitment1 === outputCommitment1.commitment;
    
    component outputCommitment2 = NoteCommitment();
    outputCommitment2.amount <== newAmount2;
    outputCommitment2.secret <== newSecret2;
    newCommitment2 === outputCommitment2.commitment;
    
    // ========== Value Conservation ==========
    
    // Input sum = Output sum
    signal inputSum;
    signal outputSum;
    inputSum <== amount1 + amount2;
    outputSum <== newAmount1 + newAmount2;
    inputSum === outputSum;
    
    // ========== Non-negative amounts ==========
    
    // Ensure amounts are non-negative (using range check)
    component rangeCheck1 = LessThan(252);
    rangeCheck1.in[0] <== newAmount1;
    rangeCheck1.in[1] <== 2**250; // Max value
    rangeCheck1.out === 1;
    
    component rangeCheck2 = LessThan(252);
    rangeCheck2.in[0] <== newAmount2;
    rangeCheck2.in[1] <== 2**250;
    rangeCheck2.out === 1;
}

component main {public [root, nullifier1, nullifier2, newCommitment1, newCommitment2]} = PrivateTransfer();
