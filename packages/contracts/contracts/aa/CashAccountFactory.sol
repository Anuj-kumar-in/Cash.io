// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IEntryPoint.sol";
import "./CashAccount.sol";

/**
 * @title CashAccountFactory
 * @notice Factory for deploying CashAccount smart accounts
 * @dev Uses EIP-1167 minimal proxies for gas-efficient deployment
 */
contract CashAccountFactory is Ownable {
    // ============ State Variables ============
    
    /// @notice The CashAccount implementation
    CashAccount public immutable accountImplementation;
    
    /// @notice The EntryPoint contract
    IEntryPoint public immutable entryPoint;
    
    /// @notice Mapping of owner to deployed accounts
    mapping(address => address[]) public userAccounts;
    
    /// @notice Total accounts created
    uint256 public totalAccounts;
    
    // ============ Events ============
    
    event AccountCreated(
        address indexed account,
        address indexed owner,
        uint256 indexed salt
    );
    
    // ============ Constructor ============
    
    constructor(IEntryPoint _entryPoint) Ownable(msg.sender) {
        entryPoint = _entryPoint;
        accountImplementation = new CashAccount(_entryPoint);
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Create a new CashAccount
     * @param owner The account owner
     * @param guardians Guardian addresses for recovery
     * @param threshold Required guardian approvals
     * @param spendLimit Daily spending limit
     * @param salt Salt for deterministic address
     * @return account The deployed account address
     */
    function createAccount(
        address owner,
        address[] calldata guardians,
        uint256 threshold,
        uint256 spendLimit,
        uint256 salt
    ) external returns (CashAccount account) {
        // Compute deterministic address
        address addr = getAddress(owner, guardians, threshold, spendLimit, salt);
        
        // Check if already deployed
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return CashAccount(payable(addr));
        }
        
        // Deploy using CREATE2
        bytes32 saltBytes = keccak256(abi.encode(owner, guardians, threshold, salt));
        account = CashAccount(payable(Clones.cloneDeterministic(
            address(accountImplementation),
            saltBytes
        )));
        
        // Initialize
        account.initialize(owner, guardians, threshold, spendLimit);
        
        // Track
        userAccounts[owner].push(address(account));
        totalAccounts++;
        
        emit AccountCreated(address(account), owner, salt);
        
        return account;
    }
    
    /**
     * @notice Compute the counterfactual address of an account
     * @param owner The account owner
     * @param guardians Guardian addresses
     * @param threshold Recovery threshold
     * @param spendLimit Daily spend limit (not used in address computation)
     * @param salt Salt for address
     * @return The account address
     */
    function getAddress(
        address owner,
        address[] calldata guardians,
        uint256 threshold,
        uint256 spendLimit,
        uint256 salt
    ) public view returns (address) {
        // spendLimit not used in address computation for predictability
        (spendLimit);
        bytes32 saltBytes = keccak256(abi.encode(owner, guardians, threshold, salt));
        return Clones.predictDeterministicAddress(
            address(accountImplementation),
            saltBytes
        );
    }
    
    /**
     * @notice Get all accounts for a user
     * @param owner The user address
     */
    function getAccountsForUser(address owner) external view returns (address[] memory) {
        return userAccounts[owner];
    }
    
    /**
     * @notice Add stake to EntryPoint for paymaster
     */
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }
}
