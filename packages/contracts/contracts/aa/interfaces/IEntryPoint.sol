// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

/**
 * @dev UserOperation struct as defined in EIP-4337
 * This struct represents a user operation that is submitted to the bundler
 */
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

/**
 * @title IEntryPoint
 * @dev Interface for the ERC-4337 EntryPoint contract
 */
interface IEntryPoint {
    /**
     * @dev Execute a batch of UserOperations
     * @param ops The operations to execute
     * @param beneficiary The address to receive the fees
     */
    function handleOps(
        PackedUserOperation[] calldata ops,
        address payable beneficiary
    ) external;

    /**
     * @dev Get the deposit info for an account
     * @param account The account to query
     * @return info The deposit info
     */
    function getDepositInfo(address account) external view returns (DepositInfo memory info);

    /**
     * @dev Get the nonce for an account/key pair
     * @param sender The sender address
     * @param key The nonce key
     * @return nonce The current nonce
     */
    function getNonce(address sender, uint192 key) external view returns (uint256 nonce);

    /**
     * @dev Add stake to the entry point (for paymasters)
     * @param unstakeDelaySec The delay in seconds before stake can be withdrawn
     */
    function addStake(uint32 unstakeDelaySec) external payable;

    /**
     * @dev Unlock stake (starts the unstake delay)
     */
    function unlockStake() external;

    /**
     * @dev Withdraw stake after delay
     * @param withdrawAddress The address to send the stake to
     */
    function withdrawStake(address payable withdrawAddress) external;

    /**
     * @dev Deposit to the entry point account
     * @param account The account to deposit to
     */
    function depositTo(address account) external payable;
}

/**
 * @dev Deposit info structure
 */
struct DepositInfo {
    uint112 deposit;
    bool staked;
    uint112 stake;
    uint32 unstakeDelaySec;
    uint48 withdrawTime;
}

/**
 * @title IAccount
 * @dev Interface for ERC-4337 smart accounts
 */
interface IAccount {
    /**
     * @dev Validate a user operation
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param missingAccountFunds The amount of funds missing
     * @return validationData Packed validation data
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

/**
 * @title IPaymaster
 * @dev Interface for ERC-4337 paymasters
 */
interface IPaymaster {
    /**
     * @dev Validate a paymaster user operation
     * @param userOp The user operation
     * @param userOpHash The hash of the user operation
     * @param maxCost The maximum cost of the operation
     * @return context Context for postOp
     * @return validationData Packed validation data
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    /**
     * @dev Post-operation handler
     * @param mode The mode of the operation
     * @param context The context from validatePaymasterUserOp
     * @param actualGasCost The actual gas cost
     * @param actualUserOpFeePerGas The actual user op fee per gas
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external;
}

/**
 * @dev Post-operation modes
 */
enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}

/**
 * @title IAccountExecute
 * @dev Optional interface for accounts that want to handle ops directly
 */
interface IAccountExecute {
    /**
     * @dev Execute a user operation
     * @param userOp The user operation
     * @param userOpHash The hash of the user operation
     */
    function executeUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external;
}
