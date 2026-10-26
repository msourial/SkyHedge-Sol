import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DevnetStatus } from "@/lib/types";
import { useDiscovery } from "@/components/line/use-discovery";
import { LandingScreen } from "@/components/line/landing";
import "@/line.css";

export default function LandingPage() {
  const status = useQuery({ queryKey: ["devnet-status"], queryFn: () => api<DevnetStatus>("/api/devnet/status"), retry: false });
  const discovery = useDiscovery(status.data?.cityWindows ?? []);
  return <LandingScreen quotes={discovery.quotes} loading={discovery.loading} failed={discovery.failed}/>;
}
