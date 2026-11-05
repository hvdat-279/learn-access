import { create } from "zustand";
import { preference } from "../data/repository";
export type Settings = {
  dark: boolean;
  fontSize: number;
  lineHeight: number;
  rate: number;
  voice: string;
  onboarded: boolean;
};
const defaults: Settings = {
  dark: false,
  fontSize: 18,
  lineHeight: 1.7,
  rate: 1,
  voice: "",
  onboarded: false,
};
function initial(): Settings {
  try {
    return { ...defaults, ...JSON.parse(preference.get("settings") || "{}") };
  } catch {
    return defaults;
  }
}
export const useSettings = create<
  Settings & { change: (patch: Partial<Settings>) => void }
>((set) => ({
  ...initial(),
  change: (patch) =>
    set((state) => {
      const next = { ...state, ...patch };
      preference.set("settings", JSON.stringify(next));
      return next;
    }),
}));
