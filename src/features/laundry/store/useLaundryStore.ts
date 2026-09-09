import { create } from 'zustand';

export type LaundryItem = {
  id: string;
  category: 'Wash & Fold' | 'Wash & Iron' | 'Dry Cleaning' | 'Shoes & Bags' | 'Home Linen';
  name: string;
  price: number;
  unit: 'kg' | 'piece' | 'set' | 'pair';
  imageSrc?: any;
};

// Hardcoded menu
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

export type OrderStatus = 
  | 'BOOKING_CONFIRMED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'WEIGHED'
  | 'WASHING'
  | 'DRYING'
  | 'IRONING'
  | 'QUALITY_CHECK'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

export type LaundryOrder = {
  id: string;
  status: OrderStatus;
  items: Record<string, number>; // id -> quantity
  pickupDate: string;
  pickupTime: string;
  pickupLocation: string;
  instructions: string;
  estimatedReturn: string;
  estimatedTotal: number;
  finalTotal?: number; // if weighed
  createdAt: string;
};

interface LaundryStore {
  // Cart
  cart: Record<string, number>;
  updateCart: (id: string, delta: number) => void;
  clearCart: () => void;

  // Checkout flow state
  pickupDetails: {
    date: string;
    time: string;
    instructions: string;
  };
  setPickupDetails: (details: Partial<LaundryStore['pickupDetails']>) => void;

  // Orders
  activeOrder: LaundryOrder | null;
  completedOrders: LaundryOrder[];
  placeOrder: (order: LaundryOrder) => void;
  updateOrderStatus: (status: OrderStatus) => void;
}

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

  pickupDetails: {
    date: 'Today',
    time: '5:00 PM – 7:00 PM',
    instructions: '',
  },
  setPickupDetails: (details) => set((state) => ({ 
    pickupDetails: { ...state.pickupDetails, ...details } 
  })),

  activeOrder: null,
  completedOrders: [
    {
      id: '#LW10261',
      status: 'DELIVERED',
      items: { 'wf1': 2, 'wi1': 5 },
      pickupDate: 'Sep 7',
      pickupTime: '10:00 AM – 12:00 PM',
      pickupLocation: 'PGow • Room 204',
      instructions: '',
      estimatedReturn: 'Sep 8 • 6:00 PM',
      estimatedTotal: 340,
      finalTotal: 340,
      createdAt: '2026-09-07T10:00:00Z',
    }
  ],
  placeOrder: (order) => set({ activeOrder: order }),
  updateOrderStatus: (status) => set((state) => {
    if (!state.activeOrder) return state;
    
    // If delivered, move to completed
    if (status === 'DELIVERED') {
      const finishedOrder = { ...state.activeOrder, status };
      return { 
        activeOrder: null, 
        completedOrders: [finishedOrder, ...state.completedOrders] 
      };
    }
    
    return { activeOrder: { ...state.activeOrder, status } };
  }),
}));
