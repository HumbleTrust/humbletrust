import { create } from "zustand";

interface AppState {
  network: "devnet" | "mainnet-beta";
  sidebarTab: "explore" | "launch" | "portfolio" | "analytics";
  launchStep: number;
  setNetwork: (n: "devnet" | "mainnet-beta") => void;
  setSidebarTab: (t: AppState["sidebarTab"]) => void;
  setLaunchStep: (s: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  network: "devnet",
  sidebarTab: "explore",
  launchStep: 0,
  setNetwork: (network) => set({ network }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setLaunchStep: (launchStep) => set({ launchStep }),
}));
