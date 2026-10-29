import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { getCoverProgress, getForecastEdge, type CoverProgress, type ForecastEdge } from "../api.ts";

function useSignals<T>(addresses: readonly string[], read: (addresses: readonly string[]) => Promise<Record<string, T>>, supplied?: Record<string, T>, revision = 0) {
  const key = [...new Set(addresses)].sort().join(",");
  const [data, setData] = useState<Record<string, T>>({});
  useEffect(() => {
    if (supplied) return;
    let live = true, sequence = 0;
    const refresh = async () => {
      const run = ++sequence;
      const ids = key ? key.split(",") : [];
      const batches = Array.from({ length: Math.ceil(ids.length / 20) }, (_, i) => ids.slice(i * 20, i * 20 + 20));
      const results = await Promise.all(batches.map(batch => read(batch).catch(() => ({}))));
      if (live && run === sequence) setData(Object.assign({}, ...results));
    };
    setData({}); void refresh();
    const timer = setInterval(() => { void refresh(); }, 3600000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => { live = false; clearInterval(timer); listener.remove(); };
  }, [key, supplied, revision]);
  return supplied ?? data;
}
const readProgress = async (ids: readonly string[]) => (await getCoverProgress(ids)).progress;
const readEdges = async (ids: readonly string[]) => (await getForecastEdge(ids)).edges;
export const useCoverProgress = (ids: readonly string[], supplied?: Record<string, CoverProgress | null>, revision = 0) => useSignals(ids, readProgress, supplied, revision);
export const useForecastEdges = (ids: readonly string[], supplied?: Record<string, ForecastEdge>, revision = 0) => useSignals(ids, readEdges, supplied, revision);
