import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider, type ConnectionProviderProps } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useEffect, type FC, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { RPC_URL } from "./lib/solana";
import Layout from "@/components/layout";
import DashboardPage from "@/pages/dashboard";
import WaitlistPage from "@/pages/waitlist";
import { WalletStatusProvider, useWalletStatus } from "@/components/wallet-button";

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
  return <Navigate to={`/app?tab=markets&city=${slug}`} replace />;
}

/** Legacy bookmarks like `/?tab=markets` land on the product app. */
function RootEntry() {
  const [params] = useSearchParams();
  if (params.has("tab") || params.has("city")) {
    return <Navigate to={`/app?${params.toString()}`} replace />;
  }
  return <WaitlistPage />;
}

function WalletRuntime({ children }: { children: ReactNode }) {
  const { reportError } = useWalletStatus();
  return (
    <WalletProvider wallets={WALLETS} autoConnect={false} onError={reportError}>
      <WalletModalProvider>{children}</WalletModalProvider>
    </WalletProvider>
  );
}

function AppShell() {
  return (
    <SafeConnectionProvider endpoint={RPC_URL}>
      <WalletStatusProvider>
        <WalletRuntime>
          <Layout />
        </WalletRuntime>
      </WalletStatusProvider>
    </SafeConnectionProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<RootEntry />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<DashboardPage />} />
          </Route>
          <Route path="/liquidity" element={<Navigate to="/app?tab=liquidity" replace />} />
          <Route path="/staking" element={<Navigate to="/app?tab=liquidity" replace />} />
          <Route path="/city/:slug" element={<CityRedirect />} />
          <Route path="/advisor" element={<Navigate to="/app" replace />} />
          <Route path="/settlements" element={<Navigate to="/app?tab=evidence" replace />} />
          <Route path="/portfolio" element={<Navigate to="/app?tab=portfolio" replace />} />
          <Route path="/explore" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
