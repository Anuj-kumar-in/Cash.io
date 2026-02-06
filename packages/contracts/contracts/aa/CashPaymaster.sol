// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IEntryPoint.sol";

/**
 * @title CashPaymaster
 * @notice Paymaster that sponsors gas for Cash.io operations
 * @dev Implements ERC-4337 paymaster for zero-fee user experience
 * 
 * Features:
 * - Sponsors gas for shield, transfer, and unshield operations
 * - Configurable daily limits per user
 * - Whitelist of sponsored methods
 * - Rate limiting and abuse prevention
 */
contract CashPaymaster is IPaymaster, Ownable {
    // ============ Constants ============
    
    /// @notice Maximum daily sponsored value per user (in wei equivalent)
    uint256 public constant DEFAULT_DAILY_LIMIT = 1 ether;
    
    /// @notice Minimum stake for registration
    uint256 public constant MIN_STAKE = 0.5 ether;
    
    // ============ State Variables ============
    
    /// @notice The entry point contract
    IEntryPoint public immutable entryPoint;
    
    /// @notice The shielded pool contract
    address public shieldedPool;
    
    /// @notice Mapping of whitelisted method selectors per contract
    mapping(address => mapping(bytes4 => bool)) public whitelistedMethods;
    
    /// @notice Daily spending per user
    mapping(address => DailyUsage) public dailyUsage;
    
    /// @notice Custom limits per user (0 = use default)
    mapping(address => uint256) public userLimits;
    
    /// @notice Paused state
    bool public paused;
    
    // ============ Structs ============
    
    struct DailyUsage {
        uint256 spent;
        uint256 lastResetTimestamp;
    }
    
    // ============ Events ============
    
    event GasSponsored(
        address indexed sender,
        bytes4 indexed method,
        uint256 gasUsed,
        uint256 gasCost
    );
    
    event MethodWhitelisted(address indexed target, bytes4 indexed selector, bool whitelisted);
    event UserLimitSet(address indexed user, uint256 limit);
    event Paused(bool isPaused);
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    
    // ============ Errors ============
    
    error PaymasterPaused();
    error MethodNotWhitelisted();
    error DailyLimitExceeded();
    error InvalidShieldedPool();
    error InsufficientDeposit();
    error NotFromEntryPoint();
    
    // ============ Modifiers ============
    
    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint)) revert NotFromEntryPoint();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        IEntryPoint _entryPoint,
        address _shieldedPool
    ) Ownable(msg.sender) {
        entryPoint = _entryPoint;
        shieldedPool = _shieldedPool;
        
        // Whitelist default methods
        _whitelistMethod(_shieldedPool, bytes4(keccak256("deposit(bytes32)")));
        _whitelistMethod(_shieldedPool, bytes4(keccak256("withdraw(bytes,bytes32,bytes32,address,address,uint256)")));
        _whitelistMethod(_shieldedPool, bytes4(keccak256("privateTransfer(bytes,bytes32,bytes32,bytes32,bytes32,bytes32)")));
    }
    
    // ============ Paymaster Functions ============
    
    /**
     * @notice Validate a UserOperation for gas sponsorship
     * @param userOp The user operation
     * @param userOpHash Hash of the user operation
     * @param maxCost Maximum cost of the operation
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        if (paused) revert PaymasterPaused();
        
        // Extract target and inner selector from calldata
        (address target, bytes4 innerSelector) = _extractTargetAndSelector(userOp.callData);
        
        // Check if method is whitelisted
        if (!whitelistedMethods[target][innerSelector]) {
            revert MethodNotWhitelisted();
        }
        
        // Check daily limit
        address sender = userOp.sender;
        _resetDailyIfNeeded(sender);
        
        uint256 limit = userLimits[sender] > 0 ? userLimits[sender] : DEFAULT_DAILY_LIMIT;
        if (dailyUsage[sender].spent + maxCost > limit) {
            revert DailyLimitExceeded();
        }
        
        // Update usage
        dailyUsage[sender].spent += maxCost;
        
        // Return context with sender and method for postOp
        context = abi.encode(sender, innerSelector, maxCost);
        validationData = 0; // Valid, no time restrictions
        
        return (context, validationData);
    }
    
    /**
     * @notice Post-operation hook for gas accounting
     * @param mode Post-op mode
     * @param context Context from validation
     * @param actualGasCost Actual gas used
     * @param actualUserOpFeePerGas Fee per gas
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external override onlyEntryPoint {
        (address sender, bytes4 selector, uint256 maxCost) = abi.decode(
            context,
            (address, bytes4, uint256)
        );
        
        // Refund overestimated cost
        if (actualGasCost < maxCost) {
            dailyUsage[sender].spent -= (maxCost - actualGasCost);
        }
        
        emit GasSponsored(sender, selector, actualGasCost, actualGasCost * actualUserOpFeePerGas);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Extract target address and selector from smart account execute call
     */
    function _extractTargetAndSelector(bytes calldata callData) internal pure returns (address target, bytes4 selector) {
        // Assuming standard execute(address,uint256,bytes) signature
        if (callData.length < 136) return (address(0), bytes4(0));
        
        // Skip function selector (4 bytes), decode address
        target = address(bytes20(callData[16:36]));
        
        // The inner calldata starts at byte 132 (4 + 32 + 32 + 32 + 32)
        if (callData.length >= 136) {
            selector = bytes4(callData[132:136]);
        }
        
        return (target, selector);
    }
    
    /**
     * @notice Reset daily usage if needed
     */
    function _resetDailyIfNeeded(address user) internal {
        uint256 dayStart = (block.timestamp / 1 days) * 1 days;
        
        if (dailyUsage[user].lastResetTimestamp < dayStart) {
            dailyUsage[user].spent = 0;
            dailyUsage[user].lastResetTimestamp = dayStart;
        }
    }
    
    function _whitelistMethod(address target, bytes4 selector) internal {
        whitelistedMethods[target][selector] = true;
        emit MethodWhitelisted(target, selector, true);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Add a whitelisted method
     * @param target The target contract
     * @param methodSignature The method signature (e.g., "deposit(bytes32)")
     */
    function addWhitelistedMethod(address target, string calldata methodSignature) external onlyOwner {
        bytes4 selector = bytes4(keccak256(bytes(methodSignature)));
        whitelistedMethods[target][selector] = true;
        emit MethodWhitelisted(target, selector, true);
    }
    
    /**
     * @notice Remove a whitelisted method
     * @param target The target contract
     * @param selector The method selector
     */
    function removeWhitelistedMethod(address target, bytes4 selector) external onlyOwner {
        whitelistedMethods[target][selector] = false;
        emit MethodWhitelisted(target, selector, false);
    }
    
    /**
     * @notice Set custom limit for a user
     * @param user The user address
     * @param limit The daily limit (0 = use default)
     */
    function setUserLimit(address user, uint256 limit) external onlyOwner {
        userLimits[user] = limit;
        emit UserLimitSet(user, limit);
    }
    
    /**
     * @notice Update shielded pool address
     * @param _shieldedPool New shielded pool address
     */
    function setShieldedPool(address _shieldedPool) external onlyOwner {
        if (_shieldedPool == address(0)) revert InvalidShieldedPool();
        shieldedPool = _shieldedPool;
    }
    
    /**
     * @notice Pause or unpause the paymaster
     * @param _paused Whether to pause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }
    
    /**
     * @notice Deposit funds to the entry point
     */
    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @notice Withdraw funds from the entry point
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawTo(address payable to, uint256 amount) external onlyOwner {
        // This requires the entryPoint to have a withdraw function
        // For now, we'll emit an event
        emit Withdrawn(to, amount);
    }
    
    /**
     * @notice Add stake to the entry point
     * @param unstakeDelaySec Delay before unstaking
     */
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get remaining daily allowance for a user
     * @param user The user address
     */
    function getRemainingAllowance(address user) external view returns (uint256) {
        uint256 dayStart = (block.timestamp / 1 days) * 1 days;
        
        if (dailyUsage[user].lastResetTimestamp < dayStart) {
            // Would be reset on next interaction
            return userLimits[user] > 0 ? userLimits[user] : DEFAULT_DAILY_LIMIT;
        }
        
        uint256 limit = userLimits[user] > 0 ? userLimits[user] : DEFAULT_DAILY_LIMIT;
        uint256 spent = dailyUsage[user].spent;
        
        return spent >= limit ? 0 : limit - spent;
    }
    
    /**
     * @notice Check if a method is whitelisted
     * @param target The target contract
     * @param selector The method selector
     */
    function isMethodWhitelisted(address target, bytes4 selector) external view returns (bool) {
        return whitelistedMethods[target][selector];
    }
    
    /**
     * @notice Get the entry point deposit
     */
    function getDeposit() external view returns (uint256) {
        return entryPoint.getDepositInfo(address(this)).deposit;
    }
    
    // Receive function to accept ETH
    receive() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Deposited(msg.sender, msg.value);
    }
}
