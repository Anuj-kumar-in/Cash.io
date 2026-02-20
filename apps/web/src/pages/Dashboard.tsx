import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useBalance, useChainId } from 'wagmi';
import { formatEther } from 'viem';
import {
    Shield,
    ArrowRightLeft,
    Send,
    Globe,
    TrendingUp,
    Clock,
    Eye,
    EyeOff,
    Lock,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    ChevronRight,
    Zap,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    TestTube,
} from 'lucide-react';
import { useSDK } from '../hooks/useSDK';
import { useNetworkMode } from '../hooks/useNetworkMode';
import { WalletModal } from '../components/WalletModal';
import { supportedChains, getChainById, type ChainInfo } from '../config/chains';
import { cashSubnet, cashSubnetTestnet } from '../config/wagmi';

export default function Dashboard() {
    const { isConnected, address } = useAccount();
    const { data: balance } = useBalance({ address });
    const chainId = useChainId();
    const {
        shieldedBalance,
        notes,
        transactions,
        chainBalances,
        isInitialized,
        isLoading,
        refreshData,
        getSupportedChains
    } = useSDK();

    const [hideBalances, setHideBalances] = useState(false);
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const { isTestnet } = useNetworkMode();

    const currentChain = getChainById(chainId);
    // Guard against NaN by checking shieldedBalance is valid bigint
    const shieldedBalanceFormatted = shieldedBalance && shieldedBalance >= 0n ? formatEther(shieldedBalance) : '0';

    // Map real transactions from SDK
    const recentTransactions = transactions.map(tx => ({
        type: tx.type,
        amount: formatEther(tx.amount),
        symbol: getChainById(tx.chainId)?.symbol || 'ETH',
        status: tx.status === 'confirmed' ? 'confirmed' : 'pending',
        chain: getChainById(tx.chainId)?.name.split(' ')[0] || 'Unknown',
        time: new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })).slice(0, 5); // Show last 5

    // Chain stats based on network mode
    const chainCategories = [
        { name: 'EVM Chains', count: supportedChains.filter(c => c.category === 'evm' && c.isTestnet === isTestnet).length, icon: '⟠' },
        { name: 'Bitcoin L2s', count: supportedChains.filter(c => c.category === 'bitcoin' && c.isTestnet === isTestnet).length, icon: '🟠' },
        { name: 'Solana', count: supportedChains.filter(c => c.category === 'solana' && c.isTestnet === isTestnet).length, icon: '◎' },
    ];

    // Not connected state
    if (!isConnected) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-24 h-24 bg-[var(--color-subtle)] rounded-3xl flex items-center justify-center mb-8">
                    <Wallet size={48} className="text-[var(--color-muted)]" />
                </div>
                <h1 className="text-3xl font-bold mb-3">Welcome to Cash.io</h1>
                <p className="text-[var(--color-muted)] mb-8 max-w-md">
                    Connect your wallet to access private transactions across 30+ chains including
                    Ethereum, Bitcoin L2s, and Solana.
                </p>
                <button
                    onClick={() => setIsWalletModalOpen(true)}
                    className="btn btn-primary btn-lg"
                >
                    <Wallet size={20} className="mr-2" />
                    Connect Wallet
                </button>

                {/* Supported Chains Preview */}
                <div className="mt-12 grid grid-cols-4 gap-6">
                    {chainCategories.map((cat) => (
                        <div key={cat.name} className="text-center">
                            <span className="text-3xl">{cat.icon}</span>
                            <div className="text-sm font-medium mt-2">{cat.name}</div>
                            <div className="text-xs text-[var(--color-muted)]">{cat.count} chains</div>
                        </div>
                    ))}
                </div>

                <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-[var(--color-muted)] mt-1">
                        Manage your private assets across all chains
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refreshData()}
                        disabled={isLoading}
                        className="btn btn-secondary btn-sm"
                        title="Refresh data"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setHideBalances(!hideBalances)}
                        className="btn btn-secondary btn-sm"
                    >
                        {hideBalances ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Public Balance */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-[var(--color-muted)]">Public Balance</span>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--color-subtle)] rounded-full text-xs">
                            <span>{currentChain?.icon || '🔗'}</span>
                            <span>{currentChain?.name.split(' ')[0] || 'Unknown'}</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold font-mono">
                            {hideBalances ? '••••' : (balance?.value ? parseFloat(formatEther(balance.value)).toFixed(4) : '0.0000')}
                        </span>
                        <span className="text-[var(--color-muted)]">{balance?.symbol || currentChain?.symbol || 'ETH'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                        <Link to="/shield" className="btn btn-primary btn-sm flex-1">
                            <Shield size={14} className="mr-1" />
                            Shield
                        </Link>
                    </div>
                </div>

                {/* Shielded Balance */}
                <div className="card bg-black text-white">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-white/60">Shielded Balance</span>
                        <div className="flex items-center gap-2">
                            <Lock size={14} className="text-white/40" />
                            <span className="text-xs text-white/40">Private</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold font-mono">
                            {hideBalances ? '••••' : (isNaN(parseFloat(shieldedBalanceFormatted)) ? '0.0000' : parseFloat(shieldedBalanceFormatted).toFixed(4))}
                        </span>
                        <span className="text-white/60">{currentChain?.symbol || 'ETH'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                        <Link to="/transfer" className="btn btn-sm flex-1 bg-white text-black hover:bg-white/90">
                            <Send size={14} className="mr-1" />
                            Transfer
                        </Link>
                        <Link to="/shield" className="btn btn-sm flex-1 border border-white/20 text-white hover:bg-white/10">
                            <ArrowDownLeft size={14} className="mr-1" />
                            Unshield
                        </Link>
                    </div>
                </div>

                {/* Notes Overview */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-[var(--color-muted)]">Shielded Notes</span>
                        <span className="badge badge-neutral">{notes.length}</span>
                    </div>
                    <div className="space-y-2">
                        {notes.length > 0 ? (
                            notes.slice(0, 3).map((note, i) => (
                                <div key={i} className="flex items-center justify-between p-2 bg-[var(--color-subtle)] rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-black text-white rounded flex items-center justify-center text-xs">
                                            {i + 1}
                                        </div>
                                        <span className="font-mono text-sm">
                                            {hideBalances ? '••••' : formatEther(note.amount)} {getChainById(note.chainId)?.symbol || 'ETH'}
                                        </span>
                                    </div>
                                    <span className="text-xs text-[var(--color-muted)]">
                                        {getChainById(note.chainId)?.name.split(' ')[0] || 'Hub'}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-[var(--color-muted)] text-sm">
                                No shielded notes yet
                            </div>
                        )}
                        {notes.length > 3 && (
                            <Link to="/settings" className="text-xs text-[var(--color-muted)] hover:text-black flex items-center justify-center gap-1">
                                View all {notes.length} notes <ChevronRight size={12} />
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { icon: Shield, label: 'Shield Assets', desc: 'Deposit to shielded pool', to: '/app/shield', color: 'bg-black text-white' },
                        { icon: Send, label: 'Private Transfer', desc: '2-in-2-out ZK transfer', to: '/app/transfer', color: 'bg-[var(--color-subtle)]' },
                        { icon: Globe, label: 'Cross-Chain Bridge', desc: '30+ chains supported', to: '/app/bridge', color: 'bg-[var(--color-subtle)]' },
                        { icon: TestTube, label: 'Hub Test Suite', desc: 'Test subnet recording', to: '/app/hub-test', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
                    ].map((action) => (
                        <Link
                            key={action.label}
                            to={action.to}
                            className={`card ${action.color} group hover:scale-[1.02] transition-transform`}
                        >
                            <action.icon size={24} className={
                                action.color === 'bg-black text-white' ? '' :
                                    action.color.includes('purple') ? 'text-purple-600' :
                                        'text-[var(--color-muted)]'
                            } />
                            <h3 className="font-semibold mt-3">{action.label}</h3>
                            <p className={`text-sm mt-1 ${action.color === 'bg-black text-white' ? 'text-white/60' :
                                action.color.includes('purple') ? 'text-purple-500' :
                                    'text-[var(--color-muted)]'
                                }`}>
                                {action.desc}
                            </p>
                            <ChevronRight size={16} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                    ))}
                </div>
            </div>

            {/* Supported Networks */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold">Supported Networks</h2>
                    <Link to="/bridge" className="text-sm text-[var(--color-muted)] hover:text-black flex items-center gap-1">
                        View all <ChevronRight size={14} />
                    </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {chainCategories.map((cat) => (
                        <div key={cat.name} className="card text-center py-4">
                            <span className="text-3xl">{cat.icon}</span>
                            <div className="font-medium mt-2">{cat.name}</div>
                            <div className="text-sm text-[var(--color-muted)]">{cat.count} chains</div>
                        </div>
                    ))}
                </div>
                {/* Popular chain icons */}
                <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
                    {supportedChains.filter(c => c.isTestnet === isTestnet).slice(0, 12).map(chain => (
                        <div
                            key={chain.id}
                            className="w-10 h-10 bg-[var(--color-subtle)] rounded-full flex items-center justify-center text-xl hover:bg-[var(--color-border)] transition-colors cursor-pointer"
                            title={chain.name}
                        >
                            {chain.icon}
                        </div>
                    ))}
                    {supportedChains.filter(c => c.isTestnet === isTestnet).length > 12 && (
                        <div className="w-10 h-10 bg-[var(--color-subtle)] rounded-full flex items-center justify-center text-xs font-bold text-[var(--color-muted)]">
                            +{supportedChains.filter(c => c.isTestnet === isTestnet).length - 12}
                        </div>
                    )}
                </div>
            </div>

            {/* Hub Chain Status */}
            <div>
                <h2 className="text-lg font-bold mb-4">Hub Chain Status</h2>
                <div className={`card bg-gradient-to-r border ${isTestnet
                    ? 'from-amber-500/10 to-orange-500/10 border-amber-500/20'
                    : 'from-purple-500/10 to-blue-500/10 border-purple-500/20'
                    }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isTestnet ? 'bg-amber-500/20' : 'bg-purple-500/20'
                                }`}>
                                <span className="text-2xl">{isTestnet ? '🧪' : '💰'}</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{isTestnet ? 'Cash.io Testnet' : 'Cash.io Hub'}</h3>
                                <p className="text-[var(--color-muted)] text-sm">
                                    All your transactions are being recorded on the {isTestnet ? 'testnet' : 'decentralized'} hub
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-sm font-medium">Connected</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <div className={`text-2xl font-bold ${isTestnet ? 'text-amber-600' : 'text-purple-600'
                                }`}>{transactions.length}</div>
                            <div className="text-xs text-[var(--color-muted)]">Recorded Txs</div>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-bold ${isTestnet ? 'text-amber-600' : 'text-purple-600'
                                }`}>{isTestnet ? '41021' : '4102'}</div>
                            <div className="text-xs text-[var(--color-muted)]">Chain ID</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-emerald-600">100%</div>
                            <div className="text-xs text-[var(--color-muted)]">Uptime</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold">Recent Activity</h2>
                    <button className="text-sm text-[var(--color-muted)] hover:text-black flex items-center gap-1">
                        View all <ChevronRight size={14} />
                    </button>
                </div>
                <div className="card divide-y divide-[var(--color-border)]">
                    {recentTransactions.length > 0 ? (
                        recentTransactions.map((tx, i) => (
                            <div key={i} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'deposit' ? 'bg-[var(--color-success)]/10' :
                                        tx.type === 'transfer' ? 'bg-black text-white' :
                                            'bg-[var(--color-subtle)]'
                                        }`}>
                                        {tx.type === 'deposit' && <ArrowDownLeft size={18} className="text-[var(--color-success)]" />}
                                        {tx.type === 'transfer' && <Send size={18} />}
                                        {tx.type === 'bridge' && <Globe size={18} />}
                                    </div>
                                    <div>
                                        <div className="font-medium capitalize">{tx.type}</div>
                                        <div className="text-sm text-[var(--color-muted)] flex items-center gap-1">
                                            <Clock size={12} />
                                            {tx.time}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono font-medium">
                                        {hideBalances ? '••••' : tx.amount} {tx.symbol}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs justify-end">
                                        {tx.status === 'confirmed' ? (
                                            <CheckCircle2 size={12} className="text-[var(--color-success)]" />
                                        ) : (
                                            <Clock size={12} className="text-[var(--color-warning)]" />
                                        )}
                                        <span className={tx.status === 'confirmed' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>
                                            {tx.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-[var(--color-muted)]">
                            No transactions yet
                        </div>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Privacy Pool', value: '$12.4M', icon: Lock },
                    { label: 'Active Users', value: '2,341', icon: TrendingUp },
                    { label: 'Transactions Today', value: '523', icon: Zap },
                    { label: 'Supported Chains', value: supportedChains.filter(c => c.isTestnet === isTestnet).length.toString(), icon: Globe },
                ].map((stat) => (
                    <div key={stat.label} className="card text-center">
                        <stat.icon size={20} className="mx-auto text-[var(--color-muted)]" />
                        <div className="text-2xl font-bold mt-2">{stat.value}</div>
                        <div className="text-xs text-[var(--color-muted)]">{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
