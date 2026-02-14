import { useState, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import {
    FlaskConical,
    Shield,
    ArrowRightLeft,
    Code,
    Trash2,
    Search,
    RefreshCw,
    Download,
    Database,
    Zap,
    Plus
} from 'lucide-react';
import { useSDK } from '../hooks/useSDK';
import { getChainById } from '../config/chains';

export default function Sandbox() {
    const { isConnected, address } = useAccount();
    const chainId = useChainId();
    const {
        allNotes,
        shieldedBalance,
        deposit,
        withdraw,
        transfer,
        exportNotes,
        recordTransactionOnHub
    } = useSDK();

    const [logs, setLogs] = useState<string[]>([]);
    const [mockAmount, setMockAmount] = useState('0.1');
    const [isExecuting, setIsExecuting] = useState(false);

    const addLog = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
        const time = new Date().toLocaleTimeString();
        const prefix = type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : '🔹 ';
        setLogs(prev => [`${time}: ${prefix}${msg}`, ...prev].slice(0, 100));
    }, []);

    const clearLogs = () => setLogs([]);

    const handleAction = async (name: string, action: () => Promise<any>) => {
        if (isExecuting) return;
        setIsExecuting(true);
        addLog(`Initiating action: ${name}...`);
        try {
            const result = await action();
            addLog(`Action ${name} completed successfully!`, 'success');
            if (result && typeof result === 'object') {
                console.log(`Sandbox [${name}] Result:`, result);
            }
        } catch (error: any) {
            addLog(`Action ${name} failed: ${error.message || error}`, 'error');
            console.error(`Sandbox [${name}] Error:`, error);
        } finally {
            setIsExecuting(false);
        }
    };

    const runMockDeposit = () => handleAction('Deposit', () => deposit(parseEther(mockAmount)));

    const runMockWithdraw = () => {
        if (allNotes.length === 0) return addLog('No notes available to withdraw', 'error');
        const note = allNotes[0];
        return handleAction('Withdraw', () => withdraw(note.commitment, address as `0x${string}`));
    };

    const runMockTransfer = () => {
        if (allNotes.length < 2) return addLog('Need at least 2 notes for 2-in-2-out transfer simulation', 'error');
        return handleAction('Transfer', () => transfer(
            [allNotes[0].commitment, allNotes[1].commitment],
            [parseEther(mockAmount), 0n],
            address as `0x${string}`
        ));
    };

    const runHubRecording = () => {
        if (!recordTransactionOnHub) return addLog('Hub recording functionality not available', 'error');
        return handleAction('Hub Recording', async () => {
            const mockHash = '0x' + Math.random().toString(16).slice(2).padStart(64, '0');
            return recordTransactionOnHub!(
                mockHash as `0x${string}`,
                chainId,
                0, // SHIELD
                address as `0x${string}`,
                parseEther('1'),
                '0x' + Math.random().toString(16).slice(2).padStart(64, '0'),
                BigInt(Date.now()),
                '0x' + Math.random().toString(16).slice(2).padStart(64, '0'),
                true
            );
        });
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
                <div className="w-20 h-20 bg-[var(--color-subtle)] rounded-3xl flex items-center justify-center mb-6">
                    <FlaskConical size={40} className="text-[var(--color-muted)]" />
                </div>
                <h1 className="text-3xl font-bold mb-3">SDK Sandbox</h1>
                <p className="text-[var(--color-muted)] mb-8 max-w-md">
                    Connect your wallet to interact directly with the Cash.io SDK methods.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <FlaskConical className="text-amber-500" />
                    SDK Sandbox
                </h1>
                <p className="text-[var(--color-muted)] mt-1">
                    Direct access to Cash.io Protocol core functionality for testing and debugging.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Controller Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Zap className="text-yellow-500" size={20} />
                                SDK Methods
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-[var(--color-muted)]">Amount:</span>
                                <input
                                    type="text"
                                    value={mockAmount}
                                    onChange={(e) => setMockAmount(e.target.value)}
                                    className="w-20 px-2 py-1 bg-[var(--color-subtle)] border-none rounded-md font-mono text-sm focus:ring-1 ring-amber-500 transition-all"
                                />
                                <span className="text-xs font-medium">{getChainById(chainId)?.symbol || 'ETH'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Deposit */}
                            <button
                                onClick={runMockDeposit}
                                disabled={isExecuting}
                                className="flex flex-col items-start p-4 bg-[var(--color-subtle)] rounded-xl border border-transparent hover:border-amber-500/30 transition-all text-left group"
                            >
                                <Shield className="mb-3 text-blue-500 group-hover:scale-110 transition-transform" size={24} />
                                <span className="font-bold">sdk.deposit()</span>
                                <span className="text-xs text-[var(--color-muted)] mt-1">Shield public assets into a new private note</span>
                            </button>

                            {/* Withdraw */}
                            <button
                                onClick={runMockWithdraw}
                                disabled={isExecuting || allNotes.length === 0}
                                className="flex flex-col items-start p-4 bg-[var(--color-subtle)] rounded-xl border border-transparent hover:border-amber-500/30 transition-all text-left group disabled:opacity-50"
                            >
                                <RefreshCw className="mb-3 text-emerald-500 group-hover:scale-110 transition-transform" size={24} />
                                <span className="font-bold">sdk.withdraw()</span>
                                <span className="text-xs text-[var(--color-muted)] mt-1">Unshield a private note back to public address</span>
                            </button>

                            {/* Transfer */}
                            <button
                                onClick={runMockTransfer}
                                disabled={isExecuting || allNotes.length === 0}
                                className="flex flex-col items-start p-4 bg-[var(--color-subtle)] rounded-xl border border-transparent hover:border-amber-500/30 transition-all text-left group disabled:opacity-50"
                            >
                                <ArrowRightLeft className="mb-3 text-purple-500 group-hover:scale-110 transition-transform" size={24} />
                                <span className="font-bold">sdk.transfer()</span>
                                <span className="text-xs text-[var(--color-muted)] mt-1">Perform 2-in-2-out private ZK transfer</span>
                            </button>

                            {/* Hub Recording */}
                            <button
                                onClick={runHubRecording}
                                disabled={isExecuting}
                                className="flex flex-col items-start p-4 bg-[var(--color-subtle)] rounded-xl border border-transparent hover:border-amber-500/30 transition-all text-left group"
                            >
                                <Database className="mb-3 text-orange-500 group-hover:scale-110 transition-transform" size={24} />
                                <span className="font-bold">sdk.recordOnHub()</span>
                                <span className="text-xs text-[var(--color-muted)] mt-1">Manually push state sync to the Hub chain</span>
                            </button>
                        </div>

                        <div className="pt-4 border-t border-[var(--color-border)] flex items-center gap-4">
                            <button
                                onClick={() => {
                                    const exported = exportNotes();
                                    addLog(`Exported ${exported.length} notes (check console)`);
                                    console.table(exported);
                                }}
                                className="btn btn-secondary btn-sm"
                            >
                                <Download size={14} className="mr-2" />
                                Export SDK State
                            </button>
                            <span className="text-xs text-[var(--color-muted)]">
                                Current Wallet: <span className="font-mono text-[var(--color-primary)]">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                            </span>
                        </div>
                    </div>

                    {/* Simulation Logs */}
                    <div className="card space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Code size={20} className="text-indigo-500" />
                                Execution Logs
                            </h2>
                            <button
                                onClick={clearLogs}
                                className="p-1.5 hover:bg-[var(--color-subtle)] rounded-md text-[var(--color-muted)] hover:text-red-500 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <div className="h-64 bg-black/90 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-1.5 scrollbar-thin">
                            {logs.length > 0 ? logs.map((log, i) => (
                                <div key={i} className="text-green-400 break-all border-l border-green-900/50 pl-2">
                                    {log}
                                </div>
                            )) : (
                                <div className="text-white/20 h-full flex items-center justify-center italic">
                                    Awaiting action logs...
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info & State Path */}
                <div className="space-y-6">
                    {/* Current State Stats */}
                    <div className="card bg-black text-white">
                        <h3 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2 uppercase tracking-widest">
                            <Search size={14} />
                            Active SDK State
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                <span className="text-xs text-white/40">Shielded Balance</span>
                                <span className="text-xl font-bold font-mono">{formatEther(shieldedBalance)}</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                <span className="text-xs text-white/40">Active Notes</span>
                                <span className="text-xl font-bold font-mono">{allNotes.length}</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                <span className="text-xs text-white/40">Network Domain</span>
                                <span className="text-xl font-bold font-mono">{getChainById(chainId)?.name.split(' ')[0]}</span>
                            </div>
                        </div>
                    </div>

                    {/* Developer Note */}
                    <div className="card border-amber-500/20 bg-amber-500/5 p-5">
                        <h3 className="font-bold text-amber-600 flex items-center gap-2 mb-2">
                            <Plus size={16} />
                            Developer Notice
                        </h3>
                        <p className="text-sm text-amber-800/70 leading-relaxed">
                            This sandbox bypasses UI safety checks and interacts directly with the
                            <code className="bg-amber-100 px-1 rounded mx-1 text-amber-900 font-mono text-xs">useSDK</code>
                            hook. Use carefully when dealing with mainnet funds.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
