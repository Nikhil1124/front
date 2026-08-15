import { create } from 'zustand';

/**
 * pushScreen() takes no params, so a screen that needs to know "which item"
 * (product/category/order) reads it from here instead — set right before
 * pushScreen, same pattern the app already leans on for detail screens.
 */
interface GroceryUiState {
  selectedCategoryName: string | null;
  selectedProductId: string | null;
  selectedOrderId: string | null;
  setSelectedCategoryName: (name: string | null) => void;
  setSelectedProductId: (id: string | null) => void;
  setSelectedOrderId: (id: string | null) => void;
}

export const useGroceryUiStore = create<GroceryUiState>((set) => ({
  selectedCategoryName: null,
  selectedProductId: null,
  selectedOrderId: null,
  setSelectedCategoryName: (selectedCategoryName) => set({ selectedCategoryName }),
  setSelectedProductId: (selectedProductId) => set({ selectedProductId }),
  setSelectedOrderId: (selectedOrderId) => set({ selectedOrderId }),
}));
