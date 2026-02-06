import { useState, useMemo } from 'react';
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import {
    ArrowRightLeft,
    ChevronDown,
    Globe,
    Info,
    Loader2,
    CheckCircle2,
    Clock,
    Shield,
    Zap,
    Wallet,
    AlertCircle,
    Copy,
    Search,
    Filter,
    Bitcoin,
} from 'lucide-react';
import { useSDK } from '../hooks/useSDK';
import { WalletModal } from '../components/WalletModal';
import { supportedChains, ChainInfo, getChainById, ChainCategory } from '../config/chains';
import { cashSubnet } from '../config/wagmi';

export default function Bridge() {
    const { isConnected, address } = useAccount();
    const { data: balance } = useBalance({ address });
    const chainId = useChainId();
    const { switchChain, isPending: isSwitching } = useSwitchChain();
    const { bridge, deposit, isLoading: sdkLoading, error: sdkError } = useSDK();

    const [sourceChain, setSourceChain] = useState<ChainInfo | null>(null);
    const [destChain, setDestChain] = useState<ChainInfo | null>(() =>
        supportedChains.find(c => c.id === cashSubnet.id) || null
    );
    const [amount, setAmount] = useState('');
    const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success'>('idle');
    const [showSourceDropdown, setShowSourceDropdown] = useState(false);
    const [showDestDropdown, setShowDestDropdown] = useState(false);
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [lastTxHash, setLastTxHash] = useState('');
    const [copied, setCopied] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ChainCategory | 'all'>('all');
    const [showTestnets, setShowTestnets] = useState(false);

    // Set source chain based on connected network
    useMemo(() => {
        if (chainId && !sourceChain) {
            const chain = supportedChains.find(c => c.id === chainId);
            if (chain) setSourceChain(chain);
        }
    }, [chainId, sourceChain]);

    // Filtered chains for dropdown
    const filteredChains = useMemo(() => {
        return supportedChains.filter(chain => {
            if (!showTestnets && chain.isTestnet) return false;
            if (categoryFilter !== 'all' && chain.category !== categoryFilter) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return chain.name.toLowerCase().includes(query) ||
                    chain.symbol.toLowerCase().includes(query);
            }
            return true;
        });
    }, [showTestnets, categoryFilter, searchQuery]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const swapChains = () => {
        const temp = sourceChain;
        setSourceChain(destChain);
        setDestChain(temp);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceChain || !destChain) return;

        setTxStatus('pending');

        try {
            const amountWei = parseEther(amount);
            const result = await bridge(
                sourceChain.id as number,
                destChain.id as number,
                amountWei
            );

            if (result) {
                setLastTxHash(result.transactionHash);
                setTxStatus('success');
            } else {
                setTxStatus('idle');
            }
        } catch (err) {
            console.error(err);
            setTxStatus('idle');
        }
    };

    const resetForm = () => {
        setAmount('');
        setTxStatus('idle');
        setLastTxHash('');
    };

    const getEstimatedTime = () => {
        if (!sourceChain || !destChain) return '~15 min';
        if (sourceChain.category === 'solana' || destChain.category === 'solana') return '~30 min';
        if (sourceChain.category === 'bitcoin' || destChain.category === 'bitcoin') return '~20 min';
        return '~15 min';
    };

    const ChainDropdown = ({
        selectedChain,
        onSelect,
        isOpen,
        setIsOpen,
        excludeChainId,
        label,
    }: {
        selectedChain: ChainInfo | null;
        onSelect: (chain: ChainInfo) => void;
        isOpen: boolean;
        setIsOpen: (open: boolean) => void;
        excludeChainId?: number | string;
        label: string;
    }) => (
        <div className="relative flex-1">
            <label className="block text-sm font-medium mb-2">{label}</label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl hover:bg-[var(--color-border)] transition-colors"
            >
                {selectedChain ? (
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{selectedChain.icon}</span>
                        <div className="text-left">
                            <div className="font-semibold">{selectedChain.name}</div>
                            <div className="text-xs text-[var(--color-muted)] flex items-center gap-1">
                                <span>{selectedChain.symbol}</span>
                                {selectedChain.isTestnet && (
                                    <span className="badge badge-warning text-[10px] py-0">Testnet</span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <span className="text-[var(--color-muted)]">Select chain...</span>
                )}
                <ChevronDown size={20} className="text-[var(--color-muted)]" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[var(--color-border)] rounded-xl shadow-xl z-50 max-h-[400px] overflow-hidden">
                    {/* Search & Filters */}
                    <div className="p-3 border-b border-[var(--color-border)] space-y-2">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                            <input
                                type="text"
                                placeholder="Search chains..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-[var(--color-subtle)] rounded-lg text-sm outline-none focus:ring-2 ring-black"
                            />
                        </div>
                        <div className="flex gap-1 flex-wrap">
                            {['all', 'evm', 'bitcoin', 'solana'].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategoryFilter(cat as ChainCategory | 'all')}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${categoryFilter === cat
                                            ? 'bg-black text-white'
                                            : 'bg-[var(--color-subtle)] hover:bg-[var(--color-border)]'
                                        }`}
                                >
                                    {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setShowTestnets(!showTestnets)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${showTestnets
                                        ? 'bg-[var(--color-warning)] text-white'
                                        : 'bg-[var(--color-subtle)] hover:bg-[var(--color-border)]'
                                    }`}
                            >
                                Testnets
                            </button>
                        </div>
                    </div>

                    {/* Chain List */}
                    <div className="overflow-y-auto max-h-[300px]">
                        {filteredChains.filter(c => c.id !== excludeChainId).length === 0 ? (
                            <div className="p-4 text-center text-[var(--color-muted)] text-sm">
                                No chains found
                            </div>
                        ) : (
                            filteredChains
                                .filter(c => c.id !== excludeChainId)
                                .map((chain) => (
                                    <button
                                        key={chain.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(chain);
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                        className="w-full flex items-center justify-between p-3 hover:bg-[var(--color-subtle)] transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{chain.icon}</span>
                                            <div>
                                                <div className="font-medium text-sm">{chain.name}</div>
                                                <div className="text-xs text-[var(--color-muted)]">{chain.symbol}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {chain.isTestnet && (
                                                <span className="badge badge-warning text-[10px] py-0">Test</span>
                                            )}
                                            {chain.category === 'bitcoin' && (
                                                <span className="badge badge-neutral text-[10px] py-0">BTC</span>
                                            )}
                                            {chain.category === 'solana' && (
                                                <span className="badge badge-neutral text-[10px] py-0">SOL</span>
                                            )}
                                            {chainId === chain.id && (
                                                <div className="w-2 h-2 bg-[var(--color-success)] rounded-full" />
                                            )}
                                        </div>
                                    </button>
                                ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    // Not connected state
    if (!isConnected) {
        return (
            <div className="max-w-2xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-20 h-20 bg-[var(--color-subtle)] rounded-2xl flex items-center justify-center mb-6">
                    <Wallet size={40} className="text-[var(--color-muted)]" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                <p className="text-[var(--color-muted)] mb-6 max-w-md">
                    Connect your wallet to bridge assets across chains
                </p>
                <button
                    onClick={() => setIsWalletModalOpen(true)}
                    className="btn btn-primary btn-lg"
                >
                    <Wallet size={20} className="mr-2" />
                    Connect Wallet
                </button>
                <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
            {/* Page Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold tracking-tight">Cross-Chain Bridge</h1>
                <p className="text-[var(--color-muted)] mt-2">
                    Bridge assets across 30+ chains with privacy preserved
                </p>
            </div>

            {/* Chain Categories */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { icon: '⟠', label: 'EVM Chains', count: supportedChains.filter(c => c.category === 'evm').length },
                    { icon: '🟠', label: 'Bitcoin L2s', count: supportedChains.filter(c => c.category === 'bitcoin').length },
                    { icon: '◎', label: 'Solana', count: supportedChains.filter(c => c.category === 'solana').length },
                    { icon: '💰', label: 'Cash.io Hub', count: 1 },
                ].map((cat, i) => (
                    <div key={i} className="card text-center py-4">
                        <span className="text-2xl">{cat.icon}</span>
                        <div className="text-sm font-medium mt-2">{cat.label}</div>
                        <div className="text-xs text-[var(--color-muted)]">{cat.count} chains</div>
                    </div>
                ))}
            </div>

            {/* Main Card */}
            <div className="card">
                {txStatus === 'success' ? (
                    /* Success State */
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-[var(--color-success)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={40} className="text-[var(--color-success)]" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Bridge Initiated!</h3>
                        <p className="text-[var(--color-muted)] mb-2">
                            {sourceChain?.name} → {destChain?.name}
                        </p>
                        <p className="text-sm text-[var(--color-muted)] mb-6">
                            Estimated time: {getEstimatedTime()}
                        </p>

                        {/* Progress Steps */}
                        <div className="space-y-3 max-w-sm mx-auto mb-8">
                            {[
                                { label: 'Source chain confirmed', done: true },
                                { label: 'Relayer processing', done: true },
                                { label: 'Destination chain pending', done: false },
                            ].map((step, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step.done
                                            ? 'bg-[var(--color-success)] text-white'
                                            : 'bg-[var(--color-subtle)]'
                                        }`}>
                                        {step.done ? <CheckCircle2 size={14} /> : <Clock size={14} className="animate-pulse" />}
                                    </div>
                                    <span className={step.done ? '' : 'text-[var(--color-muted)]'}>{step.label}</span>
                                </div>
                            ))}
                        </div>

                        {lastTxHash && (
                            <div className="flex items-center justify-center gap-2 bg-[var(--color-subtle)] px-4 py-2 rounded-lg font-mono text-sm mb-6">
                                <span>{lastTxHash.slice(0, 10)}...{lastTxHash.slice(-6)}</span>
                                <button onClick={() => handleCopy(lastTxHash)}>
                                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        )}

                        <button onClick={resetForm} className="btn btn-primary">
                            Bridge More Assets
                        </button>
                    </div>
                ) : (
                    /* Form State */
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Display */}
                        {sdkError && (
                            <div className="flex items-center gap-2 p-4 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded-xl text-sm">
                                <AlertCircle size={18} />
                                <span>{sdkError}</span>
                            </div>
                        )}

                        {/* Chain Selection */}
                        <div className="flex items-start gap-4">
                            <ChainDropdown
                                selectedChain={sourceChain}
                                onSelect={setSourceChain}
                                isOpen={showSourceDropdown}
                                setIsOpen={setShowSourceDropdown}
                                excludeChainId={destChain?.id}
                                label="From"
                            />

                            {/* Swap Button */}
                            <button
                                type="button"
                                onClick={swapChains}
                                className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center hover:bg-[var(--color-accent)] transition-all hover:scale-105 mt-8"
                            >
                                <ArrowRightLeft size={20} />
                            </button>

                            <ChainDropdown
                                selectedChain={destChain}
                                onSelect={setDestChain}
                                isOpen={showDestDropdown}
                                setIsOpen={setShowDestDropdown}
                                excludeChainId={sourceChain?.id}
                                label="To"
                            />
                        </div>

                        {/* Switch Network Warning */}
                        {sourceChain && sourceChain.id !== chainId && sourceChain.category !== 'solana' && (
                            <div className="flex items-center justify-between p-4 bg-[var(--color-warning)]/10 rounded-xl">
                                <div className="flex items-center gap-2 text-sm">
                                    <AlertCircle size={18} className="text-[var(--color-warning)]" />
                                    <span>Switch to {sourceChain.name} to continue</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => switchChain?.({ chainId: sourceChain.id as number })}
                                    disabled={isSwitching}
                                    className="btn btn-sm btn-primary"
                                >
                                    {isSwitching ? <Loader2 size={14} className="animate-spin" /> : 'Switch'}
                                </button>
                            </div>
                        )}

                        {/* Amount Input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Amount</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.0"
                                    className="input text-2xl font-mono pr-24"
                                    step="0.0001"
                                    min="0.001"
                                    required
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => balance && setAmount(balance.formatted)}
                                        className="px-3 py-1 bg-black text-white text-xs font-semibold rounded-md hover:bg-[var(--color-accent)]"
                                    >
                                        MAX
                                    </button>
                                    <span className="text-[var(--color-muted)] font-medium">
                                        {sourceChain?.symbol || balance?.symbol || 'ETH'}
                                    </span>
                                </div>
                            </div>
                            {balance && (
                                <p className="text-xs text-[var(--color-muted)] mt-2">
                                    Balance: {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                                </p>
                            )}
                        </div>

                        {/* Bridge Info */}
                        <div className="flex items-start gap-3 p-4 bg-[var(--color-subtle)] rounded-xl">
                            <Info size={20} className="text-[var(--color-muted)] shrink-0 mt-0.5" />
                            <div className="text-sm text-[var(--color-muted)]">
                                {destChain?.id === cashSubnet.id ? (
                                    <>Assets bridged to Cash.io Hub are automatically shielded for privacy.</>
                                ) : sourceChain?.category === 'bitcoin' || destChain?.category === 'bitcoin' ? (
                                    <>Bitcoin L2 bridges may take longer due to Bitcoin block confirmations.</>
                                ) : sourceChain?.category === 'solana' || destChain?.category === 'solana' ? (
                                    <>Solana bridges use Wormhole and may take up to 30 minutes.</>
                                ) : (
                                    <>EVM bridges typically complete in 10-15 minutes.</>
                                )}
                            </div>
                        </div>

                        {/* Fee Breakdown */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--color-muted)]">Bridge Fee</span>
                                <span className="font-mono">0.1%</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--color-muted)]">Estimated Time</span>
                                <span className="font-mono">{getEstimatedTime()}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-[var(--color-border)]">
                                <span>You Will Receive</span>
                                <span className="font-mono">
                                    {amount ? (parseFloat(amount) * 0.999).toFixed(4) : '0.0000'} {destChain?.symbol || 'ETH'}
                                </span>
                            </div>
                        </div>

                        <hr className="divider" />

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={
                                sdkLoading ||
                                txStatus === 'pending' ||
                                !amount ||
                                !sourceChain ||
                                !destChain ||
                                (sourceChain?.category !== 'solana' && sourceChain?.id !== chainId)
                            }
                            className="btn btn-primary btn-lg w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sdkLoading || txStatus === 'pending' ? (
                                <>
                                    <Loader2 size={20} className="mr-2 animate-spin" />
                                    Initiating Bridge...
                                </>
                            ) : (
                                <>
                                    <Globe size={20} className="mr-2" />
                                    Bridge to {destChain?.name || 'Chain'}
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { icon: Shield, title: 'Private by Default', desc: 'Assets arrive shielded on hub' },
                    { icon: Zap, title: 'Fast Finality', desc: 'Quick cross-chain transfers' },
                    { icon: Globe, title: '30+ Chains', desc: 'EVM, Bitcoin L2s, Solana' },
                ].map((feature) => (
                    <div key={feature.title} className="card text-center py-6">
                        <div className="w-12 h-12 bg-[var(--color-subtle)] rounded-xl flex items-center justify-center mx-auto mb-3">
                            <feature.icon size={24} />
                        </div>
                        <h4 className="font-semibold">{feature.title}</h4>
                        <p className="text-sm text-[var(--color-muted)] mt-1">{feature.desc}</p>
                    </div>
                ))}
            </div>

            {/* Supported Chains Preview */}
            <div>
                <h3 className="font-bold mb-4">Supported Networks</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {supportedChains.filter(c => !c.isTestnet).slice(0, 16).map((chain) => (
                        <div
                            key={chain.id}
                            className="flex flex-col items-center p-2 bg-[var(--color-subtle)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
                            title={chain.name}
                        >
                            <span className="text-xl">{chain.icon}</span>
                            <span className="text-[10px] text-[var(--color-muted)] mt-1 truncate w-full text-center">
                                {chain.name.split(' ')[0]}
                            </span>
                        </div>
                    ))}
                    <div className="flex flex-col items-center justify-center p-2 bg-[var(--color-subtle)] rounded-lg">
                        <span className="text-sm font-bold text-[var(--color-muted)]">+{supportedChains.filter(c => !c.isTestnet).length - 16}</span>
                        <span className="text-[10px] text-[var(--color-muted)]">more</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
