// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title TransactionRegistry
 * @dev Hub contract for recording all Cash.io transactions across connected chains
 * @notice This contract serves as the central ledger for all Cash.io operations
 */
contract TransactionRegistry is Ownable, ReentrancyGuard {
    // Transaction types supported by Cash.io protocol
    enum TxType {
        SHIELD,      // Shield funds into privacy pool
        UNSHIELD,    // Unshield funds from privacy pool
        TRANSFER,    // Private transfer within shielded pool
        BRIDGE,      // Cross-chain bridge operation
        NOTE_IMPORT  // Import note from another chain
    }

    // Individual transaction record
    struct TransactionRecord {
        bytes32 txHash;           // Original transaction hash on source chain
        uint256 chainId;          // Source chain ID
        TxType txType;            // Type of transaction
        address user;             // User address (if public)
        uint256 amount;           // Amount involved (0 for private transfers)
        bytes32 commitment;       // Zero-knowledge commitment
        uint256 timestamp;        // Block timestamp
        uint256 blockNumber;      // Block number on source chain
        bytes32 noteHash;         // Note hash (for note-based operations)
        bool isPrivate;           // Whether transaction details are private
    }

    // Rollup batch structure for efficient data storage
    struct RollupBatch {
        uint256 batchId;          // Unique batch identifier
        bytes32 merkleRoot;       // Merkle root of transaction hashes
        uint256 txCount;          // Number of transactions in batch
        uint256 startBlock;       // Starting block number
        uint256 endBlock;         // Ending block number
        uint256 timestamp;        // Batch creation timestamp
        bytes32 dataHash;         // Hash of all batch data
    }

    // Events
    event TransactionRecorded(
        bytes32 indexed txHash,
        uint256 indexed chainId,
        TxType indexed txType,
        address user,
        uint256 timestamp
    );

    event BatchCreated(
        uint256 indexed batchId,
        bytes32 indexed merkleRoot,
        uint256 txCount,
        uint256 timestamp
    );

    event BatchFinalized(
        uint256 indexed batchId,
        bytes32 dataHash
    );

    // State variables
    TransactionRecord[] public transactions;
    RollupBatch[] public batches;
    
    mapping(bytes32 => bool) public recordedTxHashes;
    mapping(uint256 => uint256) public chainTxCount;
    mapping(uint256 => bool) public supportedChains;
    
    // Batch configuration
    uint256 public minBatchSize = 10;
    uint256 public maxBatchSize = 100;
    uint256 public batchTimeout = 1 hours;
    
    // Current batch tracking
    uint256 public currentBatchSize = 0;
    uint256 public lastBatchTime;
    
    // Total statistics
    uint256 public totalTxCount;
    uint256 public totalBatchCount;

    constructor() Ownable(msg.sender) {
        lastBatchTime = block.timestamp;
        
        // Add support for common chains by default
        supportedChains[1] = true;     // Ethereum Mainnet
        supportedChains[137] = true;   // Polygon
        supportedChains[43114] = true; // Avalanche C-Chain
        supportedChains[56] = true;    // BSC
        supportedChains[11155111] = true; // Sepolia Testnet
        supportedChains[4102] = true;  // Cash.io Subnet
    }

    /**
     * @dev Record a single transaction on the hub
     * @param _txHash Original transaction hash on source chain
     * @param _chainId Source chain ID
     * @param _txType Type of transaction
     * @param _user User address (address(0) for private)
     * @param _amount Amount involved (0 for private transfers)
     * @param _commitment Zero-knowledge commitment
     * @param _blockNumber Block number on source chain
     * @param _noteHash Note hash (bytes32(0) if not applicable)
     * @param _isPrivate Whether transaction is private
     */
    function recordTransaction(
        bytes32 _txHash,
        uint256 _chainId,
        TxType _txType,
        address _user,
        uint256 _amount,
        bytes32 _commitment,
        uint256 _blockNumber,
        bytes32 _noteHash,
        bool _isPrivate
    ) external onlyOwner nonReentrant {
        require(supportedChains[_chainId], "Chain not supported");
        require(_txHash != bytes32(0), "Invalid transaction hash");
        require(!recordedTxHashes[_txHash], "Transaction already recorded");
        require(_commitment != bytes32(0), "Invalid commitment");

        // Record the transaction
        TransactionRecord memory newTx = TransactionRecord({
            txHash: _txHash,
            chainId: _chainId,
            txType: _txType,
            user: _user,
            amount: _amount,
            commitment: _commitment,
            timestamp: block.timestamp,
            blockNumber: _blockNumber,
            noteHash: _noteHash,
            isPrivate: _isPrivate
        });

        transactions.push(newTx);
        recordedTxHashes[_txHash] = true;
        chainTxCount[_chainId]++;
        totalTxCount++;
        currentBatchSize++;

        emit TransactionRecorded(_txHash, _chainId, _txType, _user, block.timestamp);

        // Auto-batch if conditions are met
        if (shouldCreateBatch()) {
            _createBatch();
        }
    }

    /**
     * @dev Record multiple transactions in a single call
     * @param _txHashes Array of transaction hashes
     * @param _chainIds Array of chain IDs
     * @param _txTypes Array of transaction types
     * @param _users Array of user addresses
     * @param _amounts Array of amounts
     * @param _commitments Array of commitments
     * @param _blockNumbers Array of block numbers
     * @param _noteHashes Array of note hashes
     * @param _isPrivateFlags Array of privacy flags
     */
    function recordTransactionBatch(
        bytes32[] calldata _txHashes,
        uint256[] calldata _chainIds,
        TxType[] calldata _txTypes,
        address[] calldata _users,
        uint256[] calldata _amounts,
        bytes32[] calldata _commitments,
        uint256[] calldata _blockNumbers,
        bytes32[] calldata _noteHashes,
        bool[] calldata _isPrivateFlags
    ) external onlyOwner nonReentrant {
        uint256 length = _txHashes.length;
        require(length > 0 && length <= maxBatchSize, "Invalid batch size");
        require(
            _chainIds.length == length &&
            _txTypes.length == length &&
            _users.length == length &&
            _amounts.length == length &&
            _commitments.length == length &&
            _blockNumbers.length == length &&
            _noteHashes.length == length &&
            _isPrivateFlags.length == length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < length; i++) {
            require(supportedChains[_chainIds[i]], "Chain not supported");
            require(_txHashes[i] != bytes32(0), "Invalid transaction hash");
            require(!recordedTxHashes[_txHashes[i]], "Transaction already recorded");
            require(_commitments[i] != bytes32(0), "Invalid commitment");

            TransactionRecord memory newTx = TransactionRecord({
                txHash: _txHashes[i],
                chainId: _chainIds[i],
                txType: _txTypes[i],
                user: _users[i],
                amount: _amounts[i],
                commitment: _commitments[i],
                timestamp: block.timestamp,
                blockNumber: _blockNumbers[i],
                noteHash: _noteHashes[i],
                isPrivate: _isPrivateFlags[i]
            });

            transactions.push(newTx);
            recordedTxHashes[_txHashes[i]] = true;
            chainTxCount[_chainIds[i]]++;
            totalTxCount++;

            emit TransactionRecorded(_txHashes[i], _chainIds[i], _txTypes[i], _users[i], block.timestamp);
        }

        currentBatchSize += length;

        // Auto-batch if conditions are met
        if (shouldCreateBatch()) {
            _createBatch();
        }
    }

    /**
     * @dev Force creation of a batch (admin function)
     */
    function forceBatch() external onlyOwner {
        require(currentBatchSize > 0, "No transactions to batch");
        _createBatch();
    }

    /**
     * @dev Check if a batch should be created
     */
    function shouldCreateBatch() public view returns (bool) {
        return currentBatchSize >= minBatchSize || 
               (currentBatchSize > 0 && block.timestamp >= lastBatchTime + batchTimeout);
    }

    /**
     * @dev Internal function to create a rollup batch
     */
    function _createBatch() internal {
        require(currentBatchSize > 0, "No transactions to batch");

        uint256 startIndex = totalTxCount - currentBatchSize;
        bytes32[] memory txHashes = new bytes32[](currentBatchSize);
        
        // Collect transaction hashes for merkle tree
        for (uint256 i = 0; i < currentBatchSize; i++) {
            txHashes[i] = transactions[startIndex + i].txHash;
        }

        // Calculate merkle root
        bytes32 merkleRoot = _calculateMerkleRoot(txHashes);
        
        // Create batch record
        RollupBatch memory newBatch = RollupBatch({
            batchId: totalBatchCount,
            merkleRoot: merkleRoot,
            txCount: currentBatchSize,
            startBlock: transactions[startIndex].blockNumber,
            endBlock: transactions[totalTxCount - 1].blockNumber,
            timestamp: block.timestamp,
            dataHash: bytes32(0) // Will be set after finalization
        });

        batches.push(newBatch);
        totalBatchCount++;

        emit BatchCreated(newBatch.batchId, merkleRoot, currentBatchSize, block.timestamp);

        // Reset batch tracking
        currentBatchSize = 0;
        lastBatchTime = block.timestamp;
    }

    /**
     * @dev Calculate merkle root from transaction hashes
     * @param _txHashes Array of transaction hashes
     * @return bytes32 Merkle root
     */
    function _calculateMerkleRoot(bytes32[] memory _txHashes) internal pure returns (bytes32) {
        if (_txHashes.length == 0) return bytes32(0);
        if (_txHashes.length == 1) return _txHashes[0];

        uint256 n = _txHashes.length;
        bytes32[] memory tree = new bytes32[](n);
        
        // Copy input
        for (uint256 i = 0; i < n; i++) {
            tree[i] = _txHashes[i];
        }

        // Build tree bottom-up
        while (n > 1) {
            for (uint256 i = 0; i < n / 2; i++) {
                tree[i] = keccak256(abi.encodePacked(tree[2 * i], tree[2 * i + 1]));
            }
            if (n % 2 == 1) {
                tree[n / 2] = tree[n - 1];
                n = n / 2 + 1;
            } else {
                n = n / 2;
            }
        }

        return tree[0];
    }

    /**
     * @dev Finalize a batch with data hash
     * @param _batchId Batch ID to finalize
     * @param _dataHash Hash of the batch data
     */
    function finalizeBatch(uint256 _batchId, bytes32 _dataHash) external onlyOwner {
        require(_batchId < totalBatchCount, "Invalid batch ID");
        require(_dataHash != bytes32(0), "Invalid data hash");
        
        batches[_batchId].dataHash = _dataHash;
        emit BatchFinalized(_batchId, _dataHash);
    }

    /**
     * @dev Add support for a new chain
     * @param _chainId Chain ID to add support for
     */
    function addSupportedChain(uint256 _chainId) external onlyOwner {
        require(_chainId > 0, "Invalid chain ID");
        supportedChains[_chainId] = true;
    }

    /**
     * @dev Remove support for a chain
     * @param _chainId Chain ID to remove support for
     */
    function removeSupportedChain(uint256 _chainId) external onlyOwner {
        supportedChains[_chainId] = false;
    }

    /**
     * @dev Update batch configuration
     * @param _minBatchSize Minimum batch size
     * @param _maxBatchSize Maximum batch size
     * @param _batchTimeout Batch timeout in seconds
     */
    function updateBatchConfig(
        uint256 _minBatchSize,
        uint256 _maxBatchSize,
        uint256 _batchTimeout
    ) external onlyOwner {
        require(_minBatchSize > 0 && _minBatchSize <= _maxBatchSize, "Invalid batch sizes");
        require(_batchTimeout > 0, "Invalid timeout");

        minBatchSize = _minBatchSize;
        maxBatchSize = _maxBatchSize;
        batchTimeout = _batchTimeout;
    }

    /**
     * @dev Get transaction by index
     * @param _index Transaction index
     * @return TransactionRecord Transaction details
     */
    function getTransaction(uint256 _index) external view returns (TransactionRecord memory) {
        require(_index < totalTxCount, "Invalid transaction index");
        return transactions[_index];
    }

    /**
     * @dev Get batch by ID
     * @param _batchId Batch ID
     * @return RollupBatch Batch details
     */
    function getBatch(uint256 _batchId) external view returns (RollupBatch memory) {
        require(_batchId < totalBatchCount, "Invalid batch ID");
        return batches[_batchId];
    }

    /**
     * @dev Get total number of transactions
     */
    function getTotalTransactions() external view returns (uint256) {
        return totalTxCount;
    }

    /**
     * @dev Get total number of batches
     */
    function getTotalBatches() external view returns (uint256) {
        return totalBatchCount;
    }

    /**
     * @dev Get transaction count for a specific chain
     * @param _chainId Chain ID
     */
    function getChainTransactionCount(uint256 _chainId) external view returns (uint256) {
        return chainTxCount[_chainId];
    }

    /**
     * @dev Check if transaction hash is already recorded
     * @param _txHash Transaction hash to check
     */
    function isTransactionRecorded(bytes32 _txHash) external view returns (bool) {
        return recordedTxHashes[_txHash];
    }

    /**
     * @dev Get current batch status
     */
    function getCurrentBatchStatus() external view returns (uint256 size, uint256 timeRemaining) {
        size = currentBatchSize;
        
        if (block.timestamp >= lastBatchTime + batchTimeout) {
            timeRemaining = 0;
        } else {
            timeRemaining = (lastBatchTime + batchTimeout) - block.timestamp;
        }
    }
}
