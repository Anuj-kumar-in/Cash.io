import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Shield, ArrowLeftRight, Globe, Import, Play, CheckCircle, XCircle } from 'lucide-react';
import { useSDK } from '../hooks/useSDK';
import { useNetworkMode } from '../hooks/useNetworkMode';

export default function HubTest() {
    const { isConnected } = useAccount();
    const { recordTransactionOnHub } = useSDK();
    const { isTestnet } = useNetworkMode();
    const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'pending' | 'idle'>>({});
    const [logs, setLogs] = useState<string[]>([]);
    
    const hubChainName = isTestnet ? 'Cash.io Testnet' : 'Cash.io Hub';
    const hubChainId = isTestnet ? 41021 : 4102;

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const testHubRecording = async (txType: string, operation: () => Promise<void>) => {
        setTestResults(prev => ({ ...prev, [txType]: 'pending' }));
        addLog(`🧪 Testing ${txType} hub recording...`);
        
        try {
            await operation();
            setTestResults(prev => ({ ...prev, [txType]: 'success' }));
            addLog(`✅ ${txType} hub recording test PASSED`);
        } catch (error: any) {
            setTestResults(prev => ({ ...prev, [txType]: 'error' }));
            addLog(`❌ ${txType} hub recording test FAILED: ${error.message || error}`);
            console.error(`${txType} test error:`, error);
        }
    };

    const testShieldRecording = async () => {
        await testHubRecording('Shield', async () => {
            if (!recordTransactionOnHub) throw new Error('Hub recording function not available');
            
            // Mock shield operation data
            const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
            const mockNote = {
                amount: '1000000000000000000', // 1 ETH
                tokenAddress: '0x0000000000000000000000000000000000000000',
                chainId: 1,
                nullifier: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                commitment: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
            };
            
            await recordTransactionOnHub(
                mockTxHash, // txHash
                mockNote.chainId, // chainId
                0, // HubTxType.SHIELD
                '0x742dF7CcE59A86B17F0AfDDE9eA5d875cc96aB70', // mock user address
                BigInt(mockNote.amount), // amount
                mockNote.commitment, // commitment
                BigInt(Math.floor(Date.now() / 1000)), // blockNumber (use timestamp)
                mockNote.commitment, // noteHash
                true // isPrivate
            );
            
            addLog(`📝 Shield operation recorded with tx: ${mockTxHash.slice(0, 10)}...`);
        });
    };

    const testBridgeRecording = async () => {
        await testHubRecording('Bridge', async () => {
            if (!recordTransactionOnHub) throw new Error('Hub recording function not available');
            
            const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
            
            await recordTransactionOnHub(
                mockTxHash, // txHash
                137, // chainId (Polygon)
                3, // HubTxType.BRIDGE
                '0x742dF7CcE59A86B17F0AfDDE9eA5d875cc96aB70', // mock user address
                BigInt('500000000000000000'), // 0.5 ETH
                '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''), // commitment
                BigInt(Math.floor(Date.now() / 1000)), // blockNumber
                '0x0000000000000000000000000000000000000000000000000000000000000000', // noteHash
                false // isPrivate
            );
            
            addLog(`🌉 Bridge operation recorded with tx: ${mockTxHash.slice(0, 10)}...`);
        });
    };

    const testTransferRecording = async () => {
        await testHubRecording('Transfer', async () => {
            if (!recordTransactionOnHub) throw new Error('Hub recording function not available');
            
            const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
            
            await recordTransactionOnHub(
                mockTxHash, // txHash
                1, // chainId (Ethereum)
                2, // HubTxType.TRANSFER
                '0x742dF7CcE59A86B17F0AfDDE9eA5d875cc96aB70', // mock user address
                BigInt('250000000000000000'), // 0.25 ETH
                '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''), // commitment
                BigInt(Math.floor(Date.now() / 1000)), // blockNumber
                '0x0000000000000000000000000000000000000000000000000000000000000000', // noteHash
                true // isPrivate
            );
            
            addLog(`💸 Transfer operation recorded with tx: ${mockTxHash.slice(0, 10)}...`);
        });
    };

    const testNoteImportRecording = async () => {
        await testHubRecording('Note Import', async () => {
            if (!recordTransactionOnHub) throw new Error('Hub recording function not available');
            
            const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
            const mockNoteHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
            
            await recordTransactionOnHub(
                mockTxHash, // txHash
                42161, // chainId (Arbitrum)
                4, // HubTxType.NOTE_IMPORT
                '0x742dF7CcE59A86B17F0AfDDE9eA5d875cc96aB70', // mock user address
                BigInt('750000000000000000'), // 0.75 ETH
                mockNoteHash, // commitment
                BigInt(Math.floor(Date.now() / 1000)), // blockNumber
                mockNoteHash, // noteHash
                true // isPrivate
            );
            
            addLog(`📥 Note import recorded with tx: ${mockTxHash.slice(0, 10)}...`);
        });
    };

    const clearLogs = () => {
        setLogs([]);
        setTestResults({});
    };

    const testAll = async () => {
        clearLogs();
        addLog('🚀 Starting comprehensive hub recording tests...');
        
        await testShieldRecording();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay
        
        await testBridgeRecording();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await testTransferRecording();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await testNoteImportRecording();
        
        addLog('🏁 All hub recording tests completed! Check console for detailed logs.');
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success': return <CheckCircle className="text-[var(--color-success)]" size={20} />;
            case 'error': return <XCircle className="text-[var(--color-error)]" size={20} />;
            case 'pending': return <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />;
            default: return null;
        }
    };

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center animate-fade-in">
                    <div className="w-20 h-20 bg-[var(--color-subtle)] rounded-2xl flex items-center justify-center mb-6 mx-auto">
                        <span className="text-3xl">🔗</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-3 text-[var(--color-primary)]">Connect Wallet</h2>
                    <p className="text-[var(--color-muted)] mb-4 max-w-md">Please connect your wallet to test hub recording functionality.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="card">
                <h1 className="text-2xl font-bold mb-2 text-[var(--color-primary)]">{hubChainName} Recording Test Suite</h1>
                <p className="text-[var(--color-muted)] mb-6">
                    Test the hub chain transaction recording system. Each operation will be recorded on the {hubChainName} (Chain ID: {hubChainId}).
                </p>
                
                <div className={`border-2 rounded-xl p-4 mb-6 transition-all duration-150 ${
                    isTestnet 
                        ? 'bg-[var(--color-subtle)] border-[var(--color-warning)] border-opacity-30'
                        : 'bg-[var(--color-subtle)] border-[var(--color-border)]'
                }`}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-warning)] bg-opacity-10 flex items-center justify-center">
                            <span className="text-lg">⚠️</span>
                        </div>
                        <span className="font-semibold text-[var(--color-primary)]">Requirements</span>
                    </div>
                    <ul className="text-sm space-y-2 text-[var(--color-muted)] leading-relaxed">
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--color-warning)] mt-0.5">•</span>
                            {hubChainName} must be added to your MetaMask (use the Hub+ button in header)
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--color-warning)] mt-0.5">•</span>
                            You need {isTestnet ? 'SepoliaCIO' : 'CIO'} tokens for gas fees on the subnet
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--color-warning)] mt-0.5">•</span>
                            Tests will generate mock transaction data and record to hub chain
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--color-warning)] mt-0.5">•</span>
                            Check browser console for detailed transaction logs
                        </li>
                    </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={testShieldRecording}
                        disabled={testResults['Shield'] === 'pending'}
                        className="flex items-center justify-between p-4 border-2 border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] hover:bg-[var(--color-subtle)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500 bg-opacity-10 flex items-center justify-center group-hover:bg-blue-500 group-hover:bg-opacity-20 transition-colors">
                                <Shield className="text-blue-600" size={20} />
                            </div>
                            <span className="font-semibold text-[var(--color-primary)]">Test Shield Recording</span>
                        </div>
                        {getStatusIcon(testResults['Shield'])}
                    </button>

                    <button
                        onClick={testBridgeRecording}
                        disabled={testResults['Bridge'] === 'pending'}
                        className="flex items-center justify-between p-4 border-2 border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] hover:bg-[var(--color-subtle)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500 bg-opacity-10 flex items-center justify-center group-hover:bg-green-500 group-hover:bg-opacity-20 transition-colors">
                                <Globe className="text-green-600" size={20} />
                            </div>
                            <span className="font-semibold text-[var(--color-primary)]">Test Bridge Recording</span>
                        </div>
                        {getStatusIcon(testResults['Bridge'])}
                    </button>

                    <button
                        onClick={testTransferRecording}
                        disabled={testResults['Transfer'] === 'pending'}
                        className="flex items-center justify-between p-4 border-2 border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] hover:bg-[var(--color-subtle)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-500 bg-opacity-10 flex items-center justify-center group-hover:bg-orange-500 group-hover:bg-opacity-20 transition-colors">
                                <ArrowLeftRight className="text-orange-600" size={20} />
                            </div>
                            <span className="font-semibold text-[var(--color-primary)]">Test Transfer Recording</span>
                        </div>
                        {getStatusIcon(testResults['Transfer'])}
                    </button>

                    <button
                        onClick={testNoteImportRecording}
                        disabled={testResults['Note Import'] === 'pending'}
                        className="flex items-center justify-between p-4 border-2 border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] hover:bg-[var(--color-subtle)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500 bg-opacity-10 flex items-center justify-center group-hover:bg-purple-500 group-hover:bg-opacity-20 transition-colors">
                                <Import className="text-purple-600" size={20} />
                            </div>
                            <span className="font-semibold text-[var(--color-primary)]">Test Note Import Recording</span>
                        </div>
                        {getStatusIcon(testResults['Note Import'])}
                    </button>
                </div>

                <div className="flex gap-3 mb-6">
                    <button
                        onClick={testAll}
                        disabled={Object.values(testResults).some(status => status === 'pending')}
                        className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                        <Play size={16} />
                        Run All Tests
                    </button>
                    
                    <button
                        onClick={clearLogs}
                        className="btn btn-secondary flex items-center gap-2"
                    >
                        Clear Logs
                    </button>
                </div>

                {logs.length > 0 && (
                    <div className="border-2 border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-subtle)]">
                        <h3 className="font-semibold mb-4 text-[var(--color-primary)] flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-[var(--color-primary)] bg-opacity-10 flex items-center justify-center">
                                <span className="text-xs">📋</span>
                            </div>
                            Test Logs
                        </h3>
                        <div className="glass-dark text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                            {logs.map((log, index) => (
                                <div key={index} className="py-0.5">{log}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}