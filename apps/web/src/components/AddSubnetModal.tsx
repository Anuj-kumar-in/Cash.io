import { useState } from 'react';
import { Plus, Copy, Check } from 'lucide-react';
import { useNetworkMode } from '../hooks/useNetworkMode';

declare global {
    interface Window {
        ethereum?: {
            request: (args: any) => Promise<any>;
        };
    }
}

interface AddSubnetModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Mainnet Subnet Configuration (Chain ID: 4102)
const MAINNET_SUBNET_CONFIG = {
    chainId: '0x1006', // 4102 in hex
    chainName: 'Cash.io Hub',
    nativeCurrency: {
        name: 'CIO Token',
        symbol: 'CIO',
        decimals: 18,
    },
    rpcUrls: [import.meta.env.VITE_HUB_RPC_URL || 'http://127.0.0.1:9654/ext/bc/weCGw5ozNbEzW1CSvyJ15g1ZnLzcpjxKHjhbV1EVMQQKKa2CM/rpc'],
    blockExplorerUrls: ['https://explorer.cash.io'],
    iconUrls: ['https://cash.io/icon.png'],
};

// Testnet Subnet Configuration (Chain ID: 41021)
const TESTNET_SUBNET_CONFIG = {
    chainId: '0xA025', // 41021 in hex
    chainName: 'Cash.io Testnet',
    nativeCurrency: {
        name: 'Sepolia CIO Token',
        symbol: 'SepoliaCIO',
        decimals: 18,
    },
    rpcUrls: [import.meta.env.VITE_TESTNET_HUB_RPC_URL || 'http://127.0.0.1:9656/ext/bc/2kncNH6LugUTEWwiV87AijZhN2zd9mek77AMzMA93Ak6QTcvKN/rpc'],
    blockExplorerUrls: ['https://testnet-explorer.cash.io'],
    iconUrls: ['https://testnet.cash.io/icon.png'],
};

export function AddSubnetModal({ isOpen, onClose }: AddSubnetModalProps) {
    const { isTestnet } = useNetworkMode();
    const [isAdding, setIsAdding] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    // Select the appropriate subnet config based on network mode
    const SUBNET_CONFIG = isTestnet ? TESTNET_SUBNET_CONFIG : MAINNET_SUBNET_CONFIG;
    const networkLabel = isTestnet ? 'Testnet' : 'Mainnet';
    const chainIdDisplay = isTestnet ? '41021 (0xA025)' : '4102 (0x1006)';

    if (!isOpen) return null;

    const addSubnetToMetaMask = async () => {
        if (!window.ethereum) {
            alert('MetaMask not found. Please install MetaMask to add the subnet.');
            return;
        }

        setIsAdding(true);
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [SUBNET_CONFIG],
            });

            // Try to fund with test tokens (this would need to be implemented)
            alert(`🎉 ${SUBNET_CONFIG.chainName} added successfully! You may need ${SUBNET_CONFIG.nativeCurrency.symbol} tokens for transactions.`);
            onClose();
        } catch (error: any) {
            console.error('Failed to add subnet:', error);
            if (error.code === 4001) {
                alert('User rejected the request to add the subnet.');
            } else {
                alert('Failed to add subnet. Please try again or add manually.');
            }
        } finally {
            setIsAdding(false);
        }
    };

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(key);
            setTimeout(() => setCopied(null), 2000);
        });
    };

    const CopyButton = ({ text, copyKey }: { text: string; copyKey: string }) => (
        <button
            onClick={() => copyToClipboard(text, copyKey)}
            className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
            title="Copy to clipboard"
        >
            {copied === copyKey ? (
                <Check size={14} className="text-green-600" />
            ) : (
                <Copy size={14} className="text-gray-400" />
            )}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Add Cash.io {networkLabel} to MetaMask</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Info */}
                <div className="mb-6">
                    <div className={`border rounded-lg p-4 mb-4 ${isTestnet
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-purple-50 border-purple-200'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{isTestnet ? '🧪' : '💰'}</span>
                            <span className="font-semibold">Cash.io Hub Chain ({networkLabel})</span>
                        </div>
                        <p className="text-sm text-gray-600">
                            Add our {networkLabel.toLowerCase()} subnet to MetaMask to enable on-chain transaction recording on the hub chain.
                        </p>
                    </div>

                    <div className="space-y-3 text-sm">
                        <div>
                            <span className="font-medium text-gray-700">Network Name:</span>
                            <div className="flex items-center justify-between bg-gray-50 rounded p-2">
                                <code className="text-sm">{SUBNET_CONFIG.chainName}</code>
                                <CopyButton text={SUBNET_CONFIG.chainName} copyKey="name" />
                            </div>
                        </div>

                        <div>
                            <span className="font-medium text-gray-700">Chain ID:</span>
                            <div className="flex items-center justify-between bg-gray-50 rounded p-2">
                                <code className="text-sm">{chainIdDisplay}</code>
                                <CopyButton text={isTestnet ? '41021' : '4102'} copyKey="chainId" />
                            </div>
                        </div>

                        <div>
                            <span className="font-medium text-gray-700">Currency Symbol:</span>
                            <div className="flex items-center justify-between bg-gray-50 rounded p-2">
                                <code className="text-sm">{SUBNET_CONFIG.nativeCurrency.symbol}</code>
                                <CopyButton text={SUBNET_CONFIG.nativeCurrency.symbol} copyKey="symbol" />
                            </div>
                        </div>

                        <div>
                            <span className="font-medium text-gray-700">RPC URL:</span>
                            <div className="flex items-center justify-between bg-gray-50 rounded p-2">
                                <code className="text-sm break-all">{SUBNET_CONFIG.rpcUrls[0]}</code>
                                <CopyButton text={SUBNET_CONFIG.rpcUrls[0]} copyKey="rpc" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        onClick={addSubnetToMetaMask}
                        disabled={isAdding}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${isAdding
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                    >
                        {isAdding ? (
                            <>
                                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                Adding to MetaMask...
                            </>
                        ) : (
                            <>
                                <Plus size={16} />
                                Add to MetaMask
                            </>
                        )}
                    </button>

                    <div className="text-xs text-gray-500 text-center">
                        <p>⚠️ You'll need {SUBNET_CONFIG.nativeCurrency.symbol} tokens for gas fees on the subnet</p>
                        <p>Contact the team for test tokens if needed</p>
                    </div>
                </div>

                {/* Manual Instructions */}
                <details className="mt-6">
                    <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                        Manual Setup Instructions
                    </summary>
                    <div className="mt-3 p-3 bg-gray-50 rounded text-xs space-y-2">
                        <p>1. Open MetaMask and click your network dropdown</p>
                        <p>2. Click "Add network" → "Add a network manually"</p>
                        <p>3. Fill in the network details above</p>
                        <p>4. Save and switch to the Cash.io Subnet</p>
                        <p>5. Import the account with {SUBNET_CONFIG.nativeCurrency.symbol} tokens if needed</p>
                    </div>
                </details>
            </div>
        </div>
    );
}