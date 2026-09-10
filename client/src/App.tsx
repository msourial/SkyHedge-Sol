import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider, type ConnectionProviderProps } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { useEffect, type FC, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { RPC_URL } from "./lib/solana";
import Layout from "@/components/layout";
import DashboardPage from "@/pages/dashboard";

const WALLETS = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];

const SafeConnectionProvider = ConnectionProvider as unknown as FC<ConnectionProviderProps & { children?: ReactNode }>;

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function CityRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/?tab=markets&city=${slug}`} replace />;
}

function App() {
  return (
    <SafeConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={WALLETS} autoConnect={false}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="/liquidity" element={<Navigate to="/?tab=liquidity" replace />} />
                <Route path="/staking" element={<Navigate to="/?tab=liquidity" replace />} />
                <Route path="/city/:slug" element={<CityRedirect />} />
                <Route path="/advisor" element={<Navigate to="/" replace />} />
                <Route path="/settlements" element={<Navigate to="/?tab=evidence" replace />} />
                <Route path="/portfolio" element={<Navigate to="/?tab=portfolio" replace />} />
                <Route path="/explore" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </WalletProvider>
    </SafeConnectionProvider>
  );
}

export default App;
