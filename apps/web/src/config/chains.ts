
// ============ Custom Chain Definitions ============

// ============ Chain Categories ============

export type ChainCategory = 'evm' | 'bitcoin' | 'solana' | 'hub';

export interface ChainInfo {
    id: number | string;
    name: string;
    symbol: string;
    icon: string;
    category: ChainCategory;
    isTestnet: boolean;
    rpcUrl?: string;
    explorerUrl?: string;
    bridgeSupported: boolean;
    shieldSupported: boolean;
}

// All supported chains with metadata
export const supportedChains: ChainInfo[] = [
    // Hub Chain - Mainnet
    { id: 4102, name: 'Cash.io Subnet', symbol: 'CIO', icon: '💰', category: 'hub', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    // Hub Chain - Testnet
    { id: 41021, name: 'Cash.io Testnet', symbol: 'SepoliaCIO', icon: '💰', category: 'hub', isTestnet: true, bridgeSupported: true, shieldSupported: true },

    // EVM Mainnets
    { id: 1, name: 'Ethereum', symbol: 'ETH', icon: '⟠', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 137, name: 'Polygon', symbol: 'MATIC', icon: '⬡', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 42161, name: 'Arbitrum One', symbol: 'ETH', icon: '🔷', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 10, name: 'Optimism', symbol: 'ETH', icon: '🔴', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 43114, name: 'Avalanche C-Chain', symbol: 'AVAX', icon: '🔺', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 56, name: 'BNB Chain', symbol: 'BNB', icon: '💛', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 8453, name: 'Base', symbol: 'ETH', icon: '🔵', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 324, name: 'zkSync Era', symbol: 'ETH', icon: '⚡', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 59144, name: 'Linea', symbol: 'ETH', icon: '📐', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 534352, name: 'Scroll', symbol: 'ETH', icon: '📜', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 250, name: 'Fantom', symbol: 'FTM', icon: '👻', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 100, name: 'Gnosis', symbol: 'xDAI', icon: '🦉', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 42220, name: 'Celo', symbol: 'CELO', icon: '🌿', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 1101, name: 'Polygon zkEVM', symbol: 'ETH', icon: '⬢', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 5000, name: 'Mantle', symbol: 'MNT', icon: '🏔️', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 169, name: 'Manta Pacific', symbol: 'ETH', icon: '🐙', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 81457, name: 'Blast', symbol: 'ETH', icon: '💥', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 7777777, name: 'Zora', symbol: 'ETH', icon: '🌈', category: 'evm', isTestnet: false, bridgeSupported: true, shieldSupported: true },

    // EVM Testnets
    { id: 11155111, name: 'Sepolia', symbol: 'ETH', icon: '⟠', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 17000, name: 'Holesky', symbol: 'ETH', icon: '⟠', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 80002, name: 'Polygon Amoy', symbol: 'MATIC', icon: '⬡', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 421614, name: 'Arbitrum Sepolia', symbol: 'ETH', icon: '🔷', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 11155420, name: 'Optimism Sepolia', symbol: 'ETH', icon: '🔴', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 43113, name: 'Avalanche Fuji', symbol: 'AVAX', icon: '🔺', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 97, name: 'BSC Testnet', symbol: 'tBNB', icon: '💛', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 84532, name: 'Base Sepolia', symbol: 'ETH', icon: '🔵', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 300, name: 'zkSync Sepolia', symbol: 'ETH', icon: '⚡', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 59141, name: 'Linea Sepolia', symbol: 'ETH', icon: '📐', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 534351, name: 'Scroll Sepolia', symbol: 'ETH', icon: '📜', category: 'evm', isTestnet: true, bridgeSupported: true, shieldSupported: true },

    // Bitcoin Sidechains / L2s
    { id: 30, name: 'Rootstock', symbol: 'RBTC', icon: '🟠', category: 'bitcoin', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 31, name: 'Rootstock Testnet', symbol: 'tRBTC', icon: '🟠', category: 'bitcoin', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 60808, name: 'BOB', symbol: 'ETH', icon: '🅱️', category: 'bitcoin', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 111, name: 'BOB Testnet', symbol: 'ETH', icon: '🅱️', category: 'bitcoin', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 4200, name: 'Merlin Chain', symbol: 'BTC', icon: '🧙', category: 'bitcoin', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 686868, name: 'Merlin Testnet', symbol: 'BTC', icon: '🧙', category: 'bitcoin', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 200901, name: 'Bitlayer', symbol: 'BTC', icon: '⛓️', category: 'bitcoin', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 200810, name: 'Bitlayer Testnet', symbol: 'BTC', icon: '⛓️', category: 'bitcoin', isTestnet: true, bridgeSupported: true, shieldSupported: true },
    { id: 1116, name: 'Core', symbol: 'CORE', icon: '🌐', category: 'bitcoin', isTestnet: false, bridgeSupported: true, shieldSupported: true },
    { id: 1115, name: 'Core Testnet', symbol: 'tCORE', icon: '🌐', category: 'bitcoin', isTestnet: true, bridgeSupported: true, shieldSupported: true },

    // Solana
    { id: 'solana-mainnet', name: 'Solana', symbol: 'SOL', icon: '◎', category: 'solana', isTestnet: false, bridgeSupported: true, shieldSupported: false },
    { id: 'solana-devnet', name: 'Solana Devnet', symbol: 'SOL', icon: '◎', category: 'solana', isTestnet: true, bridgeSupported: true, shieldSupported: false },
    { id: 'solana-testnet', name: 'Solana Testnet', symbol: 'SOL', icon: '◎', category: 'solana', isTestnet: true, bridgeSupported: true, shieldSupported: false },
];

// Helper functions
export const getChainById = (id: number | string): ChainInfo | undefined => {
    return supportedChains.find(chain => chain.id === id);
};
