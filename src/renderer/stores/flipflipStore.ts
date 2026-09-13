import { create } from "zustand";
import { defaultInitialState } from "../data/AppStorage";

export const useStore = create<any>(() => ({ ...defaultInitialState }));
