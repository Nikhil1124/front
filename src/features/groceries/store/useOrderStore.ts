import { create } from 'zustand';
import { orderEngine, DetailedOrder, PlaceOrderPayload, OrderStatus } from '../services/orderEngine';
import { CartItem } from './useCartStore';

export { DetailedOrder, OrderStatus };

interface OrderState {
  orders: DetailedOrder[];
  activeOrder: DetailedOrder | null;
  placeOrder: (payload: PlaceOrderPayload) => DetailedOrder;
  getOrderById: (id: string) => DetailedOrder | undefined;
  refreshOrders: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => {
  // Subscribe to orderEngine updates to auto-sync Zustand store
  orderEngine.subscribe(() => {
    const freshOrders = orderEngine.getOrders();
    set({
      orders: freshOrders,
      activeOrder: freshOrders.find((o) => o.status !== 'delivered') || freshOrders[0] || null,
    });
  });

  return {
    orders: [],
    activeOrder: null,
    placeOrder: (payload) => {
      const newOrder = orderEngine.createOrder(payload);
      set({
        orders: orderEngine.getOrders(),
        activeOrder: newOrder,
      });
      return newOrder;
    },
    getOrderById: (id) => {
      return orderEngine.getOrder(id);
    },
    refreshOrders: () => {
      const currentOrders = orderEngine.getOrders();
      set({
        orders: currentOrders,
        activeOrder: currentOrders.find((o) => o.status !== 'delivered') || currentOrders[0] || null,
      });
    },
  };
});

