// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "./interfaces/IEntryPoint.sol";

/**
 * @title SimpleEntryPoint
 * @notice Minimal ERC-4337 EntryPoint implementation for testnet deployment
 * @dev Implements the core deposit/stake management and handleOps functionality.
 *      This is a simplified version for testnet use - production should use the
 *      audited eth-infinitism EntryPoint.
 */
contract SimpleEntryPoint is IEntryPoint {
    // ============ State ============

    /// @notice Deposit balances for accounts/paymasters
    mapping(address => uint112) public deposits;

    /// @notice Stake info per address
    mapping(address => StakeInfo) public stakes;

    struct StakeInfo {
        uint112 stake;
        uint32 unstakeDelaySec;
        uint48 withdrawTime; // 0 = locked, >0 = unlock requested at this time
    }

    /// @notice Nonces per sender per key
    mapping(address => mapping(uint192 => uint256)) public nonces;

    // ============ Events ============

    event Deposited(address indexed account, uint256 totalDeposit);
    event Withdrawn(address indexed account, address withdrawAddress, uint256 amount);
    event StakeLocked(address indexed account, uint256 totalStaked, uint256 unstakeDelaySec);
    event StakeUnlocked(address indexed account, uint256 withdrawTime);
    event StakeWithdrawn(address indexed account, address withdrawAddress, uint256 amount);
    event UserOperationEvent(
        bytes32 indexed userOpHash,
        address indexed sender,
        address indexed paymaster,
        uint256 nonce,
        bool success,
        uint256 actualGasCost,
        uint256 actualGasUsed
    );

    // ============ Errors ============

    error FailedOp(uint256 opIndex, string reason);
    error InsufficientDeposit();
    error StakeNotUnlocked();
    error StakeDelayTooLow();

    // ============ Core Functions ============

    /**
     * @notice Handle a batch of UserOperations
     * @dev Simplified: validates account, executes callData, handles paymaster
     */
    function handleOps(
        PackedUserOperation[] calldata ops,
        address payable beneficiary
    ) external override {
        uint256 totalGasCost = 0;

        for (uint256 i = 0; i < ops.length; i++) {
            PackedUserOperation calldata op = ops[i];
            
            // Get the userOp hash
            bytes32 userOpHash = getUserOpHash(op);

            // Increment nonce
            uint192 key = uint192(op.nonce >> 64);
            uint64 seq = uint64(op.nonce);
            if (nonces[op.sender][key] != seq) {
                revert FailedOp(i, "AA25 invalid account nonce");
            }
            nonces[op.sender][key]++;

            // Validate account
            uint256 missingFunds = 0;
            if (op.paymasterAndData.length == 0) {
                // Account pays for gas
                missingFunds = _getRequiredPrefund(op);
            }

            // If initCode is present, deploy the account
            if (op.initCode.length > 0) {
                _createAccount(op.initCode);
            }

            // Call validateUserOp on the account
            try IAccount(op.sender).validateUserOp(op, userOpHash, missingFunds) returns (uint256) {
                // Validation passed
            } catch {
                revert FailedOp(i, "AA23 reverted (or OOG)");
            }

            // Handle paymaster validation if present
            address paymaster = address(0);
            if (op.paymasterAndData.length >= 20) {
                paymaster = address(bytes20(op.paymasterAndData[:20]));
                try IPaymaster(paymaster).validatePaymasterUserOp(op, userOpHash, _getRequiredPrefund(op)) returns (bytes memory, uint256) {
                    // Paymaster validation passed
                } catch {
                    revert FailedOp(i, "AA33 reverted (or OOG)");
                }
            }

            // Execute the user operation
            bool success;
            if (op.callData.length > 0) {
                (success,) = op.sender.call(op.callData);
            } else {
                success = true;
            }

            uint256 gasCost = 21000; // Simplified gas accounting

            emit UserOperationEvent(
                userOpHash,
                op.sender,
                paymaster,
                op.nonce,
                success,
                gasCost,
                gasCost
            );

            totalGasCost += gasCost;
        }

        // Pay beneficiary
        if (totalGasCost > 0 && beneficiary != address(0)) {
            (bool sent,) = beneficiary.call{value: totalGasCost}("");
            // Ignore failure - beneficiary might not accept ETH
            sent; // silence unused variable warning
        }
    }

    // ============ Deposit Management ============

    /**
     * @notice Deposit ETH for an account
     */
    function depositTo(address account) external payable override {
        deposits[account] += uint112(msg.value);
        emit Deposited(account, deposits[account]);
    }

    /**
     * @notice Get deposit info for an account
     */
    function getDepositInfo(address account) external view override returns (DepositInfo memory info) {
        StakeInfo storage si = stakes[account];
        info.deposit = deposits[account];
        info.staked = si.stake > 0;
        info.stake = si.stake;
        info.unstakeDelaySec = si.unstakeDelaySec;
        info.withdrawTime = si.withdrawTime;
    }

    /**
     * @notice Get the nonce for a sender/key pair
     */
    function getNonce(address sender, uint192 key) external view override returns (uint256) {
        return nonces[sender][key];
    }

    // ============ Stake Management ============

    /**
     * @notice Add stake for the caller (paymaster/aggregator)
     */
    function addStake(uint32 unstakeDelaySec) external payable override {
        StakeInfo storage si = stakes[msg.sender];
        if (unstakeDelaySec < si.unstakeDelaySec) revert StakeDelayTooLow();
        si.stake += uint112(msg.value);
        si.unstakeDelaySec = unstakeDelaySec;
        si.withdrawTime = 0; // Re-lock
        emit StakeLocked(msg.sender, si.stake, unstakeDelaySec);
    }

    /**
     * @notice Start unlocking stake
     */
    function unlockStake() external override {
        StakeInfo storage si = stakes[msg.sender];
        si.withdrawTime = uint48(block.timestamp + si.unstakeDelaySec);
        emit StakeUnlocked(msg.sender, si.withdrawTime);
    }

    /**
     * @notice Withdraw unlocked stake
     */
    function withdrawStake(address payable withdrawAddress) external override {
        StakeInfo storage si = stakes[msg.sender];
        if (si.withdrawTime == 0 || block.timestamp < si.withdrawTime) revert StakeNotUnlocked();

        uint256 amount = si.stake;
        si.stake = 0;
        si.withdrawTime = 0;
        si.unstakeDelaySec = 0;

        (bool success,) = withdrawAddress.call{value: amount}("");
        require(success, "withdraw failed");
        emit StakeWithdrawn(msg.sender, withdrawAddress, amount);
    }

    // ============ Helper Functions ============

    /**
     * @notice Compute the hash of a UserOperation
     */
    function getUserOpHash(PackedUserOperation calldata op) public view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256(abi.encode(
                op.sender,
                op.nonce,
                keccak256(op.initCode),
                keccak256(op.callData),
                op.accountGasLimits,
                op.preVerificationGas,
                op.gasFees,
                keccak256(op.paymasterAndData)
            )),
            address(this),
            block.chainid
        ));
    }

    function _getRequiredPrefund(PackedUserOperation calldata op) internal pure returns (uint256) {
        // Simplified: just return a minimal amount
        uint256 verificationGasLimit = uint128(uint256(op.accountGasLimits) >> 128);
        uint256 callGasLimit = uint128(uint256(op.accountGasLimits));
        uint256 maxFeePerGas = uint128(uint256(op.gasFees));
        return (verificationGasLimit + callGasLimit + op.preVerificationGas) * maxFeePerGas;
    }

    function _createAccount(bytes calldata initCode) internal {
        address factory = address(bytes20(initCode[:20]));
        bytes memory initCallData = initCode[20:];
        (bool success,) = factory.call(initCallData);
        require(success, "account creation failed");
    }

    /**
     * @notice Allow receiving ETH
     */
    receive() external payable {
        deposits[msg.sender] += uint112(msg.value);
        emit Deposited(msg.sender, deposits[msg.sender]);
    }
}
