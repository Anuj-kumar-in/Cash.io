import { useState, useEffect } from 'react';
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useSearchParams } from 'react-router-dom';
import {
    Shield as ShieldIcon,
    ArrowDownRight,
    ArrowUpRight,
    Info,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Copy,
    ExternalLink,
    Wallet,
} from 'lucide-react';
import { useSDK } from '../hooks/useSDK';
import { WalletModal } from '../components/WalletModal';

type Tab = 'shield' | 'unshield';

export default function Shield() {
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') === 'unshield' ? 'unshield' : 'shield';

    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    const [selectedNote, setSelectedNote] = useState<string>('');
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const { isConnected, address } = useAccount();
    const { data: balance } = useBalance({ address });
    const { shieldedBalance, notes, deposit, withdraw, isLoading: sdkLoading, error: sdkError } = useSDK();

    const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    const [lastTxHash, setLastTxHash] = useState<string>('');

    const publicBalance = balance ? balance.formatted : '0';
    const shieldedBalanceFormatted = formatEther(shieldedBalance);
    const maxAmount = activeTab === 'shield' ? publicBalance : shieldedBalanceFormatted;

    // Update recipient to connected address by default for unshield
    useEffect(() => {
        if (activeTab === 'unshield' && address && !recipient) {
            setRecipient(address);
        }
    }, [activeTab, address, recipient]);

    const handleMaxClick = () => {
        setAmount(maxAmount);
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!amount || parseFloat(amount) <= 0) {
            return;
        }

        setTxStatus('pending');

        try {
            if (activeTab === 'shield') {
                // Shield (deposit)
                const amountWei = parseEther(amount);
                const result = await deposit(amountWei);

                if (result) {
                    setLastTxHash(result.transactionHash);
                    setTxStatus('success');
                } else {
                    setTxStatus('error');
                }
            } else {
                // Unshield (withdraw)
                if (!selectedNote || !recipient) {
                    setTxStatus('error');
                    return;
                }

                const result = await withdraw(selectedNote, recipient);

                if (result) {
                    setLastTxHash(result.transactionHash);
                    setTxStatus('success');
                } else {
                    setTxStatus('error');
                }
            }
        } catch (err) {
            console.error(err);
            setTxStatus('error');
        }
    };

    const resetForm = () => {
        setAmount('');
        setRecipient(address || '');
        setSelectedNote('');
        setTxStatus('idle');
        setLastTxHash('');
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
                    Connect your wallet to shield or unshield assets
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
                <h1 className="text-3xl font-bold tracking-tight">Shield & Unshield</h1>
                <p className="text-[var(--color-muted)] mt-2">
                    Deposit assets privately or withdraw to a public address
                </p>
            </div>

            {/* Tab Selector */}
            <div className="flex bg-[var(--color-subtle)] rounded-xl p-1.5">
                {[
                    { id: 'shield', label: 'Shield', icon: ArrowDownRight },
                    { id: 'unshield', label: 'Unshield', icon: ArrowUpRight },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id as Tab);
                            resetForm();
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id
                                ? 'bg-black text-white shadow-lg'
                                : 'text-[var(--color-muted)] hover:text-black'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
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
                        <h3 className="text-2xl font-bold mb-2">
                            {activeTab === 'shield' ? 'Assets Shielded!' : 'Assets Unshielded!'}
                        </h3>
                        <p className="text-[var(--color-muted)] mb-6">
                            {activeTab === 'shield'
                                ? 'Your assets are now private and unlinkable'
                                : 'Your assets have been withdrawn to the specified address'}
                        </p>
                        <div className="flex flex-col items-center gap-4">
                            {lastTxHash && (
                                <div className="flex items-center gap-2 bg-[var(--color-subtle)] px-4 py-2 rounded-lg font-mono text-sm">
                                    <span>{lastTxHash.slice(0, 10)}...{lastTxHash.slice(-6)}</span>
                                    <button
                                        onClick={() => handleCopy(lastTxHash)}
                                        className="hover:text-[var(--color-muted)] transition-colors"
                                    >
                                        {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={resetForm}
                                className="btn btn-primary"
                            >
                                {activeTab === 'shield' ? 'Shield More' : 'Unshield More'}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Form State */
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Display */}
                        {(txStatus === 'error' || sdkError) && (
                            <div className="flex items-center gap-2 p-4 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded-xl text-sm">
                                <AlertCircle size={18} />
                                <span>{sdkError || 'Transaction failed. Please try again.'}</span>
                            </div>
                        )}

                        {/* Balance Info */}
                        <div className="flex items-center justify-between p-4 bg-[var(--color-subtle)] rounded-xl">
                            <div>
                                <span className="text-sm text-[var(--color-muted)]">
                                    {activeTab === 'shield' ? 'Public Balance' : 'Shielded Balance'}
                                </span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-bold">
                                        {parseFloat(maxAmount).toFixed(4)}
                                    </span>
                                    <span className="text-[var(--color-muted)]">{balance?.symbol || 'ETH'}</span>
                                </div>
                            </div>
                            <ShieldIcon size={24} className="text-[var(--color-muted)]" />
                        </div>

                        {/* Note Selection (for unshield) */}
                        {activeTab === 'unshield' && notes.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium mb-2">Select Note to Unshield</label>
                                <select
                                    value={selectedNote}
                                    onChange={(e) => {
                                        setSelectedNote(e.target.value);
                                        const note = notes.find(n => n.commitment === e.target.value);
                                        if (note) {
                                            setAmount(formatEther(note.amount));
                                        }
                                    }}
                                    className="input"
                                    required
                                >
                                    <option value="">Select a note...</option>
                                    {notes.map((note, i) => (
                                        <option key={note.commitment} value={note.commitment}>
                                            Note #{i + 1} - {parseFloat(formatEther(note.amount)).toFixed(4)} ETH
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {activeTab === 'unshield' && notes.length === 0 && (
                            <div className="p-4 bg-[var(--color-warning)]/10 text-[var(--color-warning)] rounded-xl text-sm">
                                <AlertCircle size={18} className="inline mr-2" />
                                No shielded notes available. Shield some assets first.
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
                                    min="0"
                                    max={maxAmount}
                                    required
                                    disabled={activeTab === 'unshield'}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {activeTab === 'shield' && (
                                        <button
                                            type="button"
                                            onClick={handleMaxClick}
                                            className="px-3 py-1 bg-black text-white text-xs font-semibold rounded-md hover:bg-[var(--color-accent)] transition-colors"
                                        >
                                            MAX
                                        </button>
                                    )}
                                    <span className="text-[var(--color-muted)] font-medium">{balance?.symbol || 'ETH'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Recipient (for unshield only) */}
                        {activeTab === 'unshield' && (
                            <div>
                                <label className="block text-sm font-medium mb-2">Recipient Address</label>
                                <input
                                    type="text"
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    placeholder="0x..."
                                    className="input font-mono"
                                    required
                                />
                            </div>
                        )}

                        {/* Info Box */}
                        <div className="flex items-start gap-3 p-4 bg-[var(--color-subtle)] rounded-xl">
                            <Info size={20} className="text-[var(--color-muted)] shrink-0 mt-0.5" />
                            <div className="text-sm text-[var(--color-muted)]">
                                {activeTab === 'shield' ? (
                                    <>
                                        Shielding converts your public assets into private notes within the
                                        shielded pool. Once shielded, your balance becomes unlinkable to your
                                        public address.
                                    </>
                                ) : (
                                    <>
                                        Unshielding withdraws assets from the private pool to a public address.
                                        A ZK proof is generated to verify ownership without revealing your
                                        private balance.
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Fee Estimation */}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--color-muted)]">Network Fee</span>
                            <span className="font-mono">~0.002 ETH</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--color-muted)]">Relayer Fee</span>
                            <span className="font-mono">0.1%</span>
                        </div>

                        <hr className="divider" />

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={sdkLoading || txStatus === 'pending' || !amount || (activeTab === 'unshield' && (!selectedNote || !recipient))}
                            className="btn btn-primary btn-lg w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sdkLoading || txStatus === 'pending' ? (
                                <>
                                    <Loader2 size={20} className="mr-2 animate-spin" />
                                    {activeTab === 'shield' ? 'Shielding...' : 'Generating ZK Proof...'}
                                </>
                            ) : (
                                <>
                                    <ShieldIcon size={20} className="mr-2" />
                                    {activeTab === 'shield' ? 'Shield Assets' : 'Unshield Assets'}
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>

            {/* How It Works */}
            <div className="space-y-4">
                <h3 className="font-bold text-center">How it works</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        {
                            step: '01',
                            title: 'Enter Amount',
                            desc: 'Specify how much you want to shield or unshield',
                        },
                        {
                            step: '02',
                            title: 'Generate Proof',
                            desc: 'A ZK-SNARK proof is generated locally in your browser',
                        },
                        {
                            step: '03',
                            title: 'Submit Transaction',
                            desc: 'The proof is verified on-chain, completing the operation',
                        },
                    ].map((item) => (
                        <div key={item.step} className="card text-center py-6">
                            <span className="text-4xl font-bold text-[var(--color-subtle)]">{item.step}</span>
                            <h4 className="font-semibold mt-2">{item.title}</h4>
                            <p className="text-sm text-[var(--color-muted)] mt-1">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
