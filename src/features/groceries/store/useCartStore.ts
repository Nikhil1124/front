import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupplyItem } from '@/types';
import { splitTaxInclusive } from '../utils/pricing';

export type ReplacementPreference = 'best-match' | 'specific' | 'refund';

export interface CartItem {
  id: string; // compound key: productId + '-' + unit
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string | null;
  unit: string;
  category: string;
  quantity: number;
  replacement?: ReplacementPreference;
  /** Copied off the catalog item at add-to-cart time so the bill can show real GST. */
  gstRate?: number;
}

/**
 * What the cart can honestly say about the bill before the server prices it.
 *
 * There used to be a `GSTDetails` here that applied a flat 2.5% CGST + 2.5% SGST to every
 * line. Two things were wrong with it: Indian grocery GST is per-item (0/5/12/18%), so one
 * blanket rate is wrong for most baskets; and checkout POSTs only `item_id` + `quantity`
 * (see GroceryCheckoutScreen), so the server prices the order itself and returns
 * `subtotal_amount` / `discount_amount` / `total_amount`. The tax shown here was a number
 * this client made up and the server never agreed with. Taxes now appear once the order
 * exists and the server has stated them.
 */
export interface BillEstimate {
  /** What the customer pays for the items. GST is already inside this, not added to it. */
  subtotal: number;
  savings: number;
  /** The tax already contained in `subtotal`, broken out per item at that item's own rate. */
  tax: number;
  /** `subtotal - tax`. Shown as the pre-tax figure on the bill. */
  taxable: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: SupplyItem, selectedOption: { unit: string; price: number; originalPrice?: number }, qty?: number) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  setReplacement: (cartItemId: string, preference: ReplacementPreference) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getBillEstimate: () => BillEstimate;
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
            image: product.image_url ?? null,
            unit: option.unit,
            category: product.category_id,
            quantity: qty,
            replacement: 'best-match',
            gstRate: product.gst_rate,
          };
          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (cartItemId) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== cartItemId) })),

      // quantity <= 0 removes the line rather than leaving a zero/negative-quantity item -
      // this used to be a guard every caller had to reimplement (four separate copies of
      // "if qty > 1 update else remove"); owning it here means calling updateQuantity
      // unconditionally is always correct.
      updateQuantity: (cartItemId, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((item) => item.id !== cartItemId)
            : state.items.map((item) =>
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

      getBillEstimate: () => {
        // Mirrors `_split_tax_inclusive` in pg-backend supply/service/ordering.py: the line
        // total is rounded first, the taxable base is derived from it, and the tax is the
        // REMAINDER rather than being rounded independently — so the two always reconcile to
        // the line total exactly and this estimate matches the order the server writes.
        //
        // The previous version added a flat 2.5% + 2.5% ON TOP of the subtotal. That was
        // wrong twice over: the rate is per-item (0/5/12/18), and `price` is already
        // tax-inclusive, so adding tax overstated every basket by roughly 5%.
        let subtotal = 0;
        let tax = 0;
        for (const item of get().items) {
          const lineTotal = Math.round(item.price * item.quantity * 100) / 100;
          subtotal += lineTotal;
          tax += splitTaxInclusive(lineTotal, item.gstRate ?? 0).tax;
        }
        subtotal = Math.round(subtotal * 100) / 100;
        tax = Math.round(tax * 100) / 100;
        return {
          subtotal,
          tax,
          taxable: Math.round((subtotal - tax) * 100) / 100,
          savings: Math.round(get().getTotalSavings() * 100) / 100,
        };
      },

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
