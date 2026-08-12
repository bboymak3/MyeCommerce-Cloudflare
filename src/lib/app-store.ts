import { create } from "zustand";

interface AppState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cartItemCount: number;
  setCartItemCount: (n: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: "pos",
  setActiveTab: (tab) => set({ activeTab: tab }),
  cartItemCount: 0,
  setCartItemCount: (n) => set({ cartItemCount: n }),
}));
