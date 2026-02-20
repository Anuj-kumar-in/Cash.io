import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type NetworkMode = 'mainnet' | 'testnet';

interface NetworkModeContextType {
    networkMode: NetworkMode;
    setNetworkMode: (mode: NetworkMode) => void;
    toggleNetworkMode: () => void;
    isTestnet: boolean;
    isMainnet: boolean;
}

const NetworkModeContext = createContext<NetworkModeContextType | undefined>(undefined);

const STORAGE_KEY = 'cash-network-mode';

export function NetworkModeProvider({ children }: { children: ReactNode }) {
    const [networkMode, setNetworkModeState] = useState<NetworkMode>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY);
            return (stored === 'mainnet' || stored === 'testnet') ? stored : 'testnet';
        }
        return 'testnet';
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, networkMode);
    }, [networkMode]);

    const setNetworkMode = (mode: NetworkMode) => {
        setNetworkModeState(mode);
    };

    const toggleNetworkMode = () => {
        setNetworkModeState(prev => prev === 'mainnet' ? 'testnet' : 'mainnet');
    };

    return (
        <NetworkModeContext.Provider
            value={{
                networkMode,
                setNetworkMode,
                toggleNetworkMode,
                isTestnet: networkMode === 'testnet',
                isMainnet: networkMode === 'mainnet',
            }}
        >
            {children}
        </NetworkModeContext.Provider>
    );
}

export function useNetworkMode() {
    const context = useContext(NetworkModeContext);
    if (context === undefined) {
        throw new Error('useNetworkMode must be used within a NetworkModeProvider');
    }
    return context;
}
