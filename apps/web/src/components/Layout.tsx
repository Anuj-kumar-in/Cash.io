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
    Sun,
    Moon,
    FlaskConical,
    Rocket,
} from 'lucide-react';
import { WalletButton } from './WalletModal';
import { useSDK } from '../hooks/useSDK';
import { useTheme } from '../hooks/useTheme';
import { useNetworkMode } from '../hooks/useNetworkMode';
import { getChainById } from '../config/chains';

const navigation = [
    { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
    { name: 'Shield', href: '/app/shield', icon: Shield },
    { name: 'Transfer', href: '/app/transfer', icon: ArrowLeftRight },
    { name: 'Bridge', href: '/app/bridge', icon: Globe },
    { name: 'Settings', href: '/app/settings', icon: Settings },
];

export default function Layout() {
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const { isLoading: sdkLoading } = useSDK();
    const { isDark, toggleTheme } = useTheme();
    const { networkMode, toggleNetworkMode, isTestnet } = useNetworkMode();

    const currentChain = getChainById(chainId);

    return (
        <div className="min-h-screen bg-[var(--color-secondary)] bg-grid transition-colors duration-300">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-40 glass">
                <div className="container-app">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
                                <span className="text-[var(--color-secondary)] font-bold text-xl">C</span>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight text-[var(--color-primary)]">CASH.IO</h1>
                                <p className="text-xs text-[var(--color-muted)] -mt-1">Private Finance Protocol</p>
                            </div>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1 ">
                            {navigation.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <NavLink
                                        key={item.name}
                                        to={item.href}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                            ? 'bg-[var(--color-primary)] text-[var(--color-secondary)]'
                                            : 'text-[var(--color-muted)] hover:bg-[var(--color-subtle)] hover:text-[var(--color-primary)]'
                                            }`}
                                    >
                                        <item.icon size={18} />
                                        {item.name}
                                    </NavLink>
                                );
                            })}
                        </nav>

                        {/* Right Side Controls */}
                        <div className="flex items-center gap-3">
                            {/* SDK Loading Indicator */}
                            {sdkLoading && (
                                <div className="w-2 h-2 bg-[var(--color-warning)] rounded-full animate-pulse" />
                            )}

                            {/* Network Mode Toggle */}
                            <button
                                onClick={toggleNetworkMode}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                    isTestnet 
                                        ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' 
                                        : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                }`}
                                title={`Switch to ${isTestnet ? 'Mainnet' : 'Testnet'}`}
                            >
                                {isTestnet ? (
                                    <><FlaskConical size={16} /> Testnet</>
                                ) : (
                                    <><Rocket size={16} /> Mainnet</>
                                )}
                            </button>

                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="p-2 hover:bg-[var(--color-subtle)] rounded-lg transition-all"
                                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {isDark ? <Sun size={20} className="text-[var(--color-primary)]" /> : <Moon size={20} className="text-[var(--color-primary)]" />}
                            </button>

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
                    <nav className="md:hidden border-t border-[var(--color-border)] bg-[var(--color-secondary)] animate-fade-in">
                        <div className="container-app py-4 space-y-1">
                            {navigation.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <NavLink
                                        key={item.name}
                                        to={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${isActive
                                            ? 'bg-[var(--color-primary)] text-[var(--color-secondary)]'
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
            <footer className="border-t border-[var(--color-border)] py-8 bg-[var(--color-secondary)]">
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
                                className="flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
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

