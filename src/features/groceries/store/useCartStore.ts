import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EnrichedProduct } from '../data/mockProducts';

export type ReplacementPreference = 'best-match' | 'specific' | 'refund';

export const FREE_DELIVERY_THRESHOLD = 0;

export interface CartItem {
  id: string; // compound key: productId + '-' + unit
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: any;
  unit: string;
  category: string;
  quantity: number;
  replacement?: ReplacementPreference;
}

export interface GSTDetails {
  cgst: number;
  sgst: number;
  totalGst: number;
  grandTotal: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: EnrichedProduct, selectedOption: { unit: string; price: number; originalPrice?: number }, qty?: number) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  setReplacement: (cartItemId: string, preference: ReplacementPreference) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getGSTDetails: () => GSTDetails;
  getAmountToFreeDelivery: () => number;
  getFreeDeliveryProgress: () => number;
  getTotalSavings: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, option, qty = 1) => {
        set((state) => {
          const compoundId = `${product.id}-${option.unit}`;
          const existingItem = state.items.find((item) => item.id === compoundId);
          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.id === compoundId
                  ? { ...item, quantity: item.quantity + qty }
                  : item
              ),
            };
          }
          const newItem: CartItem = {
            id: compoundId,
            productId: product.id,
            name: product.name,
            price: option.price,
            originalPrice: option.originalPrice,
            image: product.image,
            unit: option.unit,
            category: product.category,
            quantity: qty,
            replacement: 'best-match',
          };
          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (cartItemId) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== cartItemId) })),

      updateQuantity: (cartItemId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === cartItemId ? { ...item, quantity } : item
          ),
        })),

      setReplacement: (cartItemId, preference) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === cartItemId ? { ...item, replacement: preference } : item
          ),
        })),

      clearCart: () => set({ items: [] }),

      getCartTotal: () =>
        get().items.reduce((total, item) => total + item.price * item.quantity, 0),

      getGSTDetails: () => {
        const subtotal = get().getCartTotal();
        const cgst = Math.round(subtotal * 0.025 * 100) / 100;
        const sgst = Math.round(subtotal * 0.025 * 100) / 100;
        const totalGst = Math.round((cgst + sgst) * 100) / 100;
        const grandTotal = Math.round((subtotal + totalGst) * 100) / 100;
        return { cgst, sgst, totalGst, grandTotal };
      },

      getAmountToFreeDelivery: () => 0,
      getFreeDeliveryProgress: () => 1,

      getTotalSavings: () =>
        get().items.reduce((sum, item) => {
          if (item.originalPrice && item.originalPrice > item.price) {
            return sum + (item.originalPrice - item.price) * item.quantity;
          }
          return sum;
        }, 0),

      getItemCount: () =>
        get().items.reduce((total, item) => total + item.quantity, 0),
    }),
    {
      name: 'slv-cart',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the items array — derived getters are re-computed
      partialize: (state) => ({ items: state.items }),
    }
  )
);
