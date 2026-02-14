import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useConnect, useAccount, useDisconnect, useBalance, useChainId, useSwitchChain } from 'wagmi';
import {
    Wallet,
    X,
    AlertCircle,
    Check,
    Copy,
    ExternalLink,
    ChevronDown,
    Loader2,
    LogOut,
    Search,
} from 'lucide-react';
import { supportedChains, getChainById } from '../config/chains';
import { cashSubnet } from '../config/wagmi';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
    const { connectors, connect, isPending, error } = useConnect();
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const chainId = useChainId();
    const { switchChain, isPending: isSwitching } = useSwitchChain();
    const { data: balance } = useBalance({ address });

    const [copied, setCopied] = useState(false);
    const [showAllNetworks, setShowAllNetworks] = useState(false);
    const [networkSearch, setNetworkSearch] = useState('');

    const handleCopy = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    // Format balance from bigint value
    const formatBalance = (bal: typeof balance, decimals: number = 4) => {
        if (!bal) return '0.' + '0'.repeat(decimals);
        const value = Number(bal.value) / Math.pow(10, bal.decimals);
        return value.toFixed(decimals);
    };

    const currentChain = getChainById(chainId);

    // Popular networks to show first
    const popularNetworks = [cashSubnet.id, 1, 137, 42161, 10, 43114, 8453, 30];

    const filteredNetworks = supportedChains
        .filter(chain => {
            if (typeof chain.id === 'string') return false; // Exclude Solana from network switch
            if (!showAllNetworks && !popularNetworks.includes(chain.id as number)) return false;
            if (networkSearch) {
                const query = networkSearch.toLowerCase();
                return chain.name.toLowerCase().includes(query) || chain.symbol.toLowerCase().includes(query);
            }
            return true;
        })
        .sort((a, b) => {
            const aPopular = popularNetworks.indexOf(a.id as number);
            const bPopular = popularNetworks.indexOf(b.id as number);
            if (aPopular !== -1 && bPopular !== -1) return aPopular - bPopular;
            if (aPopular !== -1) return -1;
            if (bPopular !== -1) return 1;
            return 0;
        });

    if (!isOpen) return null;

    // Use portal to render modal at document body level to avoid z-index stacking context issues
    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in max-h-[90vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
                        <h2 className="text-xl font-bold">
                            {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[var(--color-subtle)] rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1">
                        {isConnected && address ? (
                            /* Connected State */
                            <div className="space-y-6">
                                {/* Address & Balance */}
                                <div className="p-4 bg-[var(--color-subtle)] rounded-xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-[var(--color-muted)]">Connected Address</span>
                                        <div className="w-2 h-2 bg-[var(--color-success)] rounded-full animate-pulse" />
                                    </div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="font-mono text-lg font-medium">
                                            {truncateAddress(address)}
                                        </span>
                                        <button
                                            onClick={handleCopy}
                                            className="p-1.5 hover:bg-white rounded-lg transition-colors"
                                        >
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                        <a
                                            href={`https://etherscan.io/address/${address}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 hover:bg-white rounded-lg transition-colors"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold">
                                            {formatBalance(balance, 4)}
                                        </span>
                                        <span className="text-[var(--color-muted)]">{balance?.symbol || 'ETH'}</span>
                                    </div>
                                </div>

                                {/* Current Network */}
                                <div className="flex items-center justify-between p-3 bg-black text-white rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{currentChain?.icon || '🔗'}</span>
                                        <div>
                                            <div className="font-medium">{currentChain?.name || `Chain ${chainId}`}</div>
                                            <div className="text-xs text-white/60">{currentChain?.symbol}</div>
                                        </div>
                                    </div>
                                    {currentChain?.isTestnet && (
                                        <span className="px-2 py-0.5 bg-[var(--color-warning)] text-white text-xs rounded-full">
                                            Testnet
                                        </span>
                                    )}
                                </div>

                                {/* Network Switcher */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm font-medium">Switch Network</label>
                                        <button
                                            onClick={() => setShowAllNetworks(!showAllNetworks)}
                                            className="text-xs text-[var(--color-muted)] hover:text-black"
                                        >
                                            {showAllNetworks ? 'Show less' : 'Show all 30+ chains'}
                                        </button>
                                    </div>

                                    {showAllNetworks && (
                                        <div className="relative mb-3">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                                            <input
                                                type="text"
                                                placeholder="Search networks..."
                                                value={networkSearch}
                                                onChange={(e) => setNetworkSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-[var(--color-subtle)] rounded-lg text-sm outline-none focus:ring-2 ring-black"
                                            />
                                        </div>
                                    )}

                                    <div className={`grid gap-2 ${showAllNetworks ? 'grid-cols-2 max-h-[200px] overflow-y-auto' : 'grid-cols-2'}`}>
                                        {filteredNetworks.map((network) => (
                                            <button
                                                key={network.id}
                                                onClick={() => switchChain?.({ chainId: network.id as number })}
                                                disabled={isSwitching || chainId === network.id}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${chainId === network.id
                                                    ? 'bg-black text-white'
                                                    : 'bg-[var(--color-subtle)] hover:bg-[var(--color-border)]'
                                                    }`}
                                            >
                                                <span>{network.icon}</span>
                                                <span className="truncate">{network.name.split(' ')[0]}</span>
                                                {chainId === network.id && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Disconnect Button */}
                                <button
                                    onClick={() => {
                                        disconnect();
                                        onClose();
                                    }}
                                    className="btn btn-secondary w-full"
                                >
                                    <LogOut size={18} className="mr-2" />
                                    Disconnect Wallet
                                </button>
                            </div>
                        ) : (
                            /* Connect State */
                            <div className="space-y-4">
                                {error && (
                                    <div className="flex items-center gap-2 p-4 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded-xl text-sm">
                                        <AlertCircle size={18} />
                                        <span>{error.message}</span>
                                    </div>
                                )}

                                <p className="text-[var(--color-muted)] text-sm text-center mb-4">
                                    Connect your wallet to access the Cash.io Protocol
                                </p>

                                <div className="space-y-3">
                                    {connectors.map((connector) => (
                                        <button
                                            key={connector.uid}
                                            onClick={() => connect({ connector })}
                                            disabled={isPending}
                                            className="w-full flex items-center justify-between p-4 bg-[var(--color-subtle)] hover:bg-[var(--color-border)] rounded-xl transition-all disabled:opacity-50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                                    {connector.name === 'MetaMask' && <span className="text-2xl">🦊</span>}
                                                    {connector.name === 'WalletConnect' && <span className="text-2xl">🔗</span>}
                                                    {connector.name === 'Injected' && <Wallet size={20} />}
                                                    {!['MetaMask', 'WalletConnect', 'Injected'].includes(connector.name) && (
                                                        <Wallet size={20} />
                                                    )}
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-semibold">{connector.name}</div>
                                                    <div className="text-xs text-[var(--color-muted)]">
                                                        {connector.name === 'MetaMask' && 'Popular browser extension'}
                                                        {connector.name === 'WalletConnect' && 'Scan with mobile wallet'}
                                                        {connector.name === 'Injected' && 'Browser wallet detected'}
                                                    </div>
                                                </div>
                                            </div>
                                            {isPending ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <ChevronDown size={18} className="-rotate-90" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Supported Chains Preview */}
                                <div className="pt-4 border-t border-[var(--color-border)]">
                                    <p className="text-xs text-[var(--color-muted)] text-center mb-3">
                                        Supports 30+ networks including
                                    </p>
                                    <div className="flex justify-center gap-2 flex-wrap">
                                        {supportedChains.filter(c => popularNetworks.includes(c.id as number)).slice(0, 8).map(chain => (
                                            <span key={chain.id} className="text-lg" title={chain.name}>{chain.icon}</span>
                                        ))}
                                        <span className="text-sm text-[var(--color-muted)]">+more</span>
                                    </div>
                                </div>

                                <p className="text-xs text-[var(--color-muted)] text-center pt-4">
                                    By connecting, you agree to our{' '}
                                    <a href="#" className="underline hover:text-black">Terms of Service</a>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Compact wallet button for header
export function WalletButton() {
    const { address, isConnected } = useAccount();
    const { data: balance } = useBalance({ address });
    const chainId = useChainId();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    // Format balance from bigint value
    const formatBalance = (bal: typeof balance, decimals: number = 4) => {
        if (!bal) return '0.' + '0'.repeat(decimals);
        const value = Number(bal.value) / Math.pow(10, bal.decimals);
        return value.toFixed(decimals);
    };

    const currentChain = getChainById(chainId);

    return (
        <>
            {isConnected && address ? (
                <div className="flex items-center gap-2">
                    {/* Network Badge */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-subtle)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
                    >
                        <span>{currentChain?.icon || '🔗'}</span>
                        <span className="text-sm font-medium">{currentChain?.name.split(' ')[0] || `Chain ${chainId}`}</span>
                    </button>

                    {/* Balance & Address */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-subtle)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
                    >
                        <div className="w-2 h-2 bg-[var(--color-success)] rounded-full animate-pulse" />
                        <span className="hidden sm:inline font-mono text-sm">
                            {formatBalance(balance, 3)} {balance?.symbol || 'ETH'}
                        </span>
                        <span className="font-mono text-sm font-medium">{truncateAddress(address)}</span>
                    </button>
                </div>
            ) : (
                <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                    <Wallet size={18} className="mr-2" />
                    Connect
                </button>
            )}
            <WalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
}
