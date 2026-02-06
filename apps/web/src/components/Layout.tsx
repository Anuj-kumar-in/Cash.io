import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import {
    LayoutDashboard,
    Shield,
    ArrowLeftRight,
    Globe,
    Settings,
    Menu,
    X,
    ExternalLink,
} from 'lucide-react';
import { WalletButton } from './WalletModal';
import { useSDK } from '../hooks/useSDK';
import { getChainById } from '../config/chains';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Shield', href: '/shield', icon: Shield },
    { name: 'Transfer', href: '/transfer', icon: ArrowLeftRight },
    { name: 'Bridge', href: '/bridge', icon: Globe },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout() {
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const { isLoading: sdkLoading } = useSDK();

    const currentChain = getChainById(chainId);

    return (
        <div className="min-h-screen bg-white bg-grid">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-40 glass">
                <div className="container-app">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-xl">C</span>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">CASH.IO</h1>
                                <p className="text-xs text-[var(--color-muted)] -mt-1">Private Finance Protocol</p>
                            </div>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            {navigation.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <NavLink
                                        key={item.name}
                                        to={item.href}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                            ? 'bg-black text-white'
                                            : 'text-[var(--color-muted)] hover:bg-[var(--color-subtle)] hover:text-black'
                                            }`}
                                    >
                                        <item.icon size={18} />
                                        {item.name}
                                    </NavLink>
                                );
                            })}
                        </nav>

                        {/* Wallet Connection */}
                        <div className="flex items-center gap-3">
                            {/* SDK Loading Indicator */}
                            {sdkLoading && (
                                <div className="w-2 h-2 bg-[var(--color-warning)] rounded-full animate-pulse" />
                            )}

                            <WalletButton />

                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="md:hidden p-2 hover:bg-[var(--color-subtle)] rounded-lg transition-all"
                            >
                                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <nav className="md:hidden border-t border-[var(--color-border)] bg-white animate-fade-in">
                        <div className="container-app py-4 space-y-1">
                            {navigation.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <NavLink
                                        key={item.name}
                                        to={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${isActive
                                            ? 'bg-black text-white'
                                            : 'text-[var(--color-muted)] hover:bg-[var(--color-subtle)]'
                                            }`}
                                    >
                                        <item.icon size={20} />
                                        {item.name}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </nav>
                )}
            </header>

            {/* Main Content */}
            <main className="pt-20 pb-12">
                <div className="container-app">
                    <Outlet />
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-[var(--color-border)] py-8">
                <div className="container-app">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                            <span className="text-sm text-[var(--color-muted)]">
                                © 2024 Cash.io Protocol
                            </span>
                            <a
                                href="https://docs.cash.io"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-black transition-colors"
                            >
                                Documentation <ExternalLink size={14} />
                            </a>
                        </div>
                        <div className="flex items-center gap-4">
                            {isConnected && currentChain && (
                                <span className="badge badge-neutral">{currentChain.icon} {currentChain.name}</span>
                            )}
                            <span className="text-sm font-mono text-[var(--color-muted)]">v1.0.0</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
