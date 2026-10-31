export type AppTab = "weather" | "catalog" | "protect" | "wallet";
export const initialAppTab = (): AppTab => "catalog";
export const walletRestoreTab = (): AppTab => "protect";
export const initialLandingVisible = () => true;
export function useAppNavigation(_tab: AppTab, _setTab: (tab: AppTab) => void) {}
