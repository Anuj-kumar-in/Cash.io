import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import {
    Shield,
    Globe,
    Lock,
    Zap,
    ArrowRight,
    ChevronRight,
    ChevronDown,
    Github,
    Twitter,
    ExternalLink,
    Wallet,
    ArrowRightLeft,
    Sparkles,
    Play,
    Star,
    TrendingUp,
    Users,
    Activity,
    Code2,
    MessageCircle,
    Sun,
    Moon,
} from 'lucide-react';
import { WalletModal } from '../components/WalletModal';
import { supportedChains } from '../config/chains';
import { useTheme } from '../hooks/useTheme';

export default function Landing() {
    const { isConnected } = useAccount();
    const { isDark, toggleTheme } = useTheme();
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [activeFeature, setActiveFeature] = useState(0);
    const [scrollY, setScrollY] = useState(0);
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const [hoveredChain, setHoveredChain] = useState<string | null>(null);

    // Parallax effect
    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Auto-rotate features
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveFeature((prev) => (prev + 1) % features.length);
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    const evmChains = supportedChains.filter(c => c.category === 'evm' && !c.isTestnet);
    const btcChains = supportedChains.filter(c => c.category === 'bitcoin' && !c.isTestnet);
    const totalChains = supportedChains.filter(c => !c.isTestnet).length;

    const features = [
        {
            icon: Shield,
            title: 'Zero-Knowledge Privacy',
            description: 'Your transactions are shielded using cutting-edge ZK-SNARKs. No one can trace your activity.',
            stats: '100% Private',
        },
        {
            icon: Globe,
            title: '30+ Chains Supported',
            description: 'Seamlessly bridge across Ethereum, Bitcoin L2s, Solana, and more. One protocol, infinite reach.',
            stats: `${totalChains} Networks`,
        },
        {
            icon: Zap,
            title: 'Zero Gas Fees',
            description: 'Account Abstraction powers gasless transactions. We sponsor your fees through our Paymaster.',
            stats: '$0 Fees',
        },
        {
            icon: Lock,
            title: 'Self-Custody & Secure',
            description: 'Your keys, your coins. Smart accounts with social recovery and spending limits built-in.',
            stats: '100% Secure',
        },
    ];

    const stats = [
        { value: '$12.4M', label: 'Total Value Locked', icon: TrendingUp },
        { value: '2,341', label: 'Active Users', icon: Users },
        { value: `${totalChains}+`, label: 'Chains Supported', icon: Globe },
        { value: '99.9%', label: 'Uptime', icon: Activity },
    ];

    const howItWorks = [
        {
            step: '01',
            title: 'Connect Wallet',
            description: 'Link your existing wallet. We support MetaMask, WalletConnect, Coinbase, and 100+ more.',
            icon: Wallet,
        },
        {
            step: '02',
            title: 'Shield Your Assets',
            description: 'Deposit funds into the shielded pool. Your balance becomes private instantly.',
            icon: Shield,
        },
        {
            step: '03',
            title: 'Transact Privately',
            description: 'Send, receive, or bridge across chains. All transactions are completely private.',
            icon: ArrowRightLeft,
        },
        {
            step: '04',
            title: 'Unshield Anytime',
            description: 'Withdraw to any address when you need. Full control, always.',
            icon: ExternalLink,
        },
    ];

    const faqs = [
        {
            q: 'How does Cash.io protect my privacy?',
            a: 'Cash.io uses zero-knowledge proofs (ZK-SNARKs) to shield your transactions. When you deposit funds, they enter a shared shielded pool. Withdrawals generate cryptographic proofs that verify you have the right to withdraw without revealing which deposit was yours.',
        },
        {
            q: 'Which blockchains are supported?',
            a: `Cash.io supports ${totalChains}+ chains including Ethereum, Polygon, Arbitrum, Optimism, Base, and Bitcoin L2s like Rootstock, BOB, and Merlin. We also support Solana via Wormhole integration.`,
        },
        {
            q: 'Are there any fees?',
            a: 'Cash.io uses Account Abstraction with a Paymaster to sponsor your gas fees. You pay zero gas fees for shielded transactions. We only charge a small 0.1% protocol fee on withdrawals.',
        },
        {
            q: 'Is my money safe?',
            a: 'Yes. Cash.io is non-custodial, meaning only you control your funds. Our smart contracts are audited and open source. We use battle-tested cryptographic primitives and implement spending limits and social recovery for additional security.',
        },
    ];

    const testimonials = [
        { name: 'Alex K.', role: 'DeFi Trader', text: 'Finally, true privacy across all my favorite chains. The UX is incredibly smooth.', rating: 5 },
        { name: 'Sarah M.', role: 'DAO Contributor', text: 'Zero gas fees changed everything. I can move funds without worrying about costs.', rating: 5 },
        { name: 'Michael R.', role: 'Privacy Advocate', text: 'The ZK technology here is top-notch. This is how crypto should work.', rating: 5 },
    ];

    return (
        <div className="min-h-screen bg-[var(--color-secondary)] overflow-x-hidden transition-colors duration-300">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-40 bg-[var(--color-secondary)]/80 backdrop-blur-md border-b border-[var(--color-border)] transition-colors">
                <div className="container-app">
                    <div className="flex items-center justify-between h-20 md:h-24">
                        <Link to="/" className="flex items-center flex-shrink-0">
                            <img src="/logo.webp" alt="Cash.io" className="h-8 md:h-10 w-auto object-contain" />
                        </Link>

                        <div className="hidden lg:flex items-center gap-8">
                            <a href="#features" className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">Features</a>
                            <a href="#how-it-works" className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">How It Works</a>
                            <a href="#chains" className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">Chains</a>
                            <a href="#faq" className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">FAQ</a>
                            <a href="https://docs.cash.io" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex items-center gap-1">
                                Docs <ExternalLink size={12} />
                            </a>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="p-2 hover:bg-[var(--color-subtle)] rounded-lg transition-all"
                                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {isDark ? <Sun size={20} className="text-[var(--color-primary)]" /> : <Moon size={20} className="text-[var(--color-primary)]" />}
                            </button>

                            {isConnected ? (
                                <Link to="/app" className="btn btn-primary btn-sm">
                                    <span className="hidden sm:inline">Open App</span>
                                    <span className="sm:hidden">App</span>
                                    <ArrowRight size={14} className="ml-1" />
                                </Link>
                            ) : (
                                <button onClick={() => setIsWalletModalOpen(true)} className="btn btn-primary btn-sm">
                                    <span className="hidden sm:inline">Launch App</span>
                                    <span className="sm:hidden">Launch</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center pt-24 md:pt-28 overflow-hidden">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-grid opacity-50" style={{ transform: `translateY(${scrollY * 0.1}px)` }} />

                {/* Gradient Orbs - Responsive sizing */}
                <div className="absolute top-10 md:top-20 right-5 md:right-20 w-48 md:w-96 h-48 md:h-96 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full blur-3xl opacity-60" />
                <div className="absolute bottom-10 md:bottom-20 left-5 md:left-20 w-32 md:w-64 h-32 md:h-64 bg-gradient-to-tr from-gray-200 to-gray-100 rounded-full blur-3xl opacity-40" />

                <div className="container-app relative z-10 py-8 md:py-0">
                    <div className="max-w-5xl mx-auto text-center">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-black text-white rounded-full text-xs md:text-sm font-medium mb-6 md:mb-8 animate-fade-in">
                            <Sparkles size={14} />
                            <span>Now live on {totalChains}+ chains</span>
                            <ChevronRight size={14} />
                        </div>

                        {/* Main Headline */}
                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-4 md:mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                            Privacy-First
                            <br />
                            <span className="bg-gradient-to-r from-gray-600 to-black bg-clip-text text-transparent">
                                Cross-Chain Transfers
                            </span>
                        </h1>

                        <p className="text-base sm:text-lg md:text-xl text-[var(--color-muted)] max-w-2xl mx-auto mb-8 md:mb-10 px-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                            Zero-knowledge proofs meet account abstraction. Send and receive assets privately across Ethereum, Bitcoin L2s, and Solana — with zero gas fees.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 mb-12 md:mb-16 px-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                            {isConnected ? (
                                <Link to="/app" className="btn btn-primary btn-lg w-full sm:w-auto">
                                    Go to Dashboard
                                    <ArrowRight size={18} className="ml-2" />
                                </Link>
                            ) : (
                                <button onClick={() => setIsWalletModalOpen(true)} className="btn btn-primary btn-lg w-full sm:w-auto">
                                    Get Started Free
                                    <ArrowRight size={18} className="ml-2" />
                                </button>
                            )}
                            <a href="#how-it-works" className="btn btn-secondary btn-lg w-full sm:w-auto">
                                <Play size={16} className="mr-2" />
                                Learn More
                            </a>
                        </div>

                        {/* Chain Icons - Responsive */}
                        <div className="flex items-center justify-center gap-1.5 md:gap-2 flex-wrap px-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                            <span className="text-xs md:text-sm text-[var(--color-muted)] mr-1 md:mr-2">Powered by:</span>
                            {supportedChains.filter(c => !c.isTestnet).slice(0, 8).map((chain) => (
                                <div
                                    key={chain.id}
                                    className="w-8 h-8 md:w-10 md:h-10 bg-[var(--color-subtle)] rounded-full flex items-center justify-center text-base md:text-lg hover:bg-[var(--color-border)] transition-all cursor-pointer hover:scale-110"
                                    title={chain.name}
                                    onMouseEnter={() => setHoveredChain(chain.name)}
                                    onMouseLeave={() => setHoveredChain(null)}
                                >
                                    {chain.icon}
                                </div>
                            ))}
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-[var(--color-primary)] text-[var(--color-secondary)] rounded-full flex items-center justify-center text-xs font-bold">
                                +{totalChains - 8}
                            </div>
                        </div>

                        {/* Hovered chain name */}
                        {hoveredChain && (
                            <div className="mt-2 text-sm text-[var(--color-muted)] animate-fade-in">
                                {hoveredChain}
                            </div>
                        )}
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-pulse">
                    <span className="text-xs text-[var(--color-muted)]">Scroll</span>
                    <div className="w-5 h-8 border-2 border-[var(--color-border)] rounded-full flex items-start justify-center p-1">
                        <div className="w-1 h-2 bg-[var(--color-muted)] rounded-full animate-bounce" />
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-12 md:py-20 bg-[var(--color-primary)] text-[var(--color-secondary)]">
                <div className="container-app">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                        {stats.map((stat) => (
                            <div key={stat.label} className="text-center p-4 md:p-6 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                                <stat.icon className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 md:mb-3 text-white/60" />
                                <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-1 md:mb-2">{stat.value}</div>
                                <div className="text-white/60 text-xs md:text-sm uppercase tracking-wider">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-16 md:py-24">
                <div className="container-app">
                    <div className="text-center mb-12 md:mb-16 px-4">
                        <span className="badge badge-neutral mb-4">Features</span>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Why Cash.io?</h2>
                        <p className="text-lg md:text-xl text-[var(--color-muted)] max-w-2xl mx-auto">
                            The most advanced privacy protocol for multi-chain transactions.
                        </p>
                    </div>

                    {/* Feature Cards - Responsive Grid */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
                        {features.map((feature, i) => (
                            <div
                                key={feature.title}
                                className={`card ${i === activeFeature ? 'bg-[var(--color-primary)] text-[var(--color-secondary)] border-[var(--color-primary)] scale-105' : ''} cursor-pointer transition-all duration-300 hover:scale-105 relative overflow-hidden`}
                                onClick={() => setActiveFeature(i)}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <feature.icon size={28} className={i === activeFeature ? 'text-[var(--color-secondary)]' : 'text-[var(--color-primary)]'} />
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${i === activeFeature ? 'bg-white/20' : 'bg-[var(--color-subtle)]'}`}>
                                        {feature.stats}
                                    </span>
                                </div>
                                <h3 className="text-lg md:text-xl font-bold mb-2">{feature.title}</h3>
                                <p className={`text-sm md:text-base ${i === activeFeature ? 'text-white/70' : 'text-[var(--color-muted)]'}`}>
                                    {feature.description}
                                </p>

                                {/* Active indicator */}
                                {i === activeFeature && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Feature Progress Bar */}
                    <div className="flex justify-center gap-2 mt-8">
                        {features.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setActiveFeature(i)}
                                className={`h-1.5 rounded-full transition-all ${i === activeFeature ? 'w-8 bg-[var(--color-primary)]' : 'w-4 bg-[var(--color-border)]'}`}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-16 md:py-24 bg-[var(--color-subtle)]">
                <div className="container-app">
                    <div className="text-center mb-12 md:mb-16 px-4">
                        <span className="badge badge-neutral mb-4">How It Works</span>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Start in Minutes</h2>
                        <p className="text-lg md:text-xl text-[var(--color-muted)] max-w-2xl mx-auto">
                            Four simple steps to complete privacy.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 px-4 md:px-0">
                        {howItWorks.map((step, i) => (
                            <div key={step.step} className="relative group">
                                {/* Connector Line */}
                                {i < howItWorks.length - 1 && (
                                    <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-[var(--color-border)] -translate-x-1/2 z-0" />
                                )}
                                <div className="card bg-[var(--color-secondary)] relative z-10 h-full hover:shadow-xl transition-all group-hover:-translate-y-1">
                                    <div className="absolute -top-3 -left-3 md:-top-4 md:-left-4 w-10 h-10 md:w-12 md:h-12 bg-[var(--color-primary)] text-[var(--color-secondary)] rounded-full flex items-center justify-center font-bold text-sm md:text-lg shadow-lg">
                                        {step.step}
                                    </div>
                                    <step.icon size={24} className="text-[var(--color-muted)] mb-4 mt-4" />
                                    <h3 className="text-base md:text-lg font-bold mb-2">{step.title}</h3>
                                    <p className="text-[var(--color-muted)] text-sm">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Chains Section */}
            <section id="chains" className="py-16 md:py-24">
                <div className="container-app">
                    <div className="text-center mb-12 md:mb-16 px-4">
                        <span className="badge badge-neutral mb-4">Multi-Chain</span>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">One Protocol, All Chains</h2>
                        <p className="text-lg md:text-xl text-[var(--color-muted)] max-w-2xl mx-auto">
                            Bridge and transact privately across the entire blockchain ecosystem.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12 px-4 md:px-0">
                        {/* EVM Chains */}
                        <div className="card hover:shadow-xl transition-all">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-[var(--color-subtle)] rounded-xl flex items-center justify-center text-2xl">⟠</div>
                                <div>
                                    <h3 className="font-bold">EVM Chains</h3>
                                    <p className="text-sm text-[var(--color-muted)]">{evmChains.length} networks</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 md:gap-2">
                                {evmChains.slice(0, 6).map(chain => (
                                    <span key={chain.id} className="px-2 md:px-3 py-1 bg-[var(--color-subtle)] rounded-full text-xs font-medium hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                                        {chain.icon} {chain.name.split(' ')[0]}
                                    </span>
                                ))}
                                {evmChains.length > 6 && (
                                    <span className="px-2 md:px-3 py-1 bg-[var(--color-primary)] text-[var(--color-secondary)] rounded-full text-xs font-medium cursor-pointer hover:opacity-80">
                                        +{evmChains.length - 6} more
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Bitcoin L2s */}
                        <div className="card hover:shadow-xl transition-all">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-[var(--color-subtle)] rounded-xl flex items-center justify-center text-2xl">🟠</div>
                                <div>
                                    <h3 className="font-bold">Bitcoin L2s</h3>
                                    <p className="text-sm text-[var(--color-muted)]">{btcChains.length} networks</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 md:gap-2">
                                {btcChains.map(chain => (
                                    <span key={chain.id} className="px-2 md:px-3 py-1 bg-[var(--color-subtle)] rounded-full text-xs font-medium hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                                        {chain.icon} {chain.name.split(' ')[0]}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Solana */}
                        <div className="card hover:shadow-xl transition-all">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-[var(--color-subtle)] rounded-xl flex items-center justify-center text-2xl">◎</div>
                                <div>
                                    <h3 className="font-bold">Solana</h3>
                                    <p className="text-sm text-[var(--color-muted)]">Via Wormhole</p>
                                </div>
                            </div>
                            <p className="text-sm text-[var(--color-muted)]">
                                Bridge SOL and SPL tokens to the Cash.io hub for private transactions across the ecosystem.
                            </p>
                        </div>
                    </div>

                    {/* All chain icons - Responsive grid */}
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 md:gap-3 px-4 md:px-0">
                        {supportedChains.filter(c => !c.isTestnet).map(chain => (
                            <div
                                key={chain.id}
                                className="aspect-square bg-[var(--color-subtle)] rounded-xl flex items-center justify-center text-lg md:text-xl hover:bg-[var(--color-border)] transition-all cursor-pointer hover:scale-110 group relative"
                                title={chain.name}
                            >
                                {chain.icon}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[var(--color-primary)] text-[var(--color-secondary)] text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                    {chain.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-16 md:py-24 bg-[var(--color-subtle)]">
                <div className="container-app">
                    <div className="text-center mb-12 md:mb-16 px-4">
                        <span className="badge badge-neutral mb-4">Testimonials</span>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Loved by Users</h2>
                        <p className="text-lg md:text-xl text-[var(--color-muted)] max-w-2xl mx-auto">
                            See what our community has to say.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 md:gap-6 px-4 md:px-0">
                        {testimonials.map((t, i) => (
                            <div key={i} className="card bg-[var(--color-secondary)] hover:shadow-xl transition-all">
                                <div className="flex gap-1 mb-4">
                                    {[...Array(t.rating)].map((_, j) => (
                                        <Star key={j} size={16} className="fill-yellow-400 text-yellow-400" />
                                    ))}
                                </div>
                                <p className="text-[var(--color-muted)] mb-4 italic">"{t.text}"</p>
                                <div className="flex items-center gap-3 pt-4 border-t border-[var(--color-border)]">
                                    <div className="w-10 h-10 bg-[var(--color-primary)] text-[var(--color-secondary)] rounded-full flex items-center justify-center font-bold">
                                        {t.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">{t.name}</div>
                                        <div className="text-xs text-[var(--color-muted)]">{t.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" className="py-16 md:py-24">
                <div className="container-app">
                    <div className="text-center mb-12 md:mb-16 px-4">
                        <span className="badge badge-neutral mb-4">FAQ</span>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Common Questions</h2>
                        <p className="text-lg md:text-xl text-[var(--color-muted)] max-w-2xl mx-auto">
                            Everything you need to know about Cash.io.
                        </p>
                    </div>

                    <div className="max-w-3xl mx-auto space-y-3 md:space-y-4 px-4 md:px-0">
                        {faqs.map((faq, i) => (
                            <div
                                key={i}
                                className="card cursor-pointer hover:shadow-lg transition-all"
                                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-sm md:text-base pr-4">{faq.q}</h3>
                                    <ChevronDown
                                        size={20}
                                        className={`flex-shrink-0 transition-transform ${activeFaq === i ? 'rotate-180' : ''}`}
                                    />
                                </div>
                                {activeFaq === i && (
                                    <p className="text-[var(--color-muted)] mt-4 pt-4 border-t border-[var(--color-border)] text-sm md:text-base animate-fade-in">
                                        {faq.a}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 md:py-24 bg-[var(--color-primary)] text-[var(--color-secondary)] relative overflow-hidden">
                {/* Background decorations */}
                <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

                <div className="container-app relative z-10">
                    <div className="text-center max-w-3xl mx-auto px-4">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6">
                            Ready to Go Private?
                        </h2>
                        <p className="text-lg md:text-xl text-white/60 mb-8 md:mb-10">
                            Join thousands of users who value their financial privacy. Start transacting privately in under 2 minutes.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            {isConnected ? (
                                <Link to="/app" className="btn btn-lg bg-[var(--color-secondary)] text-[var(--color-primary)] hover:opacity-90 w-full sm:w-auto">
                                    Open Dashboard
                                    <ArrowRight size={18} className="ml-2" />
                                </Link>
                            ) : (
                                <button onClick={() => setIsWalletModalOpen(true)} className="btn btn-lg bg-[var(--color-secondary)] text-[var(--color-primary)] hover:opacity-90 w-full sm:w-auto">
                                    Connect Wallet
                                    <ArrowRight size={18} className="ml-2" />
                                </button>
                            )}
                            <a href="https://docs.cash.io" className="btn btn-lg border border-white/20 text-white hover:bg-white/10 w-full sm:w-auto">
                                <Code2 size={18} className="mr-2" />
                                Read Docs
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 md:py-16 border-t border-[var(--color-border)] bg-[var(--color-secondary)]">
                <div className="container-app px-4 md:px-0">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                        <div>
                            <div className="flex items-center mb-4 flex-shrink-0">
                                <img src="/logo.webp" alt="Cash.io" className="h-8 w-auto object-contain" />
                            </div>
                            <p className="text-sm text-[var(--color-muted)] mb-4">
                                Privacy-first multi-chain transactions powered by zero-knowledge proofs.
                            </p>
                            <div className="flex gap-3">
                                <a href="https://twitter.com/cashio" className="w-9 h-9 bg-[var(--color-subtle)] rounded-full flex items-center justify-center hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] transition-colors">
                                    <Twitter size={16} />
                                </a>
                                <a href="https://github.com/cash-io" className="w-9 h-9 bg-[var(--color-subtle)] rounded-full flex items-center justify-center hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] transition-colors">
                                    <Github size={16} />
                                </a>
                                <a href="https://discord.gg/cashio" className="w-9 h-9 bg-[var(--color-subtle)] rounded-full flex items-center justify-center hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] transition-colors">
                                    <MessageCircle size={16} />
                                </a>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold mb-4">Product</h4>
                            <div className="space-y-2">
                                <a href="#features" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">Features</a>
                                <a href="#how-it-works" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">How It Works</a>
                                <a href="#chains" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">Supported Chains</a>
                                <a href="#faq" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">FAQ</a>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold mb-4">Developers</h4>
                            <div className="space-y-2">
                                <a href="https://docs.cash.io" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">Documentation</a>
                                <a href="https://github.com/cash-io" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">GitHub</a>
                                <a href="#" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">SDK</a>
                                <a href="#" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">API Reference</a>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold mb-4">Legal</h4>
                            <div className="space-y-2">
                                <a href="#" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">Privacy Policy</a>
                                <a href="#" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">Terms of Service</a>
                                <a href="#" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">Cookie Policy</a>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-[var(--color-border)] flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-[var(--color-muted)]">
                            © 2026 Cash.io. All rights reserved.
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-[var(--color-success)] rounded-full animate-pulse" />
                            <span className="text-sm text-[var(--color-muted)]">All systems operational</span>
                        </div>
                    </div>
                </div>
            </footer>

            <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
        </div>
    );
}
