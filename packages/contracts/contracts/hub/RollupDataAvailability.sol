// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RollupDataAvailability
 * @dev Simplified data availability layer for Cash.io rollup operations
 * @notice Stores data commitments and state roots for rollup processing
 */
contract RollupDataAvailability is Ownable, ReentrancyGuard {
    // Data commitment structure
    struct DataCommitment {
        bytes32 dataHash;        // Hash of the committed data
        string blobCID;          // IPFS CID of the data blob
        uint256 chainId;         // Source chain ID
        uint256 timestamp;       // Commitment timestamp
        address submitter;       // Address that submitted the commitment
        bool verified;           // Whether data has been verified
    }

    // State root structure
    struct StateRoot {
        bytes32 root;           // State root hash
        uint256 blockNumber;    // Block number for this state
        uint256 timestamp;      // When state was recorded
        uint256 txCount;        // Number of transactions in this state
    }

    // Events
    event DataCommitted(
        uint256 indexed commitmentId,
        bytes32 indexed dataHash,
        uint256 indexed chainId,
        address submitter,
        string blobCID
    );

    event StateRootSubmitted(
        uint256 indexed chainId,
        bytes32 indexed stateRoot,
        uint256 blockNumber,
        uint256 txCount
    );

    event DataVerified(
        uint256 indexed commitmentId,
        bytes32 dataHash,
        bool verified
    );

    // State variables
    DataCommitment[] public dataCommitments;
    mapping(uint256 => StateRoot) public latestStateRoots;
    mapping(bytes32 => uint256) public dataHashToCommitment;
    mapping(address => bool) public authorizedSubmitters;
    mapping(uint256 => bool) public supportedChains;

    // Statistics
    uint256 public totalCommitments;
    uint256 public totalVerifiedCommitments;

    constructor() Ownable(msg.sender) {
        // Authorize deployer as initial submitter
        authorizedSubmitters[msg.sender] = true;
        
        // Add support for common chains
        supportedChains[1] = true;     // Ethereum Mainnet
        supportedChains[137] = true;   // Polygon
        supportedChains[43114] = true; // Avalanche C-Chain
        supportedChains[56] = true;    // BSC
        supportedChains[11155111] = true; // Sepolia Testnet  
        supportedChains[4102] = true;  // Cash.io Subnet
    }

    modifier onlyAuthorized() {
        require(authorizedSubmitters[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    modifier onlySupportedChain(uint256 _chainId) {
        require(supportedChains[_chainId], "Chain not supported");
        _;
    }

    /**
     * @dev Commit data to the availability layer
     * @param _dataHash Hash of the data being committed
     * @param _blobCID IPFS CID where data is stored
     * @param _chainId Source chain ID
     */
    function commitData(
        bytes32 _dataHash,
        string calldata _blobCID,
        uint256 _chainId
    ) external onlyAuthorized onlySupportedChain(_chainId) nonReentrant {
        require(_dataHash != bytes32(0), "Invalid data hash");
        require(bytes(_blobCID).length > 0, "Invalid blob CID");
        require(dataHashToCommitment[_dataHash] == 0, "Data already committed");

        // Create commitment
        DataCommitment memory commitment = DataCommitment({
            dataHash: _dataHash,
            blobCID: _blobCID,
            chainId: _chainId,
            timestamp: block.timestamp,
            submitter: msg.sender,
            verified: false
        });

        dataCommitments.push(commitment);
        uint256 commitmentId = totalCommitments;
        dataHashToCommitment[_dataHash] = commitmentId + 1; // +1 to distinguish from default 0
        totalCommitments++;

        emit DataCommitted(commitmentId, _dataHash, _chainId, msg.sender, _blobCID);
    }

    /**
     * @dev Submit state root for a chain
     * @param _chainId Chain ID
     * @param _stateRoot State root hash
     * @param _blockNumber Block number
     * @param _txCount Number of transactions included
     */
    function submitStateRoot(
        uint256 _chainId,
        bytes32 _stateRoot,
        uint256 _blockNumber,
        uint256 _txCount
    ) external onlyAuthorized onlySupportedChain(_chainId) {
        require(_stateRoot != bytes32(0), "Invalid state root");

        // Create state root entry
        StateRoot memory newRoot = StateRoot({
            root: _stateRoot,
            blockNumber: _blockNumber,
            timestamp: block.timestamp,
            txCount: _txCount
        });

        latestStateRoots[_chainId] = newRoot;

        emit StateRootSubmitted(_chainId, _stateRoot, _blockNumber, _txCount);
    }

    /**
     * @dev Verify data commitment
     * @param _commitmentId Commitment ID to verify
     * @param _verified Whether data is verified
     */
    function verifyData(uint256 _commitmentId, bool _verified) external onlyOwner {
        require(_commitmentId < totalCommitments, "Invalid commitment ID");
        
        DataCommitment storage commitment = dataCommitments[_commitmentId];
        bool wasVerified = commitment.verified;
        commitment.verified = _verified;

        // Update verified count
        if (_verified && !wasVerified) {
            totalVerifiedCommitments++;
        } else if (!_verified && wasVerified) {
            totalVerifiedCommitments--;
        }

        emit DataVerified(_commitmentId, commitment.dataHash, _verified);
    }

    /**
     * @dev Add authorized submitter
     * @param _submitter Address to authorize
     */
    function addAuthorizedSubmitter(address _submitter) external onlyOwner {
        require(_submitter != address(0), "Invalid submitter");
        authorizedSubmitters[_submitter] = true;
    }

    /**
     * @dev Remove authorized submitter
     * @param _submitter Address to remove
     */
    function removeAuthorizedSubmitter(address _submitter) external onlyOwner {
        authorizedSubmitters[_submitter] = false;
    }

    /**
     * @dev Add supported chain
     * @param _chainId Chain ID to support
     */
    function addSupportedChain(uint256 _chainId) external onlyOwner {
        require(_chainId > 0, "Invalid chain ID");
        supportedChains[_chainId] = true;
    }

    /**
     * @dev Remove supported chain
     * @param _chainId Chain ID to remove
     */
    function removeSupportedChain(uint256 _chainId) external onlyOwner {
        supportedChains[_chainId] = false;
    }

    /**
     * @dev Get data commitment by ID
     * @param _commitmentId Commitment ID
     * @return DataCommitment Commitment details
     */
    function getDataCommitment(uint256 _commitmentId) external view returns (DataCommitment memory) {
        require(_commitmentId < totalCommitments, "Invalid commitment ID");
        return dataCommitments[_commitmentId];
    }

    /**
     * @dev Get latest state root for a chain
     * @param _chainId Chain ID
     * @return StateRoot Latest state root
     */
    function getLatestStateRoot(uint256 _chainId) external view returns (StateRoot memory) {
        return latestStateRoots[_chainId];
    }

    /**
     * @dev Check if data hash is committed
     * @param _dataHash Data hash to check
     * @return bool Whether data is committed
     */
    function isDataCommitted(bytes32 _dataHash) external view returns (bool) {
        return dataHashToCommitment[_dataHash] > 0;
    }

    /**
     * @dev Get total number of commitments
     * @return uint256 Total commitments
     */
    function getTotalCommitments() external view returns (uint256) {
        return totalCommitments;
    }

    /**
     * @dev Get total verified commitments
     * @return uint256 Total verified commitments
     */
    function getTotalVerifiedCommitments() external view returns (uint256) {
        return totalVerifiedCommitments;
    }

    /**
     * @dev Get verification rate (percentage)
     * @return uint256 Verification rate (0-100)
     */
    function getVerificationRate() external view returns (uint256) {
        if (totalCommitments == 0) return 0;
        return (totalVerifiedCommitments * 100) / totalCommitments;
    }
}
