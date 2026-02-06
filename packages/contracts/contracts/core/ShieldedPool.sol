// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CommitmentTree.sol";
import "./interfaces/IZKVerifier.sol";

/**
 * @title ShieldedPool
 * @notice Privacy-preserving transaction pool using notes and nullifiers
 * @dev Implements a shielded pool model similar to Zcash/Tornado Cash
 * 
 * Key concepts:
 * - Notes: Encrypted UTXOs representing value ownership
 * - Nullifiers: Unique identifiers to prevent double-spending
 * - Commitments: Hash of note data stored in Merkle tree
 */
contract ShieldedPool is ReentrancyGuard, Ownable {
    // ============ State Variables ============
    
    /// @notice The commitment tree for storing note commitments
    CommitmentTree public immutable commitmentTree;
    
    /// @notice The ZK verifier contract (or precompile)
    IZKVerifier public zkVerifier;
    
    /// @notice Mapping of nullifiers that have been spent
    mapping(bytes32 => bool) public nullifiers;
    
    /// @notice Mapping of commitment roots that are valid
    mapping(bytes32 => bool) public roots;
    
    /// @notice Current deposit denomination (fixed for simplicity)
    uint256 public constant DENOMINATION = 0.1 ether;
    
    /// @notice Batch submission data
    struct Batch {
        bytes32 batchRoot;
        bytes32 stateRoot;
        uint256 timestamp;
        bool verified;
    }
    
    /// @notice Array of submitted batches
    Batch[] public batches;
    
    /// @notice Mapping from chain ID to bridge contract
    mapping(uint256 => address) public bridges;
    
    // ============ Events ============
    
    event Deposit(
        bytes32 indexed commitment,
        uint256 leafIndex,
        uint256 timestamp
    );
    
    event Withdrawal(
        address indexed recipient,
        bytes32 indexed nullifier,
        address indexed relayer,
        uint256 fee
    );
    
    event PrivateTransfer(
        bytes32 indexed nullifier1,
        bytes32 indexed nullifier2,
        bytes32 newCommitment1,
        bytes32 newCommitment2
    );
    
    event BatchSubmitted(
        uint256 indexed batchId,
        bytes32 batchRoot,
        bytes32 stateRoot,
        uint256 numTransactions
    );
    
    event CrossChainDeposit(
        uint256 indexed sourceChain,
        bytes32 indexed commitment,
        uint256 amount
    );
    
    // ============ Errors ============
    
    error InvalidProof();
    error InvalidRoot();
    error NullifierAlreadySpent();
    error InvalidDenomination();
    error InvalidBridge();
    error InvalidBatch();
    
    // ============ Constructor ============
    
    constructor(
        address _commitmentTree,
        address _zkVerifier
    ) Ownable(msg.sender) {
        commitmentTree = CommitmentTree(_commitmentTree);
        zkVerifier = IZKVerifier(_zkVerifier);
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Deposit funds into the shielded pool
     * @param _commitment The commitment hash of the new note
     */
    function deposit(bytes32 _commitment) external payable nonReentrant {
        if (msg.value != DENOMINATION) revert InvalidDenomination();
        
        uint256 leafIndex = commitmentTree.insert(_commitment);
        roots[commitmentTree.getLastRoot()] = true;
        
        emit Deposit(_commitment, leafIndex, block.timestamp);
    }
    
    /**
     * @notice Withdraw funds from the shielded pool
     * @param _proof ZK proof of ownership
     * @param _root Merkle root the proof references
     * @param _nullifier Nullifier to prevent double-spend
     * @param _recipient Address to receive funds
     * @param _relayer Relayer address for fee payment
     * @param _fee Fee amount for relayer
     */
    function withdraw(
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifier,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee
    ) external nonReentrant {
        if (!roots[_root]) revert InvalidRoot();
        if (nullifiers[_nullifier]) revert NullifierAlreadySpent();
        
        // Verify ZK proof
        bytes memory publicInputs = abi.encode(
            _root,
            _nullifier,
            _recipient,
            _relayer,
            _fee
        );
        
        if (!zkVerifier.verifyProof(_proof, publicInputs)) {
            revert InvalidProof();
        }
        
        // Mark nullifier as spent
        nullifiers[_nullifier] = true;
        
        // Transfer funds
        uint256 amount = DENOMINATION - _fee;
        _recipient.transfer(amount);
        
        if (_fee > 0 && _relayer != address(0)) {
            _relayer.transfer(_fee);
        }
        
        emit Withdrawal(_recipient, _nullifier, _relayer, _fee);
    }
    
    /**
     * @notice Execute a private transfer (2-in-2-out)
     * @param _proof ZK proof of valid transfer
     * @param _root Merkle root the proof references
     * @param _nullifier1 First input nullifier
     * @param _nullifier2 Second input nullifier
     * @param _newCommitment1 First output commitment
     * @param _newCommitment2 Second output commitment
     */
    function privateTransfer(
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifier1,
        bytes32 _nullifier2,
        bytes32 _newCommitment1,
        bytes32 _newCommitment2
    ) external nonReentrant {
        if (!roots[_root]) revert InvalidRoot();
        if (nullifiers[_nullifier1]) revert NullifierAlreadySpent();
        if (nullifiers[_nullifier2]) revert NullifierAlreadySpent();
        
        // Verify ZK proof
        bytes memory publicInputs = abi.encode(
            _root,
            _nullifier1,
            _nullifier2,
            _newCommitment1,
            _newCommitment2
        );
        
        if (!zkVerifier.verifyProof(_proof, publicInputs)) {
            revert InvalidProof();
        }
        
        // Mark nullifiers as spent
        nullifiers[_nullifier1] = true;
        nullifiers[_nullifier2] = true;
        
        // Insert new commitments
        commitmentTree.insert(_newCommitment1);
        commitmentTree.insert(_newCommitment2);
        roots[commitmentTree.getLastRoot()] = true;
        
        emit PrivateTransfer(
            _nullifier1,
            _nullifier2,
            _newCommitment1,
            _newCommitment2
        );
    }
    
    /**
     * @notice Submit a batch of transactions (validity rollup style)
     * @param _batchRoot Merkle root of the batch
     * @param _stateRoot New state root after batch
     * @param _proof ZK proof of valid batch execution
     * @param _numTransactions Number of transactions in batch
     */
    function submitBatch(
        bytes32 _batchRoot,
        bytes32 _stateRoot,
        bytes calldata _proof,
        uint256 _numTransactions
    ) external nonReentrant {
        // Verify batch proof
        bytes memory publicInputs = abi.encode(
            _batchRoot,
            _stateRoot,
            batches.length > 0 ? batches[batches.length - 1].stateRoot : bytes32(0)
        );
        
        if (!zkVerifier.verifyProof(_proof, publicInputs)) {
            revert InvalidProof();
        }
        
        // Store batch
        batches.push(Batch({
            batchRoot: _batchRoot,
            stateRoot: _stateRoot,
            timestamp: block.timestamp,
            verified: true
        }));
        
        emit BatchSubmitted(
            batches.length - 1,
            _batchRoot,
            _stateRoot,
            _numTransactions
        );
    }
    
    /**
     * @notice Handle cross-chain deposit from bridge
     * @param _commitment The commitment for the deposited note
     * @param _sourceChain The source chain ID
     * @param _proof Proof of deposit on source chain
     */
    function crossChainDeposit(
        bytes32 _commitment,
        uint256 _sourceChain,
        bytes calldata _proof
    ) external nonReentrant {
        if (bridges[_sourceChain] != msg.sender) revert InvalidBridge();
        
        // Verify cross-chain proof (simplified - in production use proper verification)
        // The bridge contract is responsible for verifying the source chain proof
        
        uint256 leafIndex = commitmentTree.insert(_commitment);
        roots[commitmentTree.getLastRoot()] = true;
        
        emit CrossChainDeposit(_sourceChain, _commitment, DENOMINATION);
        emit Deposit(_commitment, leafIndex, block.timestamp);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the bridge contract for a chain
     * @param _chainId The chain ID
     * @param _bridge The bridge contract address
     */
    function setBridge(uint256 _chainId, address _bridge) external onlyOwner {
        bridges[_chainId] = _bridge;
    }
    
    /**
     * @notice Update the ZK verifier contract
     * @param _newVerifier The new verifier address
     */
    function setZKVerifier(address _newVerifier) external onlyOwner {
        zkVerifier = IZKVerifier(_newVerifier);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if a root is valid
     * @param _root The root to check
     */
    function isKnownRoot(bytes32 _root) external view returns (bool) {
        return roots[_root];
    }
    
    /**
     * @notice Check if a nullifier has been spent
     * @param _nullifier The nullifier to check
     */
    function isSpent(bytes32 _nullifier) external view returns (bool) {
        return nullifiers[_nullifier];
    }
    
    /**
     * @notice Get the current commitment tree root
     */
    function getCurrentRoot() external view returns (bytes32) {
        return commitmentTree.getLastRoot();
    }
    
    /**
     * @notice Get batch count
     */
    function getBatchCount() external view returns (uint256) {
        return batches.length;
    }
}
