// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title CommitmentTree
 * @notice Merkle tree for storing note commitments
 * @dev Uses the Poseidon hash function via precompile for efficiency
 */
contract CommitmentTree {
    // ============ Constants ============
    
    /// @notice Depth of the Merkle tree
    uint256 public constant TREE_DEPTH = 20;
    
    /// @notice Maximum number of leaves
    uint256 public constant MAX_LEAVES = 2 ** TREE_DEPTH;
    
    /// @notice Zero value for empty leaves
    bytes32 public constant ZERO_VALUE = bytes32(
        0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c
    );
    
    // ============ State Variables ============
    
    /// @notice Current number of leaves
    uint256 public nextLeafIndex;
    
    /// @notice Filled subtrees for efficient updates
    bytes32[TREE_DEPTH] public filledSubtrees;
    
    /// @notice Historical roots for proof verification
    bytes32[100] public rootHistory;
    
    /// @notice Current root history index
    uint256 public currentRootIndex;
    
    /// @notice Mapping of all roots ever created
    mapping(bytes32 => bool) public knownRoots;
    
    // ============ Precomputed Zero Hashes ============
    
    /// @notice Zero hashes for each level
    bytes32[TREE_DEPTH] public zeros;
    
    // ============ Events ============
    
    event LeafInserted(bytes32 indexed leaf, uint256 indexed leafIndex, bytes32 newRoot);
    
    // ============ Errors ============
    
    error TreeFull();
    
    // ============ Constructor ============
    
    constructor() {
        // Initialize zero hashes for each level
        bytes32 currentZero = ZERO_VALUE;
        zeros[0] = currentZero;
        filledSubtrees[0] = currentZero;
        
        for (uint256 i = 1; i < TREE_DEPTH; i++) {
            currentZero = hashLeftRight(currentZero, currentZero);
            zeros[i] = currentZero;
            filledSubtrees[i] = currentZero;
        }
        
        // Set initial root
        bytes32 initialRoot = hashLeftRight(
            zeros[TREE_DEPTH - 1],
            zeros[TREE_DEPTH - 1]
        );
        rootHistory[0] = initialRoot;
        knownRoots[initialRoot] = true;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Insert a new leaf into the tree
     * @param _leaf The leaf value to insert
     * @return leafIndex The index of the inserted leaf
     */
    function insert(bytes32 _leaf) external returns (uint256 leafIndex) {
        if (nextLeafIndex >= MAX_LEAVES) revert TreeFull();
        
        leafIndex = nextLeafIndex;
        bytes32 currentLevelHash = _leaf;
        bytes32 left;
        bytes32 right;
        
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (leafIndex % 2 == 0) {
                // Current leaf is left child
                left = currentLevelHash;
                right = zeros[i];
                filledSubtrees[i] = currentLevelHash;
            } else {
                // Current leaf is right child
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            
            currentLevelHash = hashLeftRight(left, right);
            leafIndex /= 2;
        }
        
        // Update root history
        currentRootIndex = (currentRootIndex + 1) % 100;
        rootHistory[currentRootIndex] = currentLevelHash;
        knownRoots[currentLevelHash] = true;
        
        emit LeafInserted(_leaf, nextLeafIndex, currentLevelHash);
        
        nextLeafIndex++;
        return nextLeafIndex - 1;
    }
    
    /**
     * @notice Hash two children to get parent
     * @param _left Left child
     * @param _right Right child
     * @return The parent hash
     */
    function hashLeftRight(bytes32 _left, bytes32 _right) public pure returns (bytes32) {
        // In production, use Poseidon hash via precompile for ZK-friendliness
        // For now, using keccak256 as placeholder
        return keccak256(abi.encodePacked(_left, _right));
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get the last computed root
     */
    function getLastRoot() external view returns (bytes32) {
        return rootHistory[currentRootIndex];
    }
    
    /**
     * @notice Check if a root is known
     * @param _root The root to check
     */
    function isKnownRoot(bytes32 _root) external view returns (bool) {
        return knownRoots[_root];
    }
    
    /**
     * @notice Get the number of leaves
     */
    function getLeafCount() external view returns (uint256) {
        return nextLeafIndex;
    }
    
    /**
     * @notice Verify a Merkle proof
     * @param _leaf The leaf to verify
     * @param _pathElements The sibling hashes
     * @param _pathIndices The path indices (0 = left, 1 = right)
     * @param _root The root to verify against
     */
    function verifyProof(
        bytes32 _leaf,
        bytes32[TREE_DEPTH] calldata _pathElements,
        uint256[TREE_DEPTH] calldata _pathIndices,
        bytes32 _root
    ) external pure returns (bool) {
        bytes32 currentHash = _leaf;
        
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            bytes32 left;
            bytes32 right;
            
            if (_pathIndices[i] == 0) {
                left = currentHash;
                right = _pathElements[i];
            } else {
                left = _pathElements[i];
                right = currentHash;
            }
            
            currentHash = keccak256(abi.encodePacked(left, right));
        }
        
        return currentHash == _root;
    }
}
