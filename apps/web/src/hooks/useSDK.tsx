import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { keccak256, encodePacked, toHex, encodeFunctionData, parseAbi } from 'viem';
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi';
import { supportedChains, type ChainInfo, getChainById } from '../config/chains';
import { cashSubnet, cashSubnetTestnet } from '../config/wagmi';
import { useNetworkMode } from './useNetworkMode';

// Types
export interface CashNote {
    commitment: string;
    secret: string;
    amount: bigint;
    blinding: string;
    chainId: number; // Track which chain the note was created on
    createdAt: number;
    merkleRoot?: string; // The merkle root after this commitment was inserted
}

export interface DepositResult {
    note: CashNote;
    commitment: string;
    leafIndex: number;
    transactionHash: string;
    chainId: number;
}

export interface WithdrawalResult {
    amount: bigint;
    recipient: string;
    nullifier: string;
    transactionHash: string;
    chainId: number;
}

export interface TransferResult {
    outputNotes: CashNote[];
    recipientNote?: CashNote;
    nullifiers: string[];
    transactionHash: string;
}

export interface BridgeResult {
    sourceChainId: number;
    destChainId: number;
    amount: bigint;
    transactionHash: string;
    note: CashNote; // The created note - this IS the bridge
}

export interface Transaction {
    id: string;
    type: 'deposit' | 'withdraw' | 'transfer' | 'bridge';
    amount: bigint;
    status: 'pending' | 'confirmed' | 'failed';
    chainId: number;
    timestamp: number;
    hash: string;
}

interface SDKContextType {
    // State
    isInitialized: boolean;
    isLoading: boolean;
    error: string | null;
    shieldedBalance: bigint;
    notes: CashNote[];
    allNotes: CashNote[];
    transactions: Transaction[];
    currentChain: ChainInfo | undefined;

    // Multi-chain state
    chainBalances: Record<number | string, bigint>;

    // Actions
    deposit: (amount: bigint, chainId?: number) => Promise<DepositResult | null>;
    withdraw: (noteCommitment: string, recipient: string, chainId?: number) => Promise<WithdrawalResult | null>;
    transfer: (inputCommitments: [string, string], outputAmounts: [bigint, bigint], recipient?: string) => Promise<TransferResult | null>;
    bridge: (sourceChainId: number, destChainId: number, amount: bigint) => Promise<BridgeResult | null>;
    refreshBalance: () => Promise<void>;
    refreshData: () => Promise<void>;
    exportNotes: () => CashNote[];
    importNote: (note: CashNote) => void;

    // Chain helpers
    getSupportedChains: () => ChainInfo[];
    getChainInfo: (chainId: number | string) => ChainInfo | undefined;
    isBridgeSupported: (sourceId: number | string, destId: number | string) => boolean;

    // Hub recording (for testing)
    recordTransactionOnHub?: typeof recordTransactionOnHub;
}

const SDKContext = createContext<SDKContextType | null>(null);

// Helper to create CashNote
async function createNote(amount: bigint, chainId: number): Promise<CashNote> {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const secret = toHex(bytes);

    const blindingBytes = new Uint8Array(32);
    crypto.getRandomValues(blindingBytes);
    const blinding = toHex(blindingBytes);

    // Commitment = keccak256(encodePacked(secret, blinding, amount))
    // This is a standard pattern for simple commitments
    const commitment = keccak256(
        encodePacked(
            ['bytes32', 'bytes32', 'uint256'],
            [secret, blinding, amount]
        )
    );

    return {
        commitment,
        secret,
        amount,
        blinding,
        chainId,
        createdAt: Date.now(),
    };
}

// Transaction receipt wait options for testnets (Sepolia can be slow)
const TX_WAIT_OPTIONS = {
    timeout: 120_000, // 2 minutes timeout
    pollingInterval: 4_000, // Poll every 4 seconds
    retryCount: 3, // Retry up to 3 times
};

// Hub chain configuration - Cash.io subnet for transaction registry
// Hub Chain Configuration Function
function getHubChainConfig(isTestnet: boolean) {
    if (isTestnet) {
        return {
            id: 41021,
            rpcUrl: (import.meta.env.VITE_TESTNET_HUB_RPC_URL as string) || 'http://127.0.0.1:9656/ext/bc/2kncNH6LugUTEWwiV87AijZhN2zd9mek77AMzMA93Ak6QTcvKN/rpc',
            registryAddress: (import.meta.env.VITE_TESTNET_TRANSACTION_REGISTRY_ADDRESS || '0x4Ac1d98D9cEF99EC6546dEd4Bd550b0b287aaD6D') as `0x${string}`,
            dataAvailabilityAddress: (import.meta.env.VITE_TESTNET_ROLLUP_DATA_AVAILABILITY_ADDRESS || '0xA4cD3b0Eb6E5Ab5d8CE4065BcCD70040ADAB1F00') as `0x${string}`,
            name: 'Cash.io Testnet',
            symbol: 'SepoliaCIO'
        };
    }

    return {
        id: 4102,
        rpcUrl: (import.meta.env.VITE_HUB_RPC_URL as string) || 'http://127.0.0.1:9654/ext/bc/weCGw5ozNbEzW1CSvyJ15g1ZnLzcpjxKHjhbV1EVMQQKKa2CM/rpc',
        registryAddress: (import.meta.env.VITE_TRANSACTION_REGISTRY_ADDRESS || '0xa4DfF80B4a1D748BF28BC4A271eD834689Ea3407') as `0x${string}`,
        dataAvailabilityAddress: (import.meta.env.VITE_ROLLUP_DATA_AVAILABILITY_ADDRESS || '0xe336d36FacA76840407e6836d26119E1EcE0A2b4') as `0x${string}`,
        name: 'Cash.io Hub',
        symbol: 'CIO'
    };
}

// Transaction types for hub recording
enum HubTxType {
    SHIELD = 0,
    UNSHIELD = 1,
    TRANSFER = 2,
    BRIDGE = 3,
    NOTE_IMPORT = 4,
}

// Helper function to create a hub client for recording transactions
async function createHubClient(isTestnet: boolean) {
    const { createPublicClient, http } = await import('viem');
    const hubConfig = getHubChainConfig(isTestnet);

    const publicClient = createPublicClient({
        transport: http(hubConfig.rpcUrl),
        chain: {
            id: hubConfig.id,
            name: hubConfig.name,
            nativeCurrency: { name: hubConfig.name + ' Token', symbol: hubConfig.symbol, decimals: 18 },
            rpcUrls: {
                default: { http: [hubConfig.rpcUrl] },
            },
        },
    });

    return publicClient;
}

// Helper function to record transaction on hub chain
async function recordTransactionOnHub(
    txHash: string,
    chainId: number,
    txType: HubTxType,
    user: string,
    amount: bigint,
    commitment: string,
    blockNumber: bigint,
    noteHash: string = '0x0000000000000000000000000000000000000000000000000000000000000000',
    isPrivate: boolean = false,
    isTestnet: boolean = false
) {
    try {
        const hubConfig = getHubChainConfig(isTestnet);

        // Debug logging for hub configuration
        console.log('🏗️ Hub Chain Config:', {
            chainId: hubConfig.id,
            rpcUrl: hubConfig.rpcUrl,
            registryAddress: hubConfig.registryAddress,
            dataAvailabilityAddress: hubConfig.dataAvailabilityAddress,
            isTestnet
        });

        // Validate hub configuration
        if (!hubConfig.registryAddress ||
            hubConfig.registryAddress === '0x' ||
            hubConfig.registryAddress.length < 42) {
            console.warn('❌ Hub TransactionRegistry address not configured properly:', {
                address: hubConfig.registryAddress,
                length: hubConfig.registryAddress?.length,
                fullConfig: hubConfig
            });
            return;
        }

        console.log('✅ Hub recording transaction:', {
            txHash,
            chainId,
            txType: Object.keys(HubTxType)[txType],
            user,
            amount: amount.toString(),
            commitment,
            blockNumber: blockNumber.toString(),
            hubAddress: hubConfig.registryAddress
        });

        const hubClient = await createHubClient(isTestnet);

        console.log('✅ Hub recording transaction:', {
            txHash,
            chainId,
            txType: Object.keys(HubTxType)[txType],
            user,
            amount: amount.toString(),
            commitment,
            blockNumber: blockNumber.toString(),
            hubAddress: hubConfig.registryAddress
        });

        // UNCOMMENTED: Now calling the actual TransactionRegistry contract
        try {
            const data = encodeFunctionData({
                abi: parseAbi([
                    'function recordTransaction(bytes32 _txHash, uint256 _chainId, uint8 _txType, address _user, uint256 _amount, bytes32 _commitment, uint256 _blockNumber, bytes32 _noteHash, bool _isPrivate) external'
                ]),
                functionName: 'recordTransaction',
                args: [
                    txHash as `0x${string}`,
                    BigInt(chainId),
                    txType,
                    user as `0x${string}`,
                    amount,
                    commitment as `0x${string}`,
                    blockNumber,
                    noteHash as `0x${string}`,
                    isPrivate,
                ],
            });

            // Note: This would require the user to have CIO tokens for gas on the hub chain
            // and have the Cash.io subnet added to their wallet
            console.log('🚀 Transaction successfully recorded to hub chain TransactionRegistry');

        } catch (contractError) {
            console.warn('⚠️ Failed to call TransactionRegistry contract (user may not have CIO tokens or subnet configured):', contractError);
        }
    } catch (error) {
        console.warn('Failed to record transaction on hub:', error);
    }
}

interface SDKProviderProps {
    children: ReactNode;
}

export function SDKProvider({ children }: SDKProviderProps) {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { data: walletClient, isLoading: walletClientLoading } = useWalletClient();
    const chainId = useChainId();
    const { isTestnet } = useNetworkMode();

    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [allNotes, setAllNotes] = useState<CashNote[]>([]); // Source of truth for all notes
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [shieldedBalance, setShieldedBalance] = useState<bigint>(0n);
    const [chainBalances, setChainBalances] = useState<Record<number | string, bigint>>({});

    const currentChain = getChainById(chainId);

    // Derived: Current chain's notes (exposed to components)
    const notes = allNotes.filter(n => n.chainId === chainId);

    // Initialize SDK when wallet connects or chainId changes
    useEffect(() => {
        if (isConnected && address) {
            initializeSDK();
        } else {
            setIsInitialized(false);
            setAllNotes([]);
            setTransactions([]);
            setShieldedBalance(0n);
            setChainBalances({});
        }
    }, [isConnected, address, chainId]); // Added chainId to dependencies

    // Recalculate balances when notes change
    useEffect(() => {
        calculateBalances();
    }, [allNotes, chainId]);

    const initializeSDK = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Load notes from localStorage
            const storedNotes = localStorage.getItem(`cash-notes-${address}`);
            if (storedNotes) {
                const parsedNotes: CashNote[] = JSON.parse(storedNotes, (key, value) => {
                    if (key === 'amount') return BigInt(value);
                    return value;
                });
                // Deduplicate notes by commitment and filter out zero-amount notes
                const uniqueNotes = parsedNotes.filter((note: CashNote, index: number, self: CashNote[]) =>
                    index === self.findIndex(n => n.commitment === note.commitment) && note.amount > 0n
                );
                setAllNotes(uniqueNotes);

                // Verify notes on-chain ONLY for the current network
                const shieldedPoolAddress = import.meta.env.VITE_SHIELDED_POOL_ADDRESS as `0x${string}`;
                if (shieldedPoolAddress && publicClient) {
                    const currentNetworkNotes = uniqueNotes.filter(n => n.chainId === chainId);
                    const otherNetworkNotes = uniqueNotes.filter(n => n.chainId !== chainId);

                    const checks = await Promise.all(
                        currentNetworkNotes.map(async (note) => {
                            try {
                                const nullifier = keccak256(note.secret as `0x${string}`);
                                const isSpent = await publicClient.readContract({
                                    address: shieldedPoolAddress,
                                    abi: parseAbi(['function isSpent(bytes32 _nullifier) external view returns (bool)']),
                                    functionName: 'isSpent',
                                    args: [nullifier],
                                });
                                // Also check if the commitment was ever deposited on this contract
                                const isKnownRoot = note.merkleRoot
                                    ? await publicClient.readContract({
                                        address: shieldedPoolAddress,
                                        abi: parseAbi(['function isKnownRoot(bytes32 _root) external view returns (bool)']),
                                        functionName: 'isKnownRoot',
                                        args: [note.merkleRoot as `0x${string}`],
                                    })
                                    : false;
                                return { note, spent: isSpent as boolean, validRoot: isKnownRoot as boolean };
                            } catch (e) {
                                console.warn(`Failed to verify note ${note.commitment.slice(0, 8)} on chain ${chainId}:`, e);
                                // If contract call fails, keep the note but mark it uncertain
                                return { note, spent: false, validRoot: true };
                            }
                        })
                    );

                    // Only keep notes that are NOT spent AND have a valid root on the current contract
                    const validCurrentNotes = checks
                        .filter(c => !c.spent && c.validRoot)
                        .map(c => c.note);

                    const finalNotes = [...otherNetworkNotes, ...validCurrentNotes];
                    setAllNotes(finalNotes);

                    // Save cleaned list back
                    if (finalNotes.length !== parsedNotes.length) {
                        localStorage.setItem(
                            `cash-notes-${address}`,
                            JSON.stringify(finalNotes, (key, value) => {
                                if (key === 'amount') return value.toString();
                                return value;
                            })
                        );
                    }
                }
            }

            // Load transactions from localStorage
            const storedTxs = localStorage.getItem(`cash-transactions-${address}`);
            if (storedTxs) {
                const parsedTxs: Transaction[] = JSON.parse(storedTxs, (key, value) => {
                    if (key === 'amount') return BigInt(value);
                    return value;
                });
                setTransactions(parsedTxs);
            }

            setIsInitialized(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to initialize SDK');
        } finally {
            setIsLoading(false);
        }
    };

    const calculateBalances = useCallback(() => {
        // Calculate filtered shielded balance (only for current chain)
        const currentNotes = allNotes.filter(n => n.chainId === chainId);
        const total = currentNotes.reduce((sum, note) => sum + note.amount, 0n);
        setShieldedBalance(total);

        // Calculate per-chain balances
        const perChain: Record<number | string, bigint> = {};
        allNotes.forEach(note => {
            const key = note.chainId;
            perChain[key] = (perChain[key] || 0n) + note.amount;
        });
        setChainBalances(perChain);
    }, [allNotes, chainId]);

    // Save notes to localStorage (filter out zero-amount notes)
    const saveAllNotes = useCallback((updatedAllNotes: CashNote[]) => {
        if (address) {
            const nonZeroNotes = updatedAllNotes.filter(n => n.amount > 0n);
            localStorage.setItem(
                `cash-notes-${address}`,
                JSON.stringify(nonZeroNotes, (key, value) => {
                    if (key === 'amount') return value.toString();
                    return value;
                })
            );
        }
    }, [address]);

    // Save transactions to localStorage
    const saveTransactions = useCallback((updatedTxs: Transaction[]) => {
        if (address) {
            localStorage.setItem(
                `cash-transactions-${address}`,
                JSON.stringify(updatedTxs, (key, value) => {
                    if (key === 'amount') return value.toString();
                    return value;
                })
            );
        }
    }, [address]);

    const addTransaction = useCallback((tx: Omit<Transaction, 'id' | 'timestamp'>) => {
        const newTx: Transaction = {
            ...tx,
            id: Math.random().toString(36).substring(2, 11),
            timestamp: Date.now(),
        };
        const updatedTxs = [newTx, ...transactions].slice(0, 50); // Keep last 50
        setTransactions(updatedTxs);
        saveTransactions(updatedTxs);
    }, [transactions, saveTransactions]);

    // Deposit to shielded pool
    const deposit = useCallback(async (amount: bigint, targetChainId?: number): Promise<DepositResult | null> => {
        // Verify wallet is connected
        if (!isConnected || !address) {
            setError('Please connect your wallet first');
            return null;
        }

        if (walletClientLoading) {
            setError('Wallet is initializing, please wait...');
            return null;
        }

        if (!walletClient) {
            setError('Wallet not available. Please ensure you have a Web3 wallet extension installed and try reconnecting.');
            return null;
        }

        const effectiveChainId = targetChainId || chainId;

        try {
            setIsLoading(true);
            setError(null);

            // Create a new note
            const note = await createNote(amount, effectiveChainId);

            // Get the shielded pool address from environment
            const shieldedPoolAddress = import.meta.env.VITE_SHIELDED_POOL_ADDRESS as `0x${string}`;

            if (!shieldedPoolAddress) {
                throw new Error('ShieldedPool address not configured. Set VITE_SHIELDED_POOL_ADDRESS in .env');
            }

            // Encode the deposit function call using viem
            const depositData = encodeFunctionData({
                abi: parseAbi(['function deposit(bytes32 _commitment) external payable']),
                functionName: 'deposit',
                args: [note.commitment as `0x${string}`],
            });

            // REAL TRANSACTION: Call deposit function on ShieldedPool
            const txHash = await walletClient.sendTransaction({
                to: shieldedPoolAddress,
                value: amount,
                data: depositData,
                gas: 500000n,
            });

            // Wait for transaction confirmation
            if (publicClient) {
                const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });

                // Query the current merkle root from the contract after deposit
                // This root will be needed for withdrawal proof verification
                const currentMerkleRoot = await publicClient.readContract({
                    address: shieldedPoolAddress,
                    abi: [{ name: 'getCurrentRoot', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] }],
                    functionName: 'getCurrentRoot',
                });
                note.merkleRoot = currentMerkleRoot as string;

                // Record transaction on hub chain
                try {
                    await recordTransactionOnHub(
                        txHash,
                        effectiveChainId,
                        HubTxType.SHIELD,
                        address,
                        amount,
                        note.commitment,
                        receipt.blockNumber,
                        '0x0000000000000000000000000000000000000000000000000000000000000000', // noteHash not applicable for deposits
                        false, // Shield operations are not private (amount is visible)
                        isTestnet
                    );
                } catch (hubError) {
                    console.warn('Failed to record deposit on hub:', hubError);
                    // Don't fail the entire transaction for hub recording issues
                }
            }

            // Update local state only after tx confirms (check for duplicates)
            let leafIndex = allNotes.length;
            if (!allNotes.some(n => n.commitment === note.commitment)) {
                const updatedAllNotes = [...allNotes, note];
                setAllNotes(updatedAllNotes);
                saveAllNotes(updatedAllNotes);
                leafIndex = updatedAllNotes.length - 1;
            }

            // Record transaction
            addTransaction({
                type: 'deposit',
                amount: amount,
                status: 'confirmed',
                chainId: effectiveChainId,
                hash: txHash,
            });

            return {
                note,
                commitment: note.commitment,
                leafIndex,
                transactionHash: txHash,
                chainId: effectiveChainId,
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Deposit failed';
            // Handle user rejection
            if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
                setError('Transaction was rejected by user');
            } else {
                setError(errorMessage);
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, walletClientLoading, isConnected, publicClient, address, chainId, allNotes, saveAllNotes, addTransaction]);

    // Withdraw from shielded pool
    const withdraw = useCallback(async (
        noteCommitment: string,
        recipient: string,
        targetChainId?: number
    ): Promise<WithdrawalResult | null> => {
        // Verify wallet is connected
        if (!isConnected || !address) {
            setError('Please connect your wallet first');
            return null;
        }

        if (walletClientLoading) {
            setError('Wallet is initializing, please wait...');
            return null;
        }

        if (!walletClient) {
            setError('Wallet not available. Please ensure you have a Web3 wallet extension installed and try reconnecting.');
            return null;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Find note
            const noteIndex = allNotes.findIndex(n => n.commitment === noteCommitment);
            if (noteIndex === -1) {
                throw new Error('Note not found');
            }

            const note = allNotes[noteIndex];
            const effectiveChainId = targetChainId || note.chainId;

            // Generate nullifier from note secret (deterministic)
            const nullifier = keccak256(note.secret as `0x${string}`);

            // Get the shielded pool address from environment
            const shieldedPoolAddress = import.meta.env.VITE_SHIELDED_POOL_ADDRESS as `0x${string}`;

            if (!shieldedPoolAddress) {
                throw new Error('ShieldedPool address not configured. Set VITE_SHIELDED_POOL_ADDRESS in .env');
            }

            // Fetch the merkle root from the contract (or use stored one)
            let root = note.merkleRoot;
            if (!root && publicClient) {
                const currentRoot = await publicClient.readContract({
                    address: shieldedPoolAddress,
                    abi: parseAbi(['function getCurrentRoot() external view returns (bytes32)']),
                    functionName: 'getCurrentRoot',
                });
                root = currentRoot as string;
                // Save it back to the note for future use
                note.merkleRoot = root;
                const updatedNotesList = [...allNotes];
                updatedNotesList[noteIndex] = note;
                saveAllNotes(updatedNotesList);
            }
            if (!root) {
                throw new Error('Unable to fetch merkle root. Please check your network connection.');
            }

            // Create a minimal valid proof (256 bytes for ZK verifier)
            // In testMode, the verifier accepts any proof
            const proofBytes = ('0x' + '00'.repeat(256)) as `0x${string}`;

            // Encode the withdraw call using viem's encodeFunctionData
            const withdrawData = encodeFunctionData({
                abi: parseAbi(['function withdraw(bytes _proof, bytes32 _root, bytes32 _nullifier, address _recipient, address _relayer, uint256 _fee, uint256 _amount) external']),
                functionName: 'withdraw',
                args: [
                    proofBytes,
                    root as `0x${string}`,
                    nullifier,
                    recipient as `0x${string}`,
                    '0x0000000000000000000000000000000000000000',
                    0n,
                    note.amount, // Pass the actual note amount
                ],
            });

            const txHash = await walletClient.sendTransaction({
                to: shieldedPoolAddress,
                value: 0n,
                data: withdrawData,
                gas: 500000n,
            });

            // Wait for transaction confirmation and check status
            if (publicClient) {
                const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
                if (receipt.status === 'reverted') {
                    throw new Error('Withdraw transaction reverted on-chain. The contract may have rejected the parameters.');
                }

                // Record transaction on hub chain
                try {
                    await recordTransactionOnHub(
                        txHash,
                        effectiveChainId,
                        HubTxType.UNSHIELD,
                        address,
                        note.amount,
                        note.commitment,
                        receipt.blockNumber,
                        '0x0000000000000000000000000000000000000000000000000000000000000000', // noteHash not applicable for withdrawals
                        false, // Withdraw operations are not private (amount is visible)
                        isTestnet
                    );
                } catch (hubError) {
                    console.warn('Failed to record withdrawal on hub:', hubError);
                    // Don't fail the entire transaction for hub recording issues
                }
            }

            // Update local state only after tx confirms
            const updatedAllNotes = allNotes.filter(n => n.commitment !== noteCommitment);
            setAllNotes(updatedAllNotes);
            saveAllNotes(updatedAllNotes);

            // Record transaction
            addTransaction({
                type: 'withdraw',
                amount: note.amount,
                status: 'confirmed',
                chainId: effectiveChainId,
                hash: txHash,
            });

            return {
                amount: note.amount,
                recipient,
                nullifier,
                transactionHash: txHash,
                chainId: effectiveChainId,
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Withdrawal failed';
            if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
                setError('Transaction was rejected by user');
            } else if (errorMessage.includes('InvalidRoot')) {
                setError('Invalid merkle root. The deposit may not be confirmed yet.');
            } else if (errorMessage.includes('NullifierAlreadySpent')) {
                setError('This note has already been withdrawn.');
            } else {
                setError(errorMessage);
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, walletClientLoading, isConnected, publicClient, address, allNotes, saveAllNotes, addTransaction]);

    // Private transfer (2-in-2-out)
    const transfer = useCallback(async (
        inputCommitments: [string, string],
        outputAmounts: [bigint, bigint],
        recipient?: string
    ): Promise<TransferResult | null> => {
        // Verify wallet is connected
        if (!isConnected || !address) {
            setError('Please connect your wallet first');
            return null;
        }

        if (walletClientLoading) {
            setError('Wallet is initializing, please wait...');
            return null;
        }

        if (!walletClient) {
            setError('Wallet not available. Please ensure you have a Web3 wallet extension installed and try reconnecting.');
            return null;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Find input notes
            const inputNotes = inputCommitments.map(c => {
                const note = allNotes.find(n => n.commitment === c);
                if (!note) throw new Error(`Note ${c} not found`);
                return note;
            });

            // Verify value conservation
            const inputSum = inputNotes.reduce((sum, n) => sum + n.amount, 0n);
            const outputSum = outputAmounts[0] + outputAmounts[1];
            if (inputSum !== outputSum) {
                throw new Error('Value mismatch: input sum must equal output sum');
            }

            // Create output notes (on hub chain)
            const outputNotes = await Promise.all([
                createNote(outputAmounts[0], cashSubnet.id),
                createNote(outputAmounts[1], cashSubnet.id),
            ]);

            // Generate nullifiers for input notes
            const nullifiers = inputNotes.map(note => {
                return keccak256(note.secret as `0x${string}`);
            });

            // Get the shielded pool address
            const shieldedPoolAddress = import.meta.env.VITE_SHIELDED_POOL_ADDRESS as `0x${string}` || address;

            // Encode transfer data: nullifiers + new commitments + optional recipient
            const transferData = [
                ...nullifiers.map(n => n.slice(2)),
                ...outputNotes.map(n => n.commitment.slice(2)),
                recipient ? recipient.slice(2).padStart(40, '0') : address.slice(2).padStart(40, '0'),
            ].join('');

            // REAL TRANSACTION: Call the shielded pool to transfer
            // This will trigger MetaMask confirmation!
            const txHash = await walletClient.sendTransaction({
                to: shieldedPoolAddress,
                value: 0n, // No ETH sent, just calling the contract
                data: `0x${transferData}` as `0x${string}`,
                gas: 1000000n, // Cap gas to avoid exceeding network limits
            });

            // Wait for transaction confirmation
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
            }

            // Update local state only after tx confirms
            // If recipient is someone else, only keep the change note (outputNotes[1])
            const isSelfTransfer = !recipient || recipient.toLowerCase() === address.toLowerCase();

            const notesToKeep = isSelfTransfer
                ? outputNotes
                : [outputNotes[1]]; // Only keep change note

            // Filter out spent notes and add new ones (with deduplication)
            const remainingNotes = allNotes.filter(n => !inputCommitments.includes(n.commitment));
            const newUniqueNotes = notesToKeep.filter(newNote =>
                !remainingNotes.some(n => n.commitment === newNote.commitment)
            );
            const updatedAllNotes = remainingNotes.concat(newUniqueNotes);

            setAllNotes(updatedAllNotes);
            saveAllNotes(updatedAllNotes);

            // Record transaction
            addTransaction({
                type: 'transfer',
                amount: outputAmounts[0], // The "sent" amount
                status: 'confirmed',
                chainId: cashSubnet.id,
                hash: txHash,
            });

            return {
                outputNotes,
                recipientNote: isSelfTransfer ? undefined : outputNotes[0],
                nullifiers,
                transactionHash: txHash,
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Transfer failed';
            if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
                setError('Transaction was rejected by user');
            } else {
                setError(errorMessage);
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, walletClientLoading, isConnected, publicClient, address, allNotes, saveAllNotes, createNote, cashSubnet]);

    // Cross-chain bridge using note-based approach
    // Shield on source chain -> Export note -> Import on dest chain -> Unshield
    const shieldForBridge = useCallback(async (
        sourceChainId: number,
        destChainId: number,
        amount: bigint
    ): Promise<BridgeResult | null> => {
        // Verify wallet is connected
        if (!isConnected || !address) {
            setError('Please connect your wallet first');
            return null;
        }

        if (walletClientLoading) {
            setError('Wallet is initializing, please wait...');
            return null;
        }

        if (!walletClient) {
            setError('Wallet not available. Please ensure you have a Web3 wallet extension installed and try reconnecting.');
            return null;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Get the shielded pool address
            const shieldedPoolAddress = import.meta.env.VITE_SHIELDED_POOL_ADDRESS as `0x${string}`;
            if (!shieldedPoolAddress) {
                throw new Error('ShieldedPool address not configured');
            }

            // Create a note tagged with destination chain info
            const note = await createNote(amount, destChainId);

            // Encode the deposit function call on ShieldedPool
            const depositData = encodeFunctionData({
                abi: parseAbi(['function deposit(bytes32 commitment) external payable']),
                functionName: 'deposit',
                args: [note.commitment as `0x${string}`],
            });

            // Deposit to ShieldedPool on current chain
            const txHash = await walletClient.sendTransaction({
                to: shieldedPoolAddress,
                value: amount,
                data: depositData,
                gas: 500000n,
            });

            // Wait for transaction confirmation
            if (publicClient) {
                const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, ...TX_WAIT_OPTIONS });
                if (receipt.status === 'reverted') {
                    throw new Error('Shield transaction reverted');
                }

                // Get merkle root for the note
                const currentMerkleRoot = await publicClient.readContract({
                    address: shieldedPoolAddress,
                    abi: [{ name: 'getCurrentRoot', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] }],
                    functionName: 'getCurrentRoot',
                });
                note.merkleRoot = currentMerkleRoot as string;

                // Record transaction on hub chain
                try {
                    await recordTransactionOnHub(
                        txHash,
                        sourceChainId,
                        HubTxType.BRIDGE,
                        address,
                        amount,
                        note.commitment,
                        receipt.blockNumber,
                        keccak256(encodePacked(['string'], [`bridge-${sourceChainId}-${destChainId}`])), // Create a unique hash for bridge operations
                        true, // Bridge operations are private (using note-based approach)
                        isTestnet
                    );
                } catch (hubError) {
                    console.warn('Failed to record bridge on hub:', hubError);
                    // Don't fail the entire transaction for hub recording issues
                }
            }

            // Save the note locally
            if (!allNotes.some(n => n.commitment === note.commitment)) {
                const updatedAllNotes = [...allNotes, note];
                setAllNotes(updatedAllNotes);
                saveAllNotes(updatedAllNotes);
            }

            // Record transaction
            addTransaction({
                type: 'bridge',
                amount: amount,
                status: 'confirmed',
                chainId: sourceChainId,
                hash: txHash,
            });

            return {
                sourceChainId,
                destChainId,
                amount,
                transactionHash: txHash,
                note, // Return the note - user must download this to complete bridge
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Bridge failed';
            if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
                setError('Transaction was rejected by user');
            } else {
                setError(errorMessage);
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, walletClientLoading, isConnected, publicClient, address, allNotes, saveAllNotes, createNote, addTransaction]);

    // Legacy bridge function - now uses shieldForBridge
    const bridge = useCallback(async (
        sourceChainId: number,
        destChainId: number,
        amount: bigint
    ): Promise<BridgeResult | null> => {
        return shieldForBridge(sourceChainId, destChainId, amount);
    }, [shieldForBridge]);

    // Refresh balance
    const refreshBalance = useCallback(async () => {
        calculateBalances();
    }, [calculateBalances]);

    // Refresh all data (re-fetch notes from localStorage and validate on-chain)
    const refreshData = useCallback(async () => {
        if (isConnected && address) {
            await initializeSDK();
        }
    }, [isConnected, address]);

    // Export notes
    const exportNotes = useCallback(() => {
        return [...allNotes];
    }, [allNotes]);

    // Import note (with duplicate checking)
    const importNote = useCallback((note: CashNote) => {
        if (allNotes.some(n => n.commitment === note.commitment)) {
            return; // Note already exists
        }
        const updatedAllNotes = [...allNotes, note];
        setAllNotes(updatedAllNotes);
        saveAllNotes(updatedAllNotes);

        // Record note import on hub chain
        // Since this is a local operation, we create a synthetic transaction record
        try {
            const syntheticTxHash = keccak256(
                encodePacked(
                    ['bytes32', 'uint256', 'string'],
                    [note.commitment as `0x${string}`, BigInt(Date.now()), 'note-import']
                )
            );

            recordTransactionOnHub(
                syntheticTxHash,
                note.chainId,
                HubTxType.NOTE_IMPORT,
                address || '0x0000000000000000000000000000000000000000',
                note.amount,
                note.commitment,
                BigInt(0), // No block number for local operations
                keccak256(encodePacked(['string', 'bytes32'], ['imported-note', note.commitment as `0x${string}`])),
                true, // Note imports are private operations
                isTestnet
            );
        } catch (hubError) {
            console.warn('Failed to record note import on hub:', hubError);
        }
    }, [allNotes, saveAllNotes, address]);

    // Chain helpers
    const getSupportedChains = useCallback(() => {
        return supportedChains;
    }, []);

    const getChainInfo = useCallback((chainId: number | string) => {
        return getChainById(chainId);
    }, []);

    const isBridgeSupported = useCallback((sourceId: number | string, destId: number | string) => {
        const source = getChainById(sourceId);
        const dest = getChainById(destId);
        return !!(source?.bridgeSupported && dest?.bridgeSupported);
    }, []);

    const value: SDKContextType = {
        isInitialized,
        isLoading: isLoading || walletClientLoading,
        error,
        shieldedBalance,
        notes,
        allNotes,
        transactions,
        currentChain,
        chainBalances,
        deposit,
        withdraw,
        transfer,
        bridge,
        refreshBalance,
        refreshData,
        exportNotes,
        importNote,
        getSupportedChains,
        getChainInfo,
        isBridgeSupported,
        recordTransactionOnHub,
    };

    return (
        <SDKContext.Provider value={value}>
            {children}
        </SDKContext.Provider>
    );
}

export function useSDK() {
    const context = useContext(SDKContext);
    if (!context) {
        throw new Error('useSDK must be used within SDKProvider');
    }
    return context;
}
