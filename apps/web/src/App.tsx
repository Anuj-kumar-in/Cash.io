import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from './config/wagmi';
import { SDKProvider } from './hooks/useSDK';
import Layout from './components/Layout';
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
        <SDKProvider>
          <BrowserRouter>
            <div className="noise-overlay" />
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="shield" element={<Shield />} />
                <Route path="transfer" element={<Transfer />} />
                <Route path="bridge" element={<Bridge />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SDKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
