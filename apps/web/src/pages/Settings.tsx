import { useState } from 'react';
import { useAccount, useBalance, useChainId, useDisconnect } from 'wagmi';
import { formatEther } from 'viem';
import {
    Settings as SettingsIcon,
    Wallet,
    Shield,
    Key,
    Bell,
    Moon,
    Globe,
    Copy,
    ExternalLink,
    ChevronRight,
    AlertTriangle,
    Lock,
    Download,
    Upload,
    Trash2,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';
import { useSDK } from '../hooks/useSDK';
import { WalletModal } from '../components/WalletModal';
import { cashSubnet } from '../config/wagmi';

export default function Settings() {
    const { isConnected, address } = useAccount();
    const { data: balance } = useBalance({ address });
    const chainId = useChainId();
    const { disconnect } = useDisconnect();
    const { notes, shieldedBalance, exportNotes, importNote } = useSDK();

    const [copied, setCopied] = useState(false);
    const [showRecovery, setShowRecovery] = useState(false);
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setSuccessMessage('Copied to clipboard!');
        setTimeout(() => {
            setCopied(false);
            setSuccessMessage(null);
        }, 2000);
    };

    const handleExportNotes = () => {
        const allNotes = exportNotes();
        const blob = new Blob([JSON.stringify(allNotes, (key, value) => {
            if (key === 'amount') return value.toString();
            return value;
        }, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cash-notes-${address?.slice(0, 8)}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccessMessage('Notes exported successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const handleImportNotes = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const text = await file.text();
                try {
                    const importedNotes = JSON.parse(text, (key, value) => {
                        if (key === 'amount') return BigInt(value);
                        return value;
                    });
                    importedNotes.forEach((note: any) => importNote(note));
                    setSuccessMessage(`Imported ${importedNotes.length} notes!`);
                    setTimeout(() => setSuccessMessage(null), 3000);
                } catch (err) {
                    console.error('Failed to import notes:', err);
                }
            }
        };
        input.click();
    };

    const getNetworkName = (id: number) => {
        const networks: Record<number, string> = {
            1: 'Ethereum Mainnet',
            11155111: 'Sepolia Testnet',
            43114: 'Avalanche C-Chain',
            43113: 'Fuji Testnet',
            137: 'Polygon',
            42161: 'Arbitrum One',
            [cashSubnet.id]: 'Cash.io Subnet',
        };
        return networks[id] || `Chain ${id}`;
    };

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    // Not connected state
    if (!isConnected) {
        return (
            <div className="max-w-2xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-20 h-20 bg-[var(--color-subtle)] rounded-2xl flex items-center justify-center mb-6">
                    <Wallet size={40} className="text-[var(--color-muted)]" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                <p className="text-[var(--color-muted)] mb-6 max-w-md">
                    Connect your wallet to manage your settings
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
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-[var(--color-muted)] mt-1">
                    Manage your account, security, and preferences
                </p>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="flex items-center gap-2 p-4 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-xl">
                    <CheckCircle2 size={18} />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Account Section */}
            <div className="card">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[var(--color-subtle)] rounded-lg flex items-center justify-center">
                        <Wallet size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Wallet</h2>
                        <p className="text-sm text-[var(--color-muted)]">Your connected wallet details</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Address */}
                    <div className="flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl">
                        <div>
                            <span className="text-sm text-[var(--color-muted)]">Connected Address</span>
                            <div className="font-mono font-medium mt-1">
                                {address}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleCopy(address || '')}
                                className="p-2 hover:bg-white rounded-lg transition-colors"
                            >
                                {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                            </button>
                            <a
                                href={`https://snowtrace.io/address/${address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-white rounded-lg transition-colors"
                            >
                                <ExternalLink size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Network */}
                    <div className="flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl">
                        <div>
                            <span className="text-sm text-[var(--color-muted)]">Network</span>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 bg-[var(--color-success)] rounded-full" />
                                <span className="font-medium">{getNetworkName(chainId)}</span>
                            </div>
                        </div>
                        <span className="font-mono text-sm text-[var(--color-muted)]">ID: {chainId}</span>
                    </div>

                    {/* Balances */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-[var(--color-subtle)] rounded-xl">
                            <span className="text-sm text-[var(--color-muted)]">Public Balance</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xl font-bold">
                                    {balance ? parseFloat(balance.formatted).toFixed(4) : '0.0000'}
                                </span>
                                <span className="text-sm text-[var(--color-muted)]">{balance?.symbol || 'ETH'}</span>
                            </div>
                        </div>
                        <div className="p-4 bg-black text-white rounded-xl">
                            <span className="text-sm text-white/60">Shielded Balance</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xl font-bold">
                                    {parseFloat(formatEther(shieldedBalance)).toFixed(4)}
                                </span>
                                <span className="text-sm text-white/60">ETH</span>
                            </div>
                        </div>
                    </div>

                    {/* Disconnect */}
                    <button
                        onClick={() => disconnect()}
                        className="w-full btn btn-secondary"
                    >
                        Disconnect Wallet
                    </button>
                </div>
            </div>

            {/* Security Section */}
            <div className="card">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[var(--color-subtle)] rounded-lg flex items-center justify-center">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Notes & Backup</h2>
                        <p className="text-sm text-[var(--color-muted)]">Manage your shielded notes</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Notes Count */}
                    <div className="flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl">
                        <div className="flex items-center gap-3">
                            <Lock size={20} className="text-[var(--color-muted)]" />
                            <div>
                                <span className="font-medium">Shielded Notes</span>
                                <p className="text-sm text-[var(--color-muted)]">
                                    {notes.length} note{notes.length !== 1 ? 's' : ''} stored locally
                                </p>
                            </div>
                        </div>
                        <span className="badge badge-neutral">{notes.length}</span>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={handleExportNotes}
                        disabled={notes.length === 0}
                        className="w-full flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <Download size={20} className="text-[var(--color-muted)]" />
                            <div className="text-left">
                                <span className="font-medium">Export Notes</span>
                                <p className="text-sm text-[var(--color-muted)]">
                                    Download your notes as a backup file
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-[var(--color-muted)]" />
                    </button>

                    {/* Import Button */}
                    <button
                        onClick={handleImportNotes}
                        className="w-full flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl hover:bg-[var(--color-border)] transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Upload size={20} className="text-[var(--color-muted)]" />
                            <div className="text-left">
                                <span className="font-medium">Import Notes</span>
                                <p className="text-sm text-[var(--color-muted)]">
                                    Restore notes from a backup file
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-[var(--color-muted)]" />
                    </button>

                    {/* Warning */}
                    <div className="flex items-start gap-3 p-4 bg-[var(--color-warning)]/10 rounded-xl">
                        <AlertTriangle size={20} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <strong className="text-[var(--color-warning)]">Important:</strong>{' '}
                            <span className="text-[var(--color-muted)]">
                                Your shielded notes are stored locally. If you clear browser data or lose
                                access to this device, you'll need a backup to recover your assets.
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preferences Section */}
            <div className="card">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[var(--color-subtle)] rounded-lg flex items-center justify-center">
                        <SettingsIcon size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Preferences</h2>
                        <p className="text-sm text-[var(--color-muted)]">Customize your experience</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Dark Mode */}
                    <div className="flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl">
                        <div className="flex items-center gap-3">
                            <Moon size={20} className="text-[var(--color-muted)]" />
                            <div>
                                <span className="font-medium">Dark Mode</span>
                                <p className="text-sm text-[var(--color-muted)]">Coming soon</p>
                            </div>
                        </div>
                        <button
                            disabled
                            className={`w-12 h-6 rounded-full transition-all ${darkMode ? 'bg-black' : 'bg-[var(--color-border)]'
                                } relative opacity-50`}
                        >
                            <div
                                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${darkMode ? 'right-0.5' : 'left-0.5'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Notifications */}
                    <div className="flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl">
                        <div className="flex items-center gap-3">
                            <Bell size={20} className="text-[var(--color-muted)]" />
                            <div>
                                <span className="font-medium">Notifications</span>
                                <p className="text-sm text-[var(--color-muted)]">Transaction alerts</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setNotifications(!notifications)}
                            className={`w-12 h-6 rounded-full transition-all ${notifications ? 'bg-black' : 'bg-[var(--color-border)]'
                                } relative`}
                        >
                            <div
                                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${notifications ? 'right-0.5' : 'left-0.5'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Currency */}
                    <div className="flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl">
                        <div className="flex items-center gap-3">
                            <Globe size={20} className="text-[var(--color-muted)]" />
                            <div>
                                <span className="font-medium">Display Currency</span>
                                <p className="text-sm text-[var(--color-muted)]">ETH values shown</p>
                            </div>
                        </div>
                        <span className="badge badge-neutral">ETH</span>
                    </div>
                </div>
            </div>

            {/* Resources */}
            <div className="card">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[var(--color-subtle)] rounded-lg flex items-center justify-center">
                        <ExternalLink size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Resources</h2>
                        <p className="text-sm text-[var(--color-muted)]">Learn more about Cash.io</p>
                    </div>
                </div>

                <div className="space-y-2">
                    {[
                        { label: 'Documentation', url: 'https://docs.cash.io' },
                        { label: 'GitHub', url: 'https://github.com/cash-io' },
                        { label: 'Discord', url: 'https://discord.gg/cashio' },
                        { label: 'Twitter', url: 'https://twitter.com/cashio' },
                    ].map((link) => (
                        <a
                            key={link.label}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 hover:bg-[var(--color-subtle)] rounded-xl transition-colors"
                        >
                            <span className="font-medium">{link.label}</span>
                            <ExternalLink size={16} className="text-[var(--color-muted)]" />
                        </a>
                    ))}
                </div>
            </div>

            {/* Version */}
            <div className="text-center text-sm text-[var(--color-muted)] pb-8">
                Cash.io Protocol v1.0.0 • Built on Avalanche
            </div>
        </div>
    );
}
