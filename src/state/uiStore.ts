import { create } from "zustand";
export type Tab = "World" | "Forces" | "Economy" | "Tech" | "Diplomacy";
export type CityTab = "Overview" | "Buildings" | "Army";
interface UiState {
  tab: Tab;
  selectedCityId: string | null;
  cityTab: CityTab;
  selectCity: (id: string | null) => void;
  setTab: (tab: Tab) => void;
  setCityTab: (tab: CityTab) => void;
}
export const useUiStore = create<UiState>((set) => ({
  tab: "World",
  selectedCityId: null,
  cityTab: "Overview",
  selectCity: (id) => set({ selectedCityId: id, cityTab: "Overview" }),
  setTab: (tab) => set({ tab, selectedCityId: null }),
  setCityTab: (cityTab) => set({ cityTab }),
}));
