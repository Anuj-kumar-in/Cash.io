/**
 * Chain Configurations for Cash.io
 * Supports EVM chains, Bitcoin sidechains (Rootstock), and Solana
 */

import { defineChain } from 'viem';

// ============ Custom Chain Definitions ============

// Cash.io Hub Subnet (Avalanche L1)
export const cashSubnet = defineChain({
    id: 4102,
    name: 'Cash.io Subnet',
    nativeCurrency: { name: 'CIO Token', symbol: 'CIO', decimals: 18 },
    rpcUrls: {
        default: { http: ['http://127.0.0.1:9654/ext/bc/weCGw5ozNbEzW1CSvyJ15g1ZnLzcpjxKHjhbV1EVMQQKKa2CM/rpc'] },
    },
    blockExplorers: {
        default: { name: 'Cash Explorer', url: 'https://explorer.cash.io' },
    },
});

// ============ Rootstock (Bitcoin Sidechain) ============

export const rootstock = defineChain({
    id: 30,
    name: 'Rootstock',
    nativeCurrency: { name: 'Smart Bitcoin', symbol: 'RBTC', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://public-node.rsk.co'] },
    },
    blockExplorers: {
        default: { name: 'RSK Explorer', url: 'https://explorer.rsk.co' },
    },
});

export const rootstockTestnet = defineChain({
    id: 31,
    name: 'Rootstock Testnet',
    nativeCurrency: { name: 'Test Smart Bitcoin', symbol: 'tRBTC', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://public-node.testnet.rsk.co'] },
    },
    blockExplorers: {
        default: { name: 'RSK Testnet Explorer', url: 'https://explorer.testnet.rsk.co' },
    },
    testnet: true,
});

// ============ BOB (Build on Bitcoin) ============

export const bob = defineChain({
    id: 60808,
    name: 'BOB',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.gobob.xyz'] },
    },
    blockExplorers: {
        default: { name: 'BOB Explorer', url: 'https://explorer.gobob.xyz' },
    },
});

export const bobTestnet = defineChain({
    id: 111,
    name: 'BOB Testnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://testnet.rpc.gobob.xyz'] },
    },
    blockExplorers: {
        default: { name: 'BOB Testnet Explorer', url: 'https://testnet-explorer.gobob.xyz' },
    },
    testnet: true,
});

// ============ Merlin Chain (Bitcoin L2) ============

export const merlin = defineChain({
    id: 4200,
    name: 'Merlin Chain',
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.merlinchain.io'] },
    },
    blockExplorers: {
        default: { name: 'Merlin Explorer', url: 'https://scan.merlinchain.io' },
    },
});

export const merlinTestnet = defineChain({
    id: 686868,
    name: 'Merlin Testnet',
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://testnet-rpc.merlinchain.io'] },
    },
    blockExplorers: {
        default: { name: 'Merlin Testnet Explorer', url: 'https://testnet-scan.merlinchain.io' },
    },
    testnet: true,
});

// ============ Bitlayer (Bitcoin L2) ============

export const bitlayer = defineChain({
    id: 200901,
    name: 'Bitlayer',
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.bitlayer.org'] },
    },
    blockExplorers: {
        default: { name: 'Bitlayer Explorer', url: 'https://www.btrscan.com' },
    },
});

export const bitlayerTestnet = defineChain({
    id: 200810,
    name: 'Bitlayer Testnet',
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://testnet-rpc.bitlayer.org'] },
    },
    blockExplorers: {
        default: { name: 'Bitlayer Testnet Explorer', url: 'https://testnet.btrscan.com' },
    },
    testnet: true,
});

// ============ Core (Bitcoin-powered) ============

export const core = defineChain({
    id: 1116,
    name: 'Core',
    nativeCurrency: { name: 'CORE', symbol: 'CORE', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.coredao.org'] },
    },
    blockExplorers: {
        default: { name: 'Core Explorer', url: 'https://scan.coredao.org' },
    },
});

export const coreTestnet = defineChain({
    id: 1115,
    name: 'Core Testnet',
    nativeCurrency: { name: 'tCORE', symbol: 'tCORE', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.test.btcs.network'] },
    },
    blockExplorers: {
        default: { name: 'Core Testnet Explorer', url: 'https://scan.test.btcs.network' },
    },
    testnet: true,
});

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

export const getChainsByCategory = (category: ChainCategory): ChainInfo[] => {
    return supportedChains.filter(chain => chain.category === category);
};

export const getMainnets = (): ChainInfo[] => {
    return supportedChains.filter(chain => !chain.isTestnet);
};

export const getTestnets = (): ChainInfo[] => {
    return supportedChains.filter(chain => chain.isTestnet);
};

export const getEVMChains = (): ChainInfo[] => {
    return supportedChains.filter(chain => chain.category === 'evm' || chain.category === 'bitcoin' || chain.category === 'hub');
};

export const getBitcoinChains = (): ChainInfo[] => {
    return supportedChains.filter(chain => chain.category === 'bitcoin');
};

export const getSolanaChains = (): ChainInfo[] => {
    return supportedChains.filter(chain => chain.category === 'solana');
};

export const getChainsByNetworkMode = (isTestnet: boolean): ChainInfo[] => {
    return supportedChains.filter(chain => chain.isTestnet === isTestnet);
};

export const getChainsByCategoryAndMode = (category: ChainCategory, isTestnet: boolean): ChainInfo[] => {
    return supportedChains.filter(chain => chain.category === category && chain.isTestnet === isTestnet);
};
