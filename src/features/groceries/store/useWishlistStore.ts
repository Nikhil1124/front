import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EnrichedProduct } from '../data/mockProducts';

interface WishlistState {
  items: EnrichedProduct[];
  addItem: (product: EnrichedProduct) => void;
  removeItem: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  toggleItem: (product: EnrichedProduct) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product) => set((state) => ({ items: [...state.items, product] })),
      removeItem: (productId) => set((state) => ({ items: state.items.filter((p) => p.id !== productId) })),
      isWishlisted: (productId) => get().items.some((p) => p.id === productId),
      toggleItem: (product) => {
        if (get().isWishlisted(product.id)) {
          get().removeItem(product.id);
        } else {
          get().addItem(product);
        }
      },
    }),
    {
      name: 'slv-wishlist',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
