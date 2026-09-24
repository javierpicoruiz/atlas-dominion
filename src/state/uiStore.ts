import { create } from "zustand";
export type Tab = "World" | "Forces" | "Economy" | "Tech" | "Diplomacy";
export type CityTab = "Overview" | "Buildings" | "Army";
interface UiState {
  tab: Tab;
  selectedCityId: string | null;
  cityTab: CityTab;
  selectedArmyId: string | null;
  selectArmy: (id: string | null) => void;
  selectCity: (id: string | null) => void;
  setTab: (tab: Tab) => void;
  setCityTab: (tab: CityTab) => void;
}
export const useUiStore = create<UiState>((set) => ({
  tab: "World",
  selectedCityId: null,
  cityTab: "Overview",
  selectedArmyId: null,
  selectArmy: (id) => set({ selectedArmyId: id, selectedCityId: null }),
  selectCity: (id) =>
    set({ selectedCityId: id, selectedArmyId: null, cityTab: "Overview" }),
  setTab: (tab) => set({ tab, selectedCityId: null, selectedArmyId: null }),
  setCityTab: (cityTab) => set({ cityTab }),
}));
