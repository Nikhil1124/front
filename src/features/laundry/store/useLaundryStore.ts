/**
 * The laundry cart and the pickup slot the resident is choosing — nothing else.
 *
 * This store used to own the ORDERS too: `activeOrder`, `completedOrders`, an 11-stage
 * `OrderStatus`, and a `placeOrder` that wrote the booking to React state and stopped there.
 * No request was ever created, so the "ACTIVE LAUNDRY ORDERS" list on the Hub Services tab
 * directly above the Book Pickup button — which reads real `kind: "laundry"` requests from
 * the server — stayed empty after a booking, and the order itself vanished on app restart.
 * Nobody in ops ever saw it.
 *
 * Orders now go through `submitLaundryBooking` and are read back with
 * `useLaundryRequestsQuery`, which is the split this app draws everywhere else: React Query
 * owns anything the server knows about, Zustand owns what only this device is doing right
 * now. A half-built cart is the second kind. See docs/adr/state-management.
 */
import { create } from 'zustand';

export type LaundryItem = {
  id: string;
  category: 'Wash & Fold' | 'Wash & Iron' | 'Dry Cleaning' | 'Shoes & Bags' | 'Home Linen';
  name: string;
  price: number;
  unit: 'kg' | 'piece' | 'set' | 'pair';
  imageSrc?: any;
};

/**
 * The rate card.
 *
 * ponytail: hardcoded on purpose — there is no laundry catalogue server-side (laundry is one
 * `kind` on the shared `requests` table, not a priced catalogue like supply), and inventing a
 * whole module to hold seventeen numbers that change maybe twice a year is not worth it. What
 * matters is that the price is not only here: every booking writes its own lines and unit
 * prices into `details.items`, so an order is billed at what was quoted, and editing this list
 * cannot rewrite an order that already exists. Move it server-side when rates need to differ
 * per area or change without an app release.
 */
export const LAUNDRY_SERVICES: LaundryItem[] = [
  // Wash & Fold
  { id: 'wf1', category: 'Wash & Fold', name: 'Regular Clothes', price: 80, unit: 'kg' },
  { id: 'wf2', category: 'Wash & Fold', name: 'Heavy Clothes', price: 120, unit: 'kg' },
  { id: 'wf3', category: 'Wash & Fold', name: 'Bedsheet', price: 60, unit: 'piece' },
  { id: 'wf4', category: 'Wash & Fold', name: 'Blanket', price: 150, unit: 'piece' },
  { id: 'wf5', category: 'Wash & Fold', name: 'Towels', price: 40, unit: 'piece' },
  // Wash & Iron
  { id: 'wi1', category: 'Wash & Iron', name: 'Shirt', price: 15, unit: 'piece' },
  { id: 'wi2', category: 'Wash & Iron', name: 'T-Shirt', price: 12, unit: 'piece' },
  { id: 'wi3', category: 'Wash & Iron', name: 'Trousers', price: 18, unit: 'piece' },
  { id: 'wi4', category: 'Wash & Iron', name: 'Jeans', price: 20, unit: 'piece' },
  { id: 'wi5', category: 'Wash & Iron', name: 'Kurta', price: 20, unit: 'piece' },
  // Dry Cleaning
  { id: 'dc1', category: 'Dry Cleaning', name: 'Blazer', price: 180, unit: 'piece' },
  { id: 'dc2', category: 'Dry Cleaning', name: 'Suit', price: 300, unit: 'set' },
  { id: 'dc3', category: 'Dry Cleaning', name: 'Saree', price: 200, unit: 'piece' },
  { id: 'dc4', category: 'Dry Cleaning', name: 'Jacket', price: 180, unit: 'piece' },
  // Shoes & Bags
  { id: 'sb1', category: 'Shoes & Bags', name: 'Sneakers', price: 150, unit: 'pair' },
  { id: 'sb2', category: 'Shoes & Bags', name: 'Formal Shoes', price: 150, unit: 'pair' },
  { id: 'sb3', category: 'Shoes & Bags', name: 'Handbag', price: 180, unit: 'piece' },
];

/** Pickup slots and pay modes, shared by the booking flow so both screens offer the same set. */
export const LAUNDRY_PICKUP_DATES = ['Today', 'Tomorrow'];
export const LAUNDRY_PICKUP_TIMES = [
  '8:00 AM – 10:00 AM',
  '12:00 PM – 2:00 PM',
  '5:00 PM – 7:00 PM',
];
export const LAUNDRY_PAY_MODES = ['Added to Room Bill', 'UPI', 'Cash on Pickup'];

/** What the cart adds up to, at the rates it was built at. */
export function laundryCartTotal(cart: Record<string, number>): number {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = LAUNDRY_SERVICES.find((p) => p.id === id);
    return sum + (product ? product.price * qty : 0);
  }, 0);
}

interface LaundryStore {
  cart: Record<string, number>;
  updateCart: (id: string, delta: number) => void;
  clearCart: () => void;

  pickupDetails: {
    date: string;
    time: string;
    instructions: string;
    payMode: string;
  };
  setPickupDetails: (details: Partial<LaundryStore['pickupDetails']>) => void;
  resetPickupDetails: () => void;
}

const INITIAL_PICKUP = {
  date: LAUNDRY_PICKUP_DATES[0],
  time: LAUNDRY_PICKUP_TIMES[2],
  instructions: '',
  payMode: LAUNDRY_PAY_MODES[0],
};

export const useLaundryStore = create<LaundryStore>((set) => ({
  cart: {},
  updateCart: (id, delta) => set((state) => {
    const newQty = Math.max(0, (state.cart[id] || 0) + delta);
    const newCart = { ...state.cart };
    if (newQty === 0) {
      delete newCart[id];
    } else {
      newCart[id] = newQty;
    }
    return { cart: newCart };
  }),
  clearCart: () => set({ cart: {} }),

  pickupDetails: { ...INITIAL_PICKUP },
  setPickupDetails: (details) => set((state) => ({
    pickupDetails: { ...state.pickupDetails, ...details },
  })),
  resetPickupDetails: () => set({ pickupDetails: { ...INITIAL_PICKUP } }),
}));
