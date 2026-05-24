import { create } from "zustand";
import type { DashboardTab } from "@/types";

type AppState = {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeTab: "explore",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
