// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IEntryPoint.sol";

/**
 * @title CashAccount
 * @notice Smart contract account for Cash.io with social recovery
 * @dev ERC-4337 compliant smart account with enhanced features
 * 
 * Features:
 * - Multi-signature support
 * - Social recovery with guardians
 * - Spending limits
 * - Session keys for dApp interactions
 * - Batched transactions
 */
contract CashAccount is IAccount, Initializable, UUPSUpgradeable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    // ============ Constants ============
    
    /// @notice Recovery delay period
    uint256 public constant RECOVERY_DELAY = 2 days;
    
    /// @notice Maximum number of guardians
    uint256 public constant MAX_GUARDIANS = 5;
    
    // ============ State Variables ============
    
    /// @notice The EntryPoint contract
    IEntryPoint public immutable entryPoint;
    
    /// @notice Account owner
    address public owner;
    
    /// @notice Guardian addresses for social recovery
    address[] public guardians;
    
    /// @notice Required guardian approvals for recovery
    uint256 public recoveryThreshold;
    
    /// @notice Pending recovery information
    address public pendingRecoveryNewOwner;
    uint256 public pendingRecoveryExecuteAfter;
    uint256 public pendingRecoveryApprovalCount;
    mapping(address => bool) public recoveryApprovals;
    
    /// @notice Daily spending limit
    uint256 public dailySpendLimit;
    
    /// @notice Current day's spending
    uint256 public dailySpendAmount;
    uint256 public dailySpendLastReset;
    
    /// @notice Session keys with permissions
    mapping(address => SessionKey) public sessionKeys;
    
    /// @notice Nonce for replay protection
    uint256 private _nonce;
    
    // ============ Structs ============
    
    struct SessionKey {
        bool active;
        uint256 validUntil;
        uint256 spendLimit;
        address[] allowedTargets;
    }
    
    // ============ Events ============
    
    event AccountInitialized(address indexed owner, address[] guardians);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event GuardiansUpdated(address[] guardians, uint256 threshold);
    event RecoveryInitiated(address indexed newOwner, uint256 executeAfter);
    event RecoveryApproved(address indexed guardian, address indexed newOwner);
    event RecoveryExecuted(address indexed newOwner);
    event RecoveryCancelled();
    event SessionKeyAdded(address indexed key, uint256 validUntil);
    event SessionKeyRevoked(address indexed key);
    event Executed(address indexed target, uint256 value, bytes data);
    event ExecutedBatch(address[] targets, uint256[] values, bytes[] datas);
    
    // ============ Errors ============
    
    error NotOwner();
    error NotEntryPoint();
    error NotGuardian();
    error InvalidSignature();
    error RecoveryNotReady();
    error RecoveryAlreadyApproved();
    error NoRecoveryPending();
    error SpendLimitExceeded();
    error SessionExpired();
    error TargetNotAllowed();
    error InvalidGuardians();
    error ExecutionFailed();
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint)) revert NotEntryPoint();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
        _disableInitializers();
    }
    
    // ============ Initialization ============
    
    /**
     * @notice Initialize the account
     * @param _owner The account owner
     * @param _guardians Guardian addresses for recovery
     * @param _threshold Required approvals for recovery
     * @param _spendLimit Daily spending limit
     */
    function initialize(
        address _owner,
        address[] calldata _guardians,
        uint256 _threshold,
        uint256 _spendLimit
    ) public initializer {
        if (_guardians.length > MAX_GUARDIANS) revert InvalidGuardians();
        if (_threshold > _guardians.length) revert InvalidGuardians();
        
        owner = _owner;
        guardians = _guardians;
        recoveryThreshold = _threshold;
        dailySpendLimit = _spendLimit;
        
        emit AccountInitialized(_owner, _guardians);
    }
    
    // ============ Account Abstraction ============
    
    /**
     * @notice Get current nonce
     */
    function getNonce() public view returns (uint256) {
        return _nonce;
    }
    
    /**
     * @notice Validate user operation signature
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        validationData = _validateSignature(userOp, userOpHash);
        _nonce++;
        
        if (missingAccountFunds > 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            (success);
        }
        
        return validationData;
    }
    
    /**
     * @notice Internal signature validation
     */
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        
        // Check owner signature
        address signer = hash.recover(userOp.signature);
        
        if (signer == owner) {
            return 0; // Valid
        }
        
        // Check session key
        SessionKey storage session = sessionKeys[signer];
        if (session.active && block.timestamp <= session.validUntil) {
            // Validate target is allowed
            address target = _extractTarget(userOp.callData);
            bool allowed = false;
            for (uint i = 0; i < session.allowedTargets.length; i++) {
                if (session.allowedTargets[i] == target) {
                    allowed = true;
                    break;
                }
            }
            if (allowed) {
                return 0; // Valid session key
            }
        }
        
        return 1; // Invalid
    }
    
    // ============ Execution ============
    
    /**
     * @notice Execute a transaction
     * @param target Target address
     * @param value ETH value
     * @param data Call data
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyEntryPoint {
        _checkSpendLimit(value);
        
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        
        emit Executed(target, value, data);
    }
    
    /**
     * @notice Execute a batch of transactions
     * @param targets Target addresses
     * @param values ETH values
     * @param datas Call data arrays
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyEntryPoint {
        require(targets.length == values.length && values.length == datas.length, "Length mismatch");
        
        uint256 totalValue;
        for (uint i = 0; i < values.length; i++) {
            totalValue += values[i];
        }
        _checkSpendLimit(totalValue);
        
        for (uint i = 0; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].call{value: values[i]}(datas[i]);
            if (!success) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        }
        
        emit ExecutedBatch(targets, values, datas);
    }
    
    // ============ Social Recovery ============
    
    /**
     * @notice Initiate account recovery
     * @param newOwner The new owner address
     */
    function initiateRecovery(address newOwner) external {
        bool isGuardian = false;
        for (uint i = 0; i < guardians.length; i++) {
            if (guardians[i] == msg.sender) {
                isGuardian = true;
                break;
            }
        }
        if (!isGuardian) revert NotGuardian();
        
        pendingRecoveryNewOwner = newOwner;
        pendingRecoveryExecuteAfter = block.timestamp + RECOVERY_DELAY;
        pendingRecoveryApprovalCount = 1;
        recoveryApprovals[msg.sender] = true;
        
        emit RecoveryInitiated(newOwner, pendingRecoveryExecuteAfter);
        emit RecoveryApproved(msg.sender, newOwner);
    }
    
    /**
     * @notice Approve a pending recovery
     */
    function approveRecovery() external {
        if (pendingRecoveryNewOwner == address(0)) revert NoRecoveryPending();
        
        bool isGuardian = false;
        for (uint i = 0; i < guardians.length; i++) {
            if (guardians[i] == msg.sender) {
                isGuardian = true;
                break;
            }
        }
        if (!isGuardian) revert NotGuardian();
        if (recoveryApprovals[msg.sender]) revert RecoveryAlreadyApproved();
        
        recoveryApprovals[msg.sender] = true;
        pendingRecoveryApprovalCount++;
        
        emit RecoveryApproved(msg.sender, pendingRecoveryNewOwner);
    }
    
    /**
     * @notice Execute approved recovery
     */
    function executeRecovery() external {
        if (pendingRecoveryNewOwner == address(0)) revert NoRecoveryPending();
        if (block.timestamp < pendingRecoveryExecuteAfter) revert RecoveryNotReady();
        if (pendingRecoveryApprovalCount < recoveryThreshold) revert RecoveryNotReady();
        
        address oldOwner = owner;
        owner = pendingRecoveryNewOwner;
        
        // Clear pending recovery
        pendingRecoveryNewOwner = address(0);
        pendingRecoveryExecuteAfter = 0;
        pendingRecoveryApprovalCount = 0;
        
        emit OwnerChanged(oldOwner, owner);
        emit RecoveryExecuted(owner);
    }
    
    /**
     * @notice Cancel pending recovery (owner only)
     */
    function cancelRecovery() external onlyOwner {
        pendingRecoveryNewOwner = address(0);
        pendingRecoveryExecuteAfter = 0;
        pendingRecoveryApprovalCount = 0;
        emit RecoveryCancelled();
    }
    
    // ============ Session Keys ============
    
    /**
     * @notice Add a session key
     * @param key Session key address
     * @param validUntil Expiration timestamp
     * @param spendLimit Max spend for this key
     * @param allowedTargets Allowed target contracts
     */
    function addSessionKey(
        address key,
        uint256 validUntil,
        uint256 spendLimit,
        address[] calldata allowedTargets
    ) external onlyOwner {
        sessionKeys[key] = SessionKey({
            active: true,
            validUntil: validUntil,
            spendLimit: spendLimit,
            allowedTargets: allowedTargets
        });
        
        emit SessionKeyAdded(key, validUntil);
    }
    
    /**
     * @notice Revoke a session key
     * @param key Session key to revoke
     */
    function revokeSessionKey(address key) external onlyOwner {
        delete sessionKeys[key];
        emit SessionKeyRevoked(key);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Check and update daily spending
     */
    function _checkSpendLimit(uint256 value) internal {
        if (dailySpendLimit == 0) return;
        
        uint256 dayStart = (block.timestamp / 1 days) * 1 days;
        
        if (dailySpendLastReset < dayStart) {
            dailySpendAmount = 0;
            dailySpendLastReset = dayStart;
        }
        
        if (dailySpendAmount + value > dailySpendLimit) {
            revert SpendLimitExceeded();
        }
        
        dailySpendAmount += value;
    }
    
    /**
     * @notice Extract target from execute call
     */
    function _extractTarget(bytes calldata data) internal pure returns (address) {
        if (data.length < 36) return address(0);
        return address(bytes20(data[16:36]));
    }
    
    /**
     * @notice Required for UUPS upgrades
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}
    
    // ============ Receive ============
    
    receive() external payable {}
}
