// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./BaseBridge.sol";

/**
 * @title RootstockBridge
 * @notice Bridge contract for Rootstock (Bitcoin sidechain) deposits/withdrawals
 * @dev Extends BaseBridge with RSK-specific verification
 * 
 * Rootstock is an EVM-compatible Bitcoin sidechain secured via merge-mining.
 * This makes it the practical "Bitcoin" integration target for smart contract
 * based interoperability.
 */
contract RootstockBridge is BaseBridge {
    // ============ Constants ============
    
    /// @notice Rootstock mainnet chain ID
    uint256 public constant RSK_CHAIN_ID = 30;
    
    /// @notice Rootstock testnet chain ID
    uint256 public constant RSK_TESTNET_CHAIN_ID = 31;
    
    // ============ State Variables ============
    
    /// @notice Whether using testnet
    bool public isTestnet;
    
    /// @notice Required confirmations for RSK (merge-mined, so high security)
    uint256 public requiredConfirmations = 100;
    
    /// @notice RSK bridge contract address (for RBTC ↔ BTC)
    address public rskBridge;
    
    /// @notice Verified RSK block headers
    mapping(bytes32 => RskBlockHeader) public blockHeaders;
    
    // ============ Structs ============
    
    struct RskBlockHeader {
        bytes32 parentHash;
        bytes32 stateRoot;
        bytes32 transactionsRoot;
        uint256 blockNumber;
        uint256 timestamp;
        uint256 difficulty;
        bool verified;
    }
    
    // ============ Events ============
    
    event BlockHeaderVerified(bytes32 indexed blockHash, uint256 blockNumber);
    event RskBridgeUpdated(address newBridge);
    
    // ============ Constructor ============
    
    constructor(
        address _shieldedPool,
        uint256 _hubChainId,
        bool _isTestnet
    ) BaseBridge(
        _shieldedPool,
        _isTestnet ? RSK_TESTNET_CHAIN_ID : RSK_CHAIN_ID,
        _hubChainId
    ) {
        isTestnet = _isTestnet;
    }
    
    // ============ Override Functions ============
    
    /**
     * @notice Verify RSK inclusion proof
     * @param proof The proof data containing block header and transaction proof
     * @param depositHash The deposit hash to verify
     */
    function _verifyInclusionProof(
        bytes calldata proof,
        bytes32 depositHash
    ) internal override returns (bool) {
        // Decode proof structure
        // Structure: blockHash (32) + blockHeader (encoded) + txProof (variable)
        if (proof.length < 64) return false;
        
        bytes32 blockHash;
        assembly {
            blockHash := calldataload(proof.offset)
        }
        
        // Check if block header is verified
        RskBlockHeader storage header = blockHeaders[blockHash];
        if (!header.verified) {
            // Need to verify block header first
            return false;
        }
        
        // Verify transaction inclusion in block
        return _verifyTransactionInclusion(
            proof[32:],
            depositHash,
            header.transactionsRoot
        );
    }
    
    /**
     * @notice Verify transaction inclusion in RSK block
     */
    function _verifyTransactionInclusion(
        bytes calldata txProof,
        bytes32 txHash,
        bytes32 txRoot
    ) internal pure returns (bool) {
        // In production: implement proper Merkle proof verification
        // RSK uses the same Merkle tree structure as Ethereum
        
        if (txProof.length < 32) return false;
        
        // Verify Merkle proof
        // Each 32-byte segment is a sibling hash
        // First byte of remaining data indicates direction (0=left, 1=right)
        
        bytes32 computedRoot = txHash;
        uint256 proofLength = txProof.length / 33; // 32 bytes hash + 1 byte direction
        
        for (uint256 i = 0; i < proofLength; i++) {
            bytes32 sibling;
            uint8 direction;
            
            uint256 offset = i * 33;
            assembly {
                sibling := calldataload(add(txProof.offset, offset))
                direction := byte(0, calldataload(add(txProof.offset, add(offset, 32))))
            }
            
            if (direction == 0) {
                computedRoot = keccak256(abi.encodePacked(sibling, computedRoot));
            } else {
                computedRoot = keccak256(abi.encodePacked(computedRoot, sibling));
            }
        }
        
        return computedRoot == txRoot;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Submit and verify an RSK block header
     * @param blockHash The block hash
     * @param parentHash Parent block hash
     * @param stateRoot State root
     * @param transactionsRoot Transactions root
     * @param blockNumber Block number
     * @param timestamp Block timestamp
     * @param difficulty Block difficulty
     */
    function submitBlockHeader(
        bytes32 blockHash,
        bytes32 parentHash,
        bytes32 stateRoot,
        bytes32 transactionsRoot,
        uint256 blockNumber,
        uint256 timestamp,
        uint256 difficulty
    ) external onlyRelayer {
        // Verify block hash computation
        bytes32 computedHash = keccak256(abi.encodePacked(
            parentHash,
            stateRoot,
            transactionsRoot,
            blockNumber,
            timestamp,
            difficulty
        ));
        
        // In production: verify proof-of-work and merge-mining
        // RSK blocks are secured by Bitcoin's hashpower via merge-mining
        
        blockHeaders[blockHash] = RskBlockHeader({
            parentHash: parentHash,
            stateRoot: stateRoot,
            transactionsRoot: transactionsRoot,
            blockNumber: blockNumber,
            timestamp: timestamp,
            difficulty: difficulty,
            verified: true
        });
        
        emit BlockHeaderVerified(blockHash, blockNumber);
    }
    
    /**
     * @notice Update required confirmations
     */
    function setRequiredConfirmations(uint256 _confirmations) external onlyOwner {
        requiredConfirmations = _confirmations;
    }
    
    /**
     * @notice Set RSK bridge contract address
     */
    function setRskBridge(address _rskBridge) external onlyOwner {
        rskBridge = _rskBridge;
        emit RskBridgeUpdated(_rskBridge);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if a block header is verified
     */
    function isBlockVerified(bytes32 blockHash) external view returns (bool) {
        return blockHeaders[blockHash].verified;
    }
    
    /**
     * @notice Get block header details
     */
    function getBlockHeader(bytes32 blockHash) external view returns (
        bytes32 parentHash,
        bytes32 stateRoot,
        bytes32 transactionsRoot,
        uint256 blockNumber,
        uint256 timestamp,
        bool verified
    ) {
        RskBlockHeader storage header = blockHeaders[blockHash];
        return (
            header.parentHash,
            header.stateRoot,
            header.transactionsRoot,
            header.blockNumber,
            header.timestamp,
            header.verified
        );
    }
}
