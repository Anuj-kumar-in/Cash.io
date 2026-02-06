// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title IZKVerifier
 * @notice Interface for ZK proof verification
 * @dev Can be implemented as a contract or point to a precompile
 */
interface IZKVerifier {
    /**
     * @notice Verify a ZK proof
     * @param _proof The proof data
     * @param _publicInputs The public inputs to the proof
     * @return True if the proof is valid
     */
    function verifyProof(
        bytes calldata _proof,
        bytes calldata _publicInputs
    ) external view returns (bool);
    
    /**
     * @notice Verify a Groth16 proof with specific inputs
     * @param _pA Point A of the proof
     * @param _pB Point B of the proof
     * @param _pC Point C of the proof
     * @param _publicSignals Array of public signals
     * @return True if the proof is valid
     */
    function verifyGroth16(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[] calldata _publicSignals
    ) external view returns (bool);
}
