import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoppingMode = 'owner' | 'guest';
export type StayDuration = '1-2' | '3-5' | '1+' | null;

interface ShoppingModeState {
  mode: ShoppingMode;
  stayDuration: StayDuration;
  pgName: string;
  location: string;
  setMode: (mode: ShoppingMode) => void;
  setStayDuration: (duration: StayDuration) => void;
  setPgDetails: (pgName: string, location: string) => void;
}

export const useShoppingModeStore = create<ShoppingModeState>()(
  persist(
    (set) => ({
      mode: 'guest',
      stayDuration: null,
      pgName: 'SLV Premium PG',
      location: 'Indiranagar, Bangalore',
      setMode: (mode) => set({ mode }),
      setStayDuration: (stayDuration) => set({ stayDuration }),
      setPgDetails: (pgName, location) => set({ pgName, location }),
    }),
    {
      name: 'slv-shopping-mode',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
