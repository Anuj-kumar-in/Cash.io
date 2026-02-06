import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { supportedChains, ChainInfo, getChainById } from '../config/chains';
import { contractAddresses, cashSubnet } from '../config/wagmi';

// Types
export interface CashNote {
    commitment: string;
    secret: string;
    amount: bigint;
    blinding: string;
    chainId: number; // Track which chain the note was created on
    createdAt: number;
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
    nullifiers: string[];
    transactionHash: string;
}

export interface BridgeResult {
    sourceChainId: number;
    destChainId: number;
    amount: bigint;
    transactionHash: string;
    estimatedTime: number; // in seconds
}

interface SDKContextType {
    // State
    isInitialized: boolean;
    isLoading: boolean;
    error: string | null;
    shieldedBalance: bigint;
    notes: CashNote[];
    currentChain: ChainInfo | undefined;

    // Multi-chain state
    chainBalances: Record<number | string, bigint>;

    // Actions
    deposit: (amount: bigint, chainId?: number) => Promise<DepositResult | null>;
    withdraw: (noteCommitment: string, recipient: string, chainId?: number) => Promise<WithdrawalResult | null>;
    transfer: (inputCommitments: [string, string], outputAmounts: [bigint, bigint]) => Promise<TransferResult | null>;
    bridge: (sourceChainId: number, destChainId: number, amount: bigint) => Promise<BridgeResult | null>;
    refreshBalance: () => Promise<void>;
    exportNotes: () => CashNote[];
    importNote: (note: CashNote) => void;

    // Chain helpers
    getSupportedChains: () => ChainInfo[];
    getChainInfo: (chainId: number | string) => ChainInfo | undefined;
    isBridgeSupported: (sourceId: number | string, destId: number | string) => boolean;
}

const SDKContext = createContext<SDKContextType | null>(null);

// Helper to create CashNote
async function createNote(amount: bigint, chainId: number): Promise<CashNote> {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const secret = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const blindingBytes = new Uint8Array(32);
    crypto.getRandomValues(blindingBytes);
    const blinding = Array.from(blindingBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Mock commitment generation
    const commitment = '0x' + secret.substring(0, 64);

    return {
        commitment,
        secret: '0x' + secret,
        amount,
        blinding: '0x' + blinding,
        chainId,
        createdAt: Date.now(),
    };
}

// Generate mock tx hash
function generateTxHash(): string {
    return '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

interface SDKProviderProps {
    children: ReactNode;
}

export function SDKProvider({ children }: SDKProviderProps) {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const chainId = useChainId();

    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<CashNote[]>([]);
    const [shieldedBalance, setShieldedBalance] = useState<bigint>(0n);
    const [chainBalances, setChainBalances] = useState<Record<number | string, bigint>>({});

    const currentChain = getChainById(chainId);

    // Initialize SDK when wallet connects
    useEffect(() => {
        if (isConnected && address) {
            initializeSDK();
        } else {
            setIsInitialized(false);
            setNotes([]);
            setShieldedBalance(0n);
            setChainBalances({});
        }
    }, [isConnected, address]);

    // Recalculate balances when notes change
    useEffect(() => {
        calculateBalances();
    }, [notes]);

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
                setNotes(parsedNotes);
            }

            setIsInitialized(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to initialize SDK');
        } finally {
            setIsLoading(false);
        }
    };

    const calculateBalances = useCallback(() => {
        // Calculate total shielded balance
        const total = notes.reduce((sum, note) => sum + note.amount, 0n);
        setShieldedBalance(total);

        // Calculate per-chain balances
        const perChain: Record<number | string, bigint> = {};
        notes.forEach(note => {
            const key = note.chainId;
            perChain[key] = (perChain[key] || 0n) + note.amount;
        });
        setChainBalances(perChain);
    }, [notes]);

    // Save notes to localStorage
    const saveNotes = useCallback((updatedNotes: CashNote[]) => {
        if (address) {
            localStorage.setItem(
                `cash-notes-${address}`,
                JSON.stringify(updatedNotes, (key, value) => {
                    if (key === 'amount') return value.toString();
                    return value;
                })
            );
        }
    }, [address]);

    // Deposit to shielded pool
    const deposit = useCallback(async (amount: bigint, targetChainId?: number): Promise<DepositResult | null> => {
        if (!walletClient || !address) {
            setError('Wallet not connected');
            return null;
        }

        const effectiveChainId = targetChainId || chainId;

        try {
            setIsLoading(true);
            setError(null);

            // Create a new note
            const note = await createNote(amount, effectiveChainId);

            // For production: call actual ShieldedPool contract
            // const contracts = contractAddresses[effectiveChainId];
            // if (contracts?.shieldedPool) { ... }

            // Demo: simulate transaction
            const txHash = generateTxHash();

            // Update local state
            const updatedNotes = [...notes, note];
            setNotes(updatedNotes);
            saveNotes(updatedNotes);

            return {
                note,
                commitment: note.commitment,
                leafIndex: updatedNotes.length - 1,
                transactionHash: txHash,
                chainId: effectiveChainId,
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Deposit failed');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, address, chainId, notes, saveNotes]);

    // Withdraw from shielded pool
    const withdraw = useCallback(async (
        noteCommitment: string,
        recipient: string,
        targetChainId?: number
    ): Promise<WithdrawalResult | null> => {
        if (!walletClient || !address) {
            setError('Wallet not connected');
            return null;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Find note
            const noteIndex = notes.findIndex(n => n.commitment === noteCommitment);
            if (noteIndex === -1) {
                throw new Error('Note not found');
            }

            const note = notes[noteIndex];
            const effectiveChainId = targetChainId || note.chainId;

            // Demo: simulate transaction
            const txHash = generateTxHash();
            const nullifier = generateTxHash();

            // Update local state
            const updatedNotes = notes.filter((_, i) => i !== noteIndex);
            setNotes(updatedNotes);
            saveNotes(updatedNotes);

            return {
                amount: note.amount,
                recipient,
                nullifier,
                transactionHash: txHash,
                chainId: effectiveChainId,
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Withdrawal failed');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, address, notes, saveNotes]);

    // Private transfer (2-in-2-out)
    const transfer = useCallback(async (
        inputCommitments: [string, string],
        outputAmounts: [bigint, bigint]
    ): Promise<TransferResult | null> => {
        if (!walletClient || !address) {
            setError('Wallet not connected');
            return null;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Find input notes
            const inputNotes = inputCommitments.map(c => {
                const note = notes.find(n => n.commitment === c);
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

            // Demo: simulate transaction
            const txHash = generateTxHash();
            const nullifiers = [generateTxHash(), generateTxHash()];

            // Update local state
            const updatedNotes = notes
                .filter(n => !inputCommitments.includes(n.commitment))
                .concat(outputNotes);
            setNotes(updatedNotes);
            saveNotes(updatedNotes);

            return {
                outputNotes,
                nullifiers,
                transactionHash: txHash,
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transfer failed');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, address, notes, saveNotes]);

    // Cross-chain bridge
    const bridge = useCallback(async (
        sourceChainId: number,
        destChainId: number,
        amount: bigint
    ): Promise<BridgeResult | null> => {
        if (!walletClient || !address) {
            setError('Wallet not connected');
            return null;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Validate chains
            const sourceChain = getChainById(sourceChainId);
            const destChain = getChainById(destChainId);

            if (!sourceChain || !destChain) {
                throw new Error('Invalid chain');
            }

            if (!sourceChain.bridgeSupported || !destChain.bridgeSupported) {
                throw new Error('Bridge not supported for this chain pair');
            }

            // Demo: simulate bridge transaction
            await new Promise(resolve => setTimeout(resolve, 2000));
            const txHash = generateTxHash();

            // If bridging to hub, create a shielded note
            if (destChainId === cashSubnet.id) {
                const note = await createNote(amount, cashSubnet.id);
                const updatedNotes = [...notes, note];
                setNotes(updatedNotes);
                saveNotes(updatedNotes);
            }

            // Calculate estimated time based on chains
            const estimatedTime = sourceChain.category === 'solana' || destChain.category === 'solana'
                ? 30 * 60 // 30 minutes for Solana
                : sourceChain.category === 'bitcoin' || destChain.category === 'bitcoin'
                    ? 20 * 60 // 20 minutes for Bitcoin L2s
                    : 15 * 60; // 15 minutes for EVM

            return {
                sourceChainId,
                destChainId,
                amount,
                transactionHash: txHash,
                estimatedTime,
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Bridge failed');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [walletClient, address, notes, saveNotes]);

    // Refresh balance
    const refreshBalance = useCallback(async () => {
        calculateBalances();
    }, [calculateBalances]);

    // Export notes
    const exportNotes = useCallback(() => {
        return [...notes];
    }, [notes]);

    // Import note
    const importNote = useCallback((note: CashNote) => {
        const updatedNotes = [...notes, note];
        setNotes(updatedNotes);
        saveNotes(updatedNotes);
    }, [notes, saveNotes]);

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
        isLoading,
        error,
        shieldedBalance,
        notes,
        currentChain,
        chainBalances,
        deposit,
        withdraw,
        transfer,
        bridge,
        refreshBalance,
        exportNotes,
        importNote,
        getSupportedChains,
        getChainInfo,
        isBridgeSupported,
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
