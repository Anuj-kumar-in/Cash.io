import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from './config/wagmi';
import { SDKProvider } from './hooks/useSDK';
import { ThemeProvider } from './hooks/useTheme';
import { NetworkModeProvider } from './hooks/useNetworkMode';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Shield from './pages/Shield';
import Transfer from './pages/Transfer';
import Bridge from './pages/Bridge';
import Settings from './pages/Settings';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NetworkModeProvider>
            <SDKProvider>
              <BrowserRouter>
              <div className="noise-overlay" />
              <Routes>
                {/* Public Landing Page */}
                <Route path="/" element={<Landing />} />

                {/* App Routes with Layout */}
                <Route path="/app" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="shield" element={<Shield />} />
                  <Route path="transfer" element={<Transfer />} />
                  <Route path="bridge" element={<Bridge />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

                {/* Legacy routes - redirect to /app */}
                <Route path="/shield" element={<Layout />}>
                  <Route index element={<Shield />} />
                </Route>
                <Route path="/transfer" element={<Layout />}>
                  <Route index element={<Transfer />} />
                </Route>
                <Route path="/bridge" element={<Layout />}>
                  <Route index element={<Bridge />} />
                </Route>
                <Route path="/settings" element={<Layout />}>
                  <Route index element={<Settings />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SDKProvider>
        </NetworkModeProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

