import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { api } from "@/lib/api";
import { finalizedWalletState } from "@/lib/solana";
import type { Portfolio, ClaimReadiness } from "@/lib/types";
import { loadDiscovery, marketModels, openCoverTotals, receiptModel } from "../../../../shared/ui-discovery.ts";
import { formatBase } from "../../../../shared/ui-money.ts";
import type { WindowQuote } from "../../../../shared/ui-types.ts";
import type { QuoteWindow } from "../../../../shared/ui-window-quote.ts";

export function useDiscovery(windows: readonly QuoteWindow[]) {
  const now = Math.floor(Date.now() / 1000);
  const query = useQuery({ queryKey: ["discovery", windows, Math.floor(now / 60)], queryFn: () => loadDiscovery(windows, now, (path) => api<WindowQuote>(path)), retry: false, staleTime: 30_000 });
  return { markets: marketModels(query.data?.quotes ?? [], now), quotes: query.data?.quotes ?? [], loading: query.isPending, failed: query.isError || query.data?.failed === true };
}
export function useLineWallet(windows: readonly QuoteWindow[], quotes: readonly WindowQuote[]) {
  const wallet = useWallet();
  const modal = useWalletModal();
  const address = wallet.publicKey?.toBase58() ?? null;
  const portfolio = useQuery({ queryKey: ["portfolio", address], queryFn: () => api<Portfolio>(`/api/portfolio/${address}`), enabled: Boolean(address), retry: false });
  const positions = portfolio.data?.protections ?? [];
  const claims = useQuery({ queryKey: ["cover-claims", address, positions.map((p) => p.market)], enabled: Boolean(address && portfolio.data), retry: false,
    queryFn: async () => Object.fromEntries(await Promise.all(positions.map(async (p) => {
      try { return [p.market, await api<ClaimReadiness>(`/api/mobile?resource=claim-readiness&market=${encodeURIComponent(p.market)}&wallet=${encodeURIComponent(address!)}`)] as const; }
      catch { return [p.market, null] as const; }
    }))) });
  const balances = useQuery({ queryKey: ["finalized-wallet", address], queryFn: () => finalizedWalletState(wallet.publicKey!), enabled: Boolean(address), retry: false });
  const receipts = positions.map((p) => receiptModel(p, windows, quotes, claims.data?.[p.market]));
  return { address, balance: balances.data ? formatBase(BigInt(balances.data.skytBaseUnits)) : null, receipts, totals: openCoverTotals(positions, receipts),
    loading: Boolean(address && (portfolio.isPending || balances.isPending || claims.isFetching)), failed: Boolean(address && (portfolio.isError || balances.isError || portfolio.data?.indexed === false)),
    onConnect: () => modal.setVisible(true), onDisconnect: () => { void wallet.disconnect(); }, onRetry: () => { void portfolio.refetch(); void balances.refetch(); void claims.refetch(); } };
}
