// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BaseBridge
 * @notice Base contract for cross-chain bridge functionality
 * @dev Abstract contract with common bridge logic
 */
abstract contract BaseBridge is ReentrancyGuard, Ownable, Pausable {
    // ============ Constants ============
    
    /// @notice Maximum deposit amount
    uint256 public constant MAX_DEPOSIT = 100 ether;
    
    /// @notice Minimum deposit amount
    uint256 public constant MIN_DEPOSIT = 0.01 ether;
    
    // ============ State Variables ============
    
    /// @notice The shielded pool contract on the hub chain
    address public shieldedPool;
    
    /// @notice Mapping of processed deposits (to prevent replay)
    mapping(bytes32 => bool) public processedDeposits;
    
    /// @notice Mapping of processed withdrawals
    mapping(bytes32 => bool) public processedWithdrawals;
    
    /// @notice Trusted relayers
    mapping(address => bool) public relayers;
    
    /// @notice Total deposited amount
    uint256 public totalDeposited;
    
    /// @notice Total withdrawn amount
    uint256 public totalWithdrawn;
    
    /// @notice Source chain ID
    uint256 public immutable sourceChainId;
    
    /// @notice Hub chain ID (Avalanche Subnet)
    uint256 public immutable hubChainId;
    
    // ============ Events ============
    
    event Deposited(
        address indexed depositor,
        bytes32 indexed commitment,
        uint256 amount,
        uint256 indexed nonce
    );
    
    event WithdrawalProcessed(
        address indexed recipient,
        bytes32 indexed withdrawalHash,
        uint256 amount
    );
    
    event RelayerUpdated(address indexed relayer, bool status);
    
    // ============ Errors ============
    
    error InvalidAmount();
    error DepositAlreadyProcessed();
    error WithdrawalAlreadyProcessed();
    error InvalidProof();
    error NotRelayer();
    error InsufficientLiquidity();
    
    // ============ Modifiers ============
    
    modifier onlyRelayer() {
        if (!relayers[msg.sender]) revert NotRelayer();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        address _shieldedPool,
        uint256 _sourceChainId,
        uint256 _hubChainId
    ) Ownable(msg.sender) {
        shieldedPool = _shieldedPool;
        sourceChainId = _sourceChainId;
        hubChainId = _hubChainId;
    }
    
    // ============ Abstract Functions ============
    
    /**
     * @notice Verify an inclusion proof from the source chain
     */
    function _verifyInclusionProof(
        bytes calldata proof,
        bytes32 depositHash
    ) internal virtual returns (bool);
    
    // ============ External Functions ============
    
    /**
     * @notice Deposit funds to be bridged to the hub chain
     * @param commitment The commitment for the shielded note
     */
    function deposit(bytes32 commitment) external payable nonReentrant whenNotPaused {
        if (msg.value < MIN_DEPOSIT || msg.value > MAX_DEPOSIT) {
            revert InvalidAmount();
        }
        
        uint256 nonce = totalDeposited;
        bytes32 depositHash = keccak256(abi.encodePacked(
            msg.sender,
            commitment,
            msg.value,
            nonce,
            block.timestamp
        ));
        
        if (processedDeposits[depositHash]) revert DepositAlreadyProcessed();
        processedDeposits[depositHash] = true;
        totalDeposited++;
        
        emit Deposited(msg.sender, commitment, msg.value, nonce);
    }
    
    /**
     * @notice Process a withdrawal from the hub chain
     * @param recipient The withdrawal recipient
     * @param amount The withdrawal amount
     * @param withdrawalHash The withdrawal hash from hub chain
     * @param proof Proof of withdrawal authorization on hub chain
     */
    function processWithdrawal(
        address payable recipient,
        uint256 amount,
        bytes32 withdrawalHash,
        bytes calldata proof
    ) external onlyRelayer nonReentrant whenNotPaused {
        if (processedWithdrawals[withdrawalHash]) {
            revert WithdrawalAlreadyProcessed();
        }
        
        if (address(this).balance < amount) {
            revert InsufficientLiquidity();
        }
        
        // Verify the withdrawal proof
        if (!_verifyWithdrawalProof(proof, withdrawalHash, recipient, amount)) {
            revert InvalidProof();
        }
        
        processedWithdrawals[withdrawalHash] = true;
        totalWithdrawn++;
        
        recipient.transfer(amount);
        
        emit WithdrawalProcessed(recipient, withdrawalHash, amount);
    }
    
    /**
     * @notice Verify a withdrawal proof
     */
    function _verifyWithdrawalProof(
        bytes calldata proof,
        bytes32 withdrawalHash,
        address recipient,
        uint256 amount
    ) internal view virtual returns (bool) {
        // In production: verify ZK proof or Merkle proof from hub chain
        // For now, we rely on relayer signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            withdrawalHash,
            recipient,
            amount,
            hubChainId
        ));
        
        // Decode signature from proof
        if (proof.length < 65) return false;
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(proof.offset)
            s := calldataload(add(proof.offset, 32))
            v := byte(0, calldataload(add(proof.offset, 64)))
        }
        
        address signer = ecrecover(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)),
            v, r, s
        );
        
        return relayers[signer];
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set relayer status
     */
    function setRelayer(address relayer, bool status) external onlyOwner {
        relayers[relayer] = status;
        emit RelayerUpdated(relayer, status);
    }
    
    /**
     * @notice Update shielded pool address
     */
    function setShieldedPool(address _shieldedPool) external onlyOwner {
        shieldedPool = _shieldedPool;
    }
    
    /**
     * @notice Pause the bridge
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause the bridge
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdraw (owner only)
     */
    function emergencyWithdraw(address payable to, uint256 amount) external onlyOwner {
        require(paused(), "Not paused");
        to.transfer(amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get bridge liquidity
     */
    function getLiquidity() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Check if deposit was processed
     */
    function isDepositProcessed(bytes32 depositHash) external view returns (bool) {
        return processedDeposits[depositHash];
    }
    
    // ============ Receive ============
    
    receive() external payable {}
}
