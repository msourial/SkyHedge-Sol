import { useEffect } from "react";
type AppTab = "weather" | "catalog" | "protect" | "wallet";

export const initialLandingVisible = () => false;
export function initialAppTab(): AppTab {
  const path = window.location.pathname.replace(/\/$/, "").split("/")[2];
  const requested = path || new URLSearchParams(window.location.search).get("tab");
  return requested === "wallet" || requested === "protect" ? requested : "catalog";
}
export const walletRestoreTab = initialAppTab;
export function useAppNavigation(tab: AppTab, setTab: (tab: AppTab) => void) {
  useEffect(() => {
    const onPop = () => setTab(initialAppTab());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setTab]);
  useEffect(() => {
    const path = tab === "catalog" || tab === "weather" ? "/app" : `/app/${tab}`;
    if (window.location.pathname.replace(/\/$/, "") !== path) window.history.pushState(null, "", path);
  }, [tab]);
}
