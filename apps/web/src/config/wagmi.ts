import { createConfig, http } from 'wagmi';
import {
    mainnet,
    sepolia,
    holesky,
    polygon,
    polygonAmoy,
    arbitrum,
    arbitrumSepolia,
    optimism,
    optimismSepolia,
    avalanche,
    avalancheFuji,
    bsc,
    bscTestnet,
    base,
    baseSepolia,
    zkSync,
    zkSyncSepoliaTestnet,
    linea,
    lineaSepolia,
    scroll,
    scrollSepolia,
    fantom,
    gnosis,
    celo,
    mantle,
    blast,
    zora,
    manta,
    polygonZkEvm,
} from 'wagmi/chains';
import { injected, metaMask, walletConnect } from 'wagmi/connectors';

// Custom Cash.io Hub Chain (Avalanche Subnet)
export const cashSubnet = {
    id: 99999,
    name: 'Cash.io Subnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Cash',
        symbol: 'CASH',
    },
    rpcUrls: {
        default: {
            http: [import.meta.env.VITE_HUB_RPC_URL || 'https://rpc.cash.io'],
        },
        public: {
            http: [import.meta.env.VITE_HUB_RPC_URL || 'https://rpc.cash.io'],
        },
    },
    blockExplorers: {
        default: { name: 'Cash Explorer', url: 'https://explorer.cash.io' },
    },
    testnet: false,
} as const;

// Bitcoin L2 / Sidechain definitions
export const rootstock = {
    id: 30,
    name: 'Rootstock',
    nativeCurrency: { decimals: 18, name: 'RSK Bitcoin', symbol: 'RBTC' },
    rpcUrls: {
        default: { http: ['https://public-node.rsk.co'] },
        public: { http: ['https://public-node.rsk.co'] },
    },
    blockExplorers: {
        default: { name: 'RSK Explorer', url: 'https://explorer.rsk.co' },
    },
    testnet: false,
} as const;

export const rootstockTestnet = {
    id: 31,
    name: 'Rootstock Testnet',
    nativeCurrency: { decimals: 18, name: 'Test RSK Bitcoin', symbol: 'tRBTC' },
    rpcUrls: {
        default: { http: ['https://public-node.testnet.rsk.co'] },
        public: { http: ['https://public-node.testnet.rsk.co'] },
    },
    blockExplorers: {
        default: { name: 'RSK Testnet Explorer', url: 'https://explorer.testnet.rsk.co' },
    },
    testnet: true,
} as const;

export const bob = {
    id: 60808,
    name: 'BOB',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: {
        default: { http: ['https://rpc.gobob.xyz'] },
        public: { http: ['https://rpc.gobob.xyz'] },
    },
    blockExplorers: {
        default: { name: 'BOB Explorer', url: 'https://explorer.gobob.xyz' },
    },
    testnet: false,
} as const;

export const bobTestnet = {
    id: 111,
    name: 'BOB Testnet',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: {
        default: { http: ['https://testnet.rpc.gobob.xyz'] },
        public: { http: ['https://testnet.rpc.gobob.xyz'] },
    },
    blockExplorers: {
        default: { name: 'BOB Testnet Explorer', url: 'https://testnet-explorer.gobob.xyz' },
    },
    testnet: true,
} as const;

export const merlin = {
    id: 4200,
    name: 'Merlin Chain',
    nativeCurrency: { decimals: 18, name: 'Bitcoin', symbol: 'BTC' },
    rpcUrls: {
        default: { http: ['https://rpc.merlinchain.io'] },
        public: { http: ['https://rpc.merlinchain.io'] },
    },
    blockExplorers: {
        default: { name: 'Merlin Explorer', url: 'https://scan.merlinchain.io' },
    },
    testnet: false,
} as const;

export const merlinTestnet = {
    id: 686868,
    name: 'Merlin Testnet',
    nativeCurrency: { decimals: 18, name: 'Bitcoin', symbol: 'BTC' },
    rpcUrls: {
        default: { http: ['https://testnet-rpc.merlinchain.io'] },
        public: { http: ['https://testnet-rpc.merlinchain.io'] },
    },
    blockExplorers: {
        default: { name: 'Merlin Testnet Explorer', url: 'https://testnet-scan.merlinchain.io' },
    },
    testnet: true,
} as const;

export const bitlayer = {
    id: 200901,
    name: 'Bitlayer',
    nativeCurrency: { decimals: 18, name: 'Bitcoin', symbol: 'BTC' },
    rpcUrls: {
        default: { http: ['https://rpc.bitlayer.org'] },
        public: { http: ['https://rpc.bitlayer.org'] },
    },
    blockExplorers: {
        default: { name: 'Bitlayer Explorer', url: 'https://scan.bitlayer.org' },
    },
    testnet: false,
} as const;

export const bitlayerTestnet = {
    id: 200810,
    name: 'Bitlayer Testnet',
    nativeCurrency: { decimals: 18, name: 'Bitcoin', symbol: 'BTC' },
    rpcUrls: {
        default: { http: ['https://testnet-rpc.bitlayer.org'] },
        public: { http: ['https://testnet-rpc.bitlayer.org'] },
    },
    blockExplorers: {
        default: { name: 'Bitlayer Testnet Explorer', url: 'https://testnet-scan.bitlayer.org' },
    },
    testnet: true,
} as const;

export const core = {
    id: 1116,
    name: 'Core',
    nativeCurrency: { decimals: 18, name: 'Core', symbol: 'CORE' },
    rpcUrls: {
        default: { http: ['https://rpc.coredao.org'] },
        public: { http: ['https://rpc.coredao.org'] },
    },
    blockExplorers: {
        default: { name: 'Core Explorer', url: 'https://scan.coredao.org' },
    },
    testnet: false,
} as const;

export const coreTestnet = {
    id: 1115,
    name: 'Core Testnet',
    nativeCurrency: { decimals: 18, name: 'Test Core', symbol: 'tCORE' },
    rpcUrls: {
        default: { http: ['https://rpc.test.btcs.network'] },
        public: { http: ['https://rpc.test.btcs.network'] },
    },
    blockExplorers: {
        default: { name: 'Core Testnet Explorer', url: 'https://scan.test.btcs.network' },
    },
    testnet: true,
} as const;

// All supported chains
export const allChains = [
    // Hub
    cashSubnet,
    // EVM Mainnets
    mainnet,
    polygon,
    arbitrum,
    optimism,
    avalanche,
    bsc,
    base,
    zkSync,
    linea,
    scroll,
    fantom,
    gnosis,
    celo,
    mantle,
    blast,
    zora,
    manta,
    polygonZkEvm,
    // EVM Testnets
    sepolia,
    holesky,
    polygonAmoy,
    arbitrumSepolia,
    optimismSepolia,
    avalancheFuji,
    bscTestnet,
    baseSepolia,
    zkSyncSepoliaTestnet,
    lineaSepolia,
    scrollSepolia,
    // Bitcoin L2s
    rootstock,
    rootstockTestnet,
    bob,
    bobTestnet,
    merlin,
    merlinTestnet,
    bitlayer,
    bitlayerTestnet,
    core,
    coreTestnet,
] as const;

// WalletConnect Project ID - REQUIRED for production
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

// Create wagmi config
export const config = createConfig({
    chains: allChains,
    connectors: [
        injected(),
        metaMask(),
        walletConnect({ projectId: walletConnectProjectId }),
    ],
    transports: {
        // Hub Chain
        [cashSubnet.id]: http(),
        // EVM Mainnets with premium RPCs for production
        [mainnet.id]: http('https://eth.llamarpc.com'),
        [polygon.id]: http('https://polygon-rpc.com'),
        [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
        [optimism.id]: http('https://mainnet.optimism.io'),
        [avalanche.id]: http('https://api.avax.network/ext/bc/C/rpc'),
        [bsc.id]: http('https://bsc-dataseed1.binance.org'),
        [base.id]: http('https://mainnet.base.org'),
        [zkSync.id]: http('https://mainnet.era.zksync.io'),
        [linea.id]: http('https://rpc.linea.build'),
        [scroll.id]: http('https://rpc.scroll.io'),
        [fantom.id]: http('https://rpc.ftm.tools'),
        [gnosis.id]: http('https://rpc.gnosischain.com'),
        [celo.id]: http('https://forno.celo.org'),
        [mantle.id]: http('https://rpc.mantle.xyz'),
        [blast.id]: http('https://rpc.blast.io'),
        [zora.id]: http('https://rpc.zora.energy'),
        [manta.id]: http('https://pacific-rpc.manta.network/http'),
        [polygonZkEvm.id]: http('https://zkevm-rpc.com'),
        // EVM Testnets
        [sepolia.id]: http('https://sepolia.drpc.org'),
        [holesky.id]: http('https://ethereum-holesky.publicnode.com'),
        [polygonAmoy.id]: http('https://rpc-amoy.polygon.technology'),
        [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
        [optimismSepolia.id]: http('https://sepolia.optimism.io'),
        [avalancheFuji.id]: http('https://api.avax-test.network/ext/bc/C/rpc'),
        [bscTestnet.id]: http('https://data-seed-prebsc-1-s1.binance.org:8545'),
        [baseSepolia.id]: http('https://sepolia.base.org'),
        [zkSyncSepoliaTestnet.id]: http('https://sepolia.era.zksync.dev'),
        [lineaSepolia.id]: http('https://rpc.sepolia.linea.build'),
        [scrollSepolia.id]: http('https://sepolia-rpc.scroll.io'),
        // Bitcoin L2s
        [rootstock.id]: http('https://public-node.rsk.co'),
        [rootstockTestnet.id]: http('https://public-node.testnet.rsk.co'),
        [bob.id]: http('https://rpc.gobob.xyz'),
        [bobTestnet.id]: http('https://testnet.rpc.gobob.xyz'),
        [merlin.id]: http('https://rpc.merlinchain.io'),
        [merlinTestnet.id]: http('https://testnet-rpc.merlinchain.io'),
        [bitlayer.id]: http('https://rpc.bitlayer.org'),
        [bitlayerTestnet.id]: http('https://testnet-rpc.bitlayer.org'),
        [core.id]: http('https://rpc.coredao.org'),
        [coreTestnet.id]: http('https://rpc.test.btcs.network'),
    },
});

// Contract addresses per chain (from environment)
export const contractAddresses: Record<number, {
    shieldedPool?: string;
    zkVerifier?: string;
    commitmentTree?: string;
    accountFactory?: string;
    paymaster?: string;
    entryPoint?: string;
    bridge?: string;
}> = {
    // Hub Chain (Cash.io Subnet) - Full protocol
    [cashSubnet.id]: {
        shieldedPool: import.meta.env.VITE_SHIELDED_POOL_ADDRESS,
        zkVerifier: import.meta.env.VITE_ZK_VERIFIER_ADDRESS,
        commitmentTree: import.meta.env.VITE_COMMITMENT_TREE_ADDRESS,
        accountFactory: import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS,
        paymaster: import.meta.env.VITE_PAYMASTER_ADDRESS,
        entryPoint: import.meta.env.VITE_ENTRY_POINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    },
    // EVM Mainnets - Bridge only
    [mainnet.id]: { bridge: import.meta.env.VITE_ETH_BRIDGE_ADDRESS },
    [polygon.id]: { bridge: import.meta.env.VITE_POLYGON_BRIDGE_ADDRESS },
    [arbitrum.id]: { bridge: import.meta.env.VITE_ARBITRUM_BRIDGE_ADDRESS },
    [optimism.id]: { bridge: import.meta.env.VITE_OPTIMISM_BRIDGE_ADDRESS },
    [avalanche.id]: { bridge: import.meta.env.VITE_AVALANCHE_BRIDGE_ADDRESS },
    [bsc.id]: { bridge: import.meta.env.VITE_BSC_BRIDGE_ADDRESS },
    [base.id]: { bridge: import.meta.env.VITE_BASE_BRIDGE_ADDRESS },
    [zkSync.id]: { bridge: import.meta.env.VITE_ZKSYNC_BRIDGE_ADDRESS },
    [linea.id]: { bridge: import.meta.env.VITE_LINEA_BRIDGE_ADDRESS },
    [scroll.id]: { bridge: import.meta.env.VITE_SCROLL_BRIDGE_ADDRESS },
    [blast.id]: { bridge: import.meta.env.VITE_BLAST_BRIDGE_ADDRESS },
    [mantle.id]: { bridge: import.meta.env.VITE_MANTLE_BRIDGE_ADDRESS },
    // EVM Testnets
    [sepolia.id]: { bridge: import.meta.env.VITE_SEPOLIA_BRIDGE_ADDRESS },
    [arbitrumSepolia.id]: { bridge: import.meta.env.VITE_ARBITRUM_SEPOLIA_BRIDGE_ADDRESS },
    [optimismSepolia.id]: { bridge: import.meta.env.VITE_OPTIMISM_SEPOLIA_BRIDGE_ADDRESS },
    [baseSepolia.id]: { bridge: import.meta.env.VITE_BASE_SEPOLIA_BRIDGE_ADDRESS },
    // Bitcoin L2s
    [rootstock.id]: { bridge: import.meta.env.VITE_ROOTSTOCK_BRIDGE_ADDRESS },
    [rootstockTestnet.id]: { bridge: import.meta.env.VITE_ROOTSTOCK_TESTNET_BRIDGE_ADDRESS },
    [bob.id]: { bridge: import.meta.env.VITE_BOB_BRIDGE_ADDRESS },
    [merlin.id]: { bridge: import.meta.env.VITE_MERLIN_BRIDGE_ADDRESS },
    [bitlayer.id]: { bridge: import.meta.env.VITE_BITLAYER_BRIDGE_ADDRESS },
    [core.id]: { bridge: import.meta.env.VITE_CORE_BRIDGE_ADDRESS },
};

// Helper to get contracts for current chain
export function getContractsForChain(chainId: number) {
    return contractAddresses[chainId] || {};
}

// Check if bridge is deployed on chain
export function isBridgeDeployed(chainId: number): boolean {
    const contracts = getContractsForChain(chainId);
    return !!contracts.bridge && contracts.bridge !== '0x...';
}

// Get all chains with deployed bridges
export function getChainsWithBridge(): number[] {
    return Object.entries(contractAddresses)
        .filter(([_, contracts]) => contracts.bridge && contracts.bridge !== '0x...')
        .map(([chainId]) => parseInt(chainId));
}
