// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BridgeRegistry
 * @notice Central registry for all bridge contracts across networks
 * @dev Deployed on hub chain to track bridges on all connected chains
 */
contract BridgeRegistry is Ownable {
    // Bridge info structure
    struct BridgeInfo {
        address bridgeAddress;
        uint256 chainId;
        string chainName;
        string symbol;
        string category; // "evm", "bitcoin", "solana"
        bool isActive;
        uint256 deployedAt;
    }
    
    // Mapping from chainId to bridge info
    mapping(uint256 => BridgeInfo) public bridges;
    
    // Array of all registered chain IDs
    uint256[] public registeredChains;
    
    // Mapping from category to chain IDs
    mapping(string => uint256[]) public chainsByCategory;
    
    // Relayer configuration
    mapping(address => bool) public authorizedRelayers;
    address[] public relayerList;
    
    // Events
    event BridgeRegistered(uint256 indexed chainId, address bridgeAddress, string chainName);
    event BridgeUpdated(uint256 indexed chainId, address newBridgeAddress);
    event BridgeDeactivated(uint256 indexed chainId);
    event RelayerAuthorized(address indexed relayer);
    event RelayerRevoked(address indexed relayer);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Register a new bridge
     */
    function registerBridge(
        uint256 _chainId,
        address _bridgeAddress,
        string memory _chainName,
        string memory _symbol,
        string memory _category
    ) external onlyOwner {
        require(bridges[_chainId].bridgeAddress == address(0), "Bridge already registered");
        require(_bridgeAddress != address(0), "Invalid bridge address");
        
        bridges[_chainId] = BridgeInfo({
            bridgeAddress: _bridgeAddress,
            chainId: _chainId,
            chainName: _chainName,
            symbol: _symbol,
            category: _category,
            isActive: true,
            deployedAt: block.timestamp
        });
        
        registeredChains.push(_chainId);
        chainsByCategory[_category].push(_chainId);
        
        emit BridgeRegistered(_chainId, _bridgeAddress, _chainName);
    }
    
    /**
     * @notice Update an existing bridge address
     */
    function updateBridge(uint256 _chainId, address _newBridgeAddress) external onlyOwner {
        require(bridges[_chainId].bridgeAddress != address(0), "Bridge not registered");
        require(_newBridgeAddress != address(0), "Invalid bridge address");
        
        bridges[_chainId].bridgeAddress = _newBridgeAddress;
        
        emit BridgeUpdated(_chainId, _newBridgeAddress);
    }
    
    /**
     * @notice Deactivate a bridge
     */
    function deactivateBridge(uint256 _chainId) external onlyOwner {
        require(bridges[_chainId].bridgeAddress != address(0), "Bridge not registered");
        
        bridges[_chainId].isActive = false;
        
        emit BridgeDeactivated(_chainId);
    }
    
    /**
     * @notice Reactivate a bridge
     */
    function reactivateBridge(uint256 _chainId) external onlyOwner {
        require(bridges[_chainId].bridgeAddress != address(0), "Bridge not registered");
        
        bridges[_chainId].isActive = true;
    }
    
    /**
     * @notice Authorize a relayer
     */
    function authorizeRelayer(address _relayer) external onlyOwner {
        require(!authorizedRelayers[_relayer], "Already authorized");
        
        authorizedRelayers[_relayer] = true;
        relayerList.push(_relayer);
        
        emit RelayerAuthorized(_relayer);
    }
    
    /**
     * @notice Revoke a relayer
     */
    function revokeRelayer(address _relayer) external onlyOwner {
        require(authorizedRelayers[_relayer], "Not authorized");
        
        authorizedRelayers[_relayer] = false;
        
        emit RelayerRevoked(_relayer);
    }
    
    // View functions
    
    /**
     * @notice Get bridge info by chain ID
     */
    function getBridge(uint256 _chainId) external view returns (BridgeInfo memory) {
        return bridges[_chainId];
    }
    
    /**
     * @notice Get all registered chain IDs
     */
    function getAllChains() external view returns (uint256[] memory) {
        return registeredChains;
    }
    
    /**
     * @notice Get chains by category
     */
    function getChainsByCategory(string memory _category) external view returns (uint256[] memory) {
        return chainsByCategory[_category];
    }
    
    /**
     * @notice Get all active bridges
     */
    function getActiveBridges() external view returns (BridgeInfo[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < registeredChains.length; i++) {
            if (bridges[registeredChains[i]].isActive) {
                activeCount++;
            }
        }
        
        BridgeInfo[] memory activeBridges = new BridgeInfo[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < registeredChains.length; i++) {
            if (bridges[registeredChains[i]].isActive) {
                activeBridges[idx] = bridges[registeredChains[i]];
                idx++;
            }
        }
        
        return activeBridges;
    }
    
    /**
     * @notice Get all authorized relayers
     */
    function getRelayers() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < relayerList.length; i++) {
            if (authorizedRelayers[relayerList[i]]) {
                activeCount++;
            }
        }
        
        address[] memory activeRelayers = new address[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < relayerList.length; i++) {
            if (authorizedRelayers[relayerList[i]]) {
                activeRelayers[idx] = relayerList[i];
                idx++;
            }
        }
        
        return activeRelayers;
    }
    
    /**
     * @notice Check if a relayer is authorized
     */
    function isRelayerAuthorized(address _relayer) external view returns (bool) {
        return authorizedRelayers[_relayer];
    }
    
    /**
     * @notice Get total number of registered bridges
     */
    function getBridgeCount() external view returns (uint256) {
        return registeredChains.length;
    }
}