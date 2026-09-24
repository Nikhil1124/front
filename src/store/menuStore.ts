import { create } from 'zustand';
import type { MealType } from '@/types';

interface MenuState {
  selectedMealType: MealType;
  selectedDishes: string[];
  searchQuery: string;
  selectedCategory: string;

  setMealType: (type: MealType) => void;
  setSearchQuery: (query: string) => void;
  setCategory: (category: string) => void;
  
  addDish: (dishName: string) => void;
  removeDish: (dishName: string) => void;
  toggleDish: (dishName: string) => void;
  clearDishes: () => void;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  selectedMealType: 'lunch',
  selectedDishes: [],
  searchQuery: '',
  selectedCategory: 'All',

  setMealType: (type) => set({ selectedMealType: type }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCategory: (category) => set({ selectedCategory: category }),

  addDish: (dishName) => {
    const current = get().selectedDishes;
    if (!current.includes(dishName)) {
      set({ selectedDishes: [...current, dishName] });
    }
  },
  removeDish: (dishName) => {
    set({ selectedDishes: get().selectedDishes.filter((d) => d !== dishName) });
  },
  toggleDish: (dishName) => {
    const current = get().selectedDishes;
    if (current.includes(dishName)) {
      set({ selectedDishes: current.filter((d) => d !== dishName) });
    } else {
      set({ selectedDishes: [...current, dishName] });
    }
  },
  clearDishes: () => set({ selectedDishes: [] }),
}));
