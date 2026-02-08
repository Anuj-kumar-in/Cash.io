import { useState } from 'react';
import { useAccount } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import {
    ArrowRight,
    Eye,
    EyeOff,
    Lock,
    Zap,
    Loader2,
    CheckCircle2,
    Copy,
    QrCode,
    Wallet,
    AlertCircle,
    Download,
} from 'lucide-react';
import { useSDK } from '../hooks/useSDK';
import { WalletModal } from '../components/WalletModal';

export default function Transfer() {
    const { isConnected, address } = useAccount();
    const { shieldedBalance, notes, transfer, isLoading: sdkLoading, error: sdkError } = useSDK();

    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    const [lastTxHash, setLastTxHash] = useState('');
    const [recipientNote, setRecipientNote] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    const shieldedBalanceFormatted = formatEther(shieldedBalance);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadNoteFile = (note: any) => {
        const noteJson = JSON.stringify(note, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2);
        const blob = new Blob([noteJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cashio-note-${note.commitment.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!amount || selectedNotes.length !== 2) {
            return;
        }

        setTxStatus('pending');

        try {
            const amountWei = parseEther(amount);

            // Calculate change
            const inputSum = selectedNotes.reduce((sum, commitment) => {
                const note = notes.find(n => n.commitment === commitment);
                return sum + (note?.amount || 0n);
            }, 0n);

            const changeAmount = inputSum - amountWei;

            if (changeAmount < 0n) {
                setTxStatus('error');
                return;
            }

            const result = await transfer(
                selectedNotes as [string, string],
                [amountWei, changeAmount],
                recipient
            );

            if (result) {
                setLastTxHash(result.transactionHash);
                setRecipientNote(result.recipientNote);
                setTxStatus('success');
            } else {
                setTxStatus('error');
            }
        } catch (err) {
            console.error(err);
            setTxStatus('error');
        }
    };

    const resetForm = () => {
        setAmount('');
        setRecipient('');
        setSelectedNotes([]);
        setNote('');
        setTxStatus('idle');
        setLastTxHash('');
        setRecipientNote(null);
    };

    const toggleNoteSelection = (commitment: string) => {
        if (selectedNotes.includes(commitment)) {
            setSelectedNotes(selectedNotes.filter(c => c !== commitment));
        } else if (selectedNotes.length < 2) {
            setSelectedNotes([...selectedNotes, commitment]);
        }
    };

    const getSelectedTotal = () => {
        return selectedNotes.reduce((sum, commitment) => {
            const note = notes.find(n => n.commitment === commitment);
            return sum + (note?.amount || 0n);
        }, 0n);
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
                    Connect your wallet to make private transfers
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
                <h1 className="text-3xl font-bold tracking-tight">Private Transfer</h1>
                <p className="text-[var(--color-muted)] mt-2">
                    Send assets privately without revealing sender or receiver
                </p>
            </div>

            {/* Privacy Badge */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
                {[
                    { icon: Eye, text: 'No sender link', off: true },
                    { icon: Eye, text: 'No receiver link', off: true },
                    { icon: Lock, text: 'Amount hidden' },
                ].map((item, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-subtle)] rounded-full text-sm"
                    >
                        {item.off ? (
                            <EyeOff size={14} className="text-[var(--color-success)]" />
                        ) : (
                            <item.icon size={14} className="text-[var(--color-success)]" />
                        )}
                        <span>{item.text}</span>
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
                        <h3 className="text-2xl font-bold mb-2">Transfer Complete!</h3>
                        <p className="text-[var(--color-muted)] mb-6">
                            Your private transfer has been processed successfully
                        </p>
                        <div className="space-y-4">
                            {lastTxHash && (
                                <div className="space-y-2">
                                    <div className="text-xs text-[var(--color-muted)] font-medium uppercase">Transaction Hash</div>
                                    <div className="flex items-center justify-center gap-2 bg-[var(--color-subtle)] px-4 py-2 rounded-lg font-mono text-sm">
                                        <span>{lastTxHash.slice(0, 10)}...{lastTxHash.slice(-6)}</span>
                                        <button
                                            onClick={() => handleCopy(lastTxHash)}
                                            className="hover:text-[var(--color-muted)] transition-colors"
                                        >
                                            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {recipientNote && (
                                <div className="p-4 bg-[var(--color-warning)]/10 rounded-xl border border-[var(--color-warning)]/20 text-left">
                                    <div className="flex items-center gap-2 mb-2 text-[var(--color-warning)]">
                                        <AlertCircle size={18} />
                                        <span className="font-bold text-sm">Action Required: Share Note with Recipient</span>
                                    </div>
                                    <p className="text-xs text-[var(--color-muted)] mb-3">
                                        This is a private transfer. The recipient needs this Note Secret to claim their assets in their Cash.io wallet.
                                    </p>
                                    <div className="flex items-center gap-2 bg-[var(--color-subtle)] p-3 rounded-lg font-mono text-[10px] break-all border border-black/5">
                                        <div className="flex-1 opacity-60">
                                            {JSON.stringify(recipientNote, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 50)}...
                                        </div>
                                        <button
                                            onClick={() => downloadNoteFile(recipientNote)}
                                            className="btn btn-primary btn-sm h-8"
                                        >
                                            <Download size={14} className="mr-1" />
                                            Download
                                        </button>
                                        <button
                                            onClick={() => handleCopy(JSON.stringify(recipientNote, (k, v) => typeof v === 'bigint' ? v.toString() : v))}
                                            className="btn btn-secondary btn-sm h-8"
                                        >
                                            {copied ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-[var(--color-muted)] mt-2 italic">
                                        Recipient should go to Settings &gt; Import Note to claim.
                                    </p>
                                </div>
                            )}
                            <div className="flex items-center justify-center gap-3 text-sm text-[var(--color-muted)]">
                                <div className="flex items-center gap-1">
                                    <EyeOff size={14} />
                                    <span>Sender hidden</span>
                                </div>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                    <EyeOff size={14} />
                                    <span>Receiver hidden</span>
                                </div>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                    <Lock size={14} />
                                    <span>Amount hidden</span>
                                </div>
                            </div>
                            <button onClick={resetForm} className="btn btn-primary mt-4">
                                Send Another Transfer
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
                                <span>{sdkError || 'Transfer failed. Please try again.'}</span>
                            </div>
                        )}

                        {/* Shielded Balance */}
                        <div className="flex items-center justify-between p-4 bg-black text-white rounded-xl">
                            <div>
                                <span className="text-sm text-white/60">Available Shielded Balance</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-bold">{parseFloat(shieldedBalanceFormatted).toFixed(4)}</span>
                                    <span className="text-white/60">ETH</span>
                                </div>
                            </div>
                            <Lock size={24} className="text-white/40" />
                        </div>

                        {/* Note Selection (2-in-2-out requires 2 inputs) */}
                        {notes.length >= 2 ? (
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Select 2 Notes for Transfer (2-in-2-out)
                                </label>
                                <div className="space-y-2">
                                    {notes.map((noteItem, i) => (
                                        <button
                                            key={noteItem.commitment}
                                            type="button"
                                            onClick={() => toggleNoteSelection(noteItem.commitment)}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${selectedNotes.includes(noteItem.commitment)
                                                ? 'border-black bg-[var(--color-subtle)]'
                                                : 'border-[var(--color-border)] hover:border-[var(--color-muted)]'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedNotes.includes(noteItem.commitment)
                                                    ? 'border-black bg-black'
                                                    : 'border-[var(--color-border)]'
                                                    }`}>
                                                    {selectedNotes.includes(noteItem.commitment) && (
                                                        <CheckCircle2 size={14} className="text-white" />
                                                    )}
                                                </div>
                                                <span className="font-medium">Note #{i + 1}</span>
                                            </div>
                                            <span className="font-mono font-medium">
                                                {parseFloat(formatEther(noteItem.amount)).toFixed(4)} ETH
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                {selectedNotes.length === 2 && (
                                    <div className="mt-2 text-sm text-[var(--color-success)]">
                                        ✓ Selected total: {parseFloat(formatEther(getSelectedTotal())).toFixed(4)} ETH
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 bg-[var(--color-warning)]/10 text-[var(--color-warning)] rounded-xl text-sm">
                                <AlertCircle size={18} className="inline mr-2" />
                                You need at least 2 shielded notes to make a transfer. Shield more assets first.
                            </div>
                        )}

                        {/* Amount Input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Amount to Send</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.0"
                                    className="input text-2xl font-mono pr-24"
                                    step="0.0001"
                                    min="0"
                                    max={formatEther(getSelectedTotal())}
                                    required
                                    disabled={selectedNotes.length !== 2}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAmount(formatEther(getSelectedTotal()))}
                                        disabled={selectedNotes.length !== 2}
                                        className="px-3 py-1 bg-black text-white text-xs font-semibold rounded-md hover:bg-[var(--color-accent)] transition-colors disabled:opacity-50"
                                    >
                                        MAX
                                    </button>
                                    <span className="text-[var(--color-muted)] font-medium">ETH</span>
                                </div>
                            </div>
                            {selectedNotes.length === 2 && amount && (
                                <div className="mt-2 text-sm text-[var(--color-muted)]">
                                    Change returned to you: {(parseFloat(formatEther(getSelectedTotal())) - parseFloat(amount)).toFixed(4)} ETH
                                </div>
                            )}
                        </div>

                        {/* Recipient Input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Recipient Shielded Address</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    placeholder="cash1q84jh..."
                                    className="input font-mono pr-24"
                                    required
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="p-2 hover:bg-[var(--color-subtle)] rounded-lg transition-colors"
                                        title="Scan QR"
                                    >
                                        <QrCode size={18} className="text-[var(--color-muted)]" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-[var(--color-muted)] mt-2">
                                Shielded addresses start with "cash1" and are used for private transfers
                            </p>
                        </div>

                        {/* Note (Optional) */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Encrypted Note <span className="text-[var(--color-muted)]">(Optional)</span>
                            </label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add an encrypted message for the recipient..."
                                className="input resize-none"
                                rows={3}
                            />
                            <p className="text-xs text-[var(--color-muted)] mt-2">
                                Note is encrypted and only readable by the recipient
                            </p>
                        </div>

                        {/* Privacy Info */}
                        <div className="flex items-start gap-3 p-4 bg-[var(--color-subtle)] rounded-xl">
                            <Zap size={20} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
                            <div className="text-sm text-[var(--color-muted)]">
                                <strong className="text-black">Private 2-in-2-out Transfer:</strong> This
                                transaction uses ZK proofs to privately transfer value. Neither the sender,
                                receiver, nor the amount are visible on-chain.
                            </div>
                        </div>

                        {/* Fee Breakdown */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--color-muted)]">Network Fee</span>
                                <span className="font-mono">~0.003 ETH</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--color-muted)]">Relayer Fee</span>
                                <span className="font-mono">0.1%</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-[var(--color-border)]">
                                <span>Total Received</span>
                                <span className="font-mono">
                                    {amount ? (parseFloat(amount) * 0.999).toFixed(4) : '0.0000'} ETH
                                </span>
                            </div>
                        </div>

                        <hr className="divider" />

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={sdkLoading || txStatus === 'pending' || !amount || !recipient || selectedNotes.length !== 2}
                            className="btn btn-primary btn-lg w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sdkLoading || txStatus === 'pending' ? (
                                <>
                                    <Loader2 size={20} className="mr-2 animate-spin" />
                                    Generating ZK Proof...
                                </>
                            ) : (
                                <>
                                    <ArrowRight size={20} className="mr-2" />
                                    Send Private Transfer
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    {
                        icon: Lock,
                        title: 'Zero Knowledge',
                        desc: 'Proofs verify validity without revealing data',
                    },
                    {
                        icon: Zap,
                        title: 'Instant Finality',
                        desc: 'Transfers confirmed within seconds',
                    },
                ].map((feature) => (
                    <div
                        key={feature.title}
                        className="card flex items-start gap-4"
                    >
                        <div className="w-10 h-10 bg-[var(--color-subtle)] rounded-lg flex items-center justify-center shrink-0">
                            <feature.icon size={20} />
                        </div>
                        <div>
                            <h4 className="font-semibold">{feature.title}</h4>
                            <p className="text-sm text-[var(--color-muted)]">{feature.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
