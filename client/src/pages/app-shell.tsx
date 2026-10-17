import { ConnectionProvider, WalletProvider, type ConnectionProviderProps } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { type FC, type ReactNode } from "react";
import { RPC_URL } from "@/lib/solana";
import Layout from "@/components/layout";
import DashboardPage from "@/pages/dashboard";
import { WalletStatusProvider, useWalletStatus } from "@/components/wallet-button";
import "leaflet/dist/leaflet.css";
import "@solana/wallet-adapter-react-ui/styles.css";

const WALLETS = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

const SafeConnectionProvider = ConnectionProvider as unknown as FC<ConnectionProviderProps & { children?: ReactNode }>;

function WalletRuntime({ children }: { children: ReactNode }) {
  const { reportError } = useWalletStatus();
  return (
    <WalletProvider wallets={WALLETS} autoConnect={false} onError={reportError}>
      <WalletModalProvider>{children}</WalletModalProvider>
    </WalletProvider>
  );
}

export function AppDashboard() {
  return <DashboardPage />;
}

export default function AppShell() {
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
