import { CartItem } from '../store/useCartStore';

export type OrderStatus = 'received' | 'shopping' | 'checkout' | 'on-the-way' | 'delivered';

export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  'received',
  'shopping',
  'checkout',
  'on-the-way',
  'delivered',
];

export type ItemUpdateKind = 'found' | 'replaced' | 'refunded';

export interface OrderItemUpdate {
  productId: string;
  productName: string;
  kind: ItemUpdateKind;
  at: number;
  note?: string;
}

export interface DetailedOrder {
  id: string;
  items: CartItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  total: number;
  status: OrderStatus;
  mode: 'delivery' | 'pickup';
  slotLabel: string;
  addressLabel: string;
  paymentMethod: string;
  placedAt: number;
  etaMinutes: number;
  statusTimestamps: Partial<Record<OrderStatus, number>>;
  itemUpdates: OrderItemUpdate[];
}

export interface PlaceOrderPayload {
  items: CartItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  total: number;
  mode: 'delivery' | 'pickup';
  slotLabel: string;
  addressLabel: string;
  paymentMethod: string;
}

type Listener = () => void;

// Tunable step durations in ms for live simulation demo
const STEP_MS: Record<OrderStatus, number> = {
  received: 6000,
  shopping: 12000,
  checkout: 6000,
  'on-the-way': 10000,
  delivered: 0,
};

let orders: DetailedOrder[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

function notify() {
  for (const l of listeners) l();
}

function arm(orderId: string, fn: () => void, ms: number) {
  const t = setTimeout(fn, ms);
  const list = timers.get(orderId) ?? [];
  list.push(t);
  timers.set(orderId, list);
}

function clearTimers(orderId: string) {
  timers.get(orderId)?.forEach(clearTimeout);
  timers.delete(orderId);
}

function patch(orderId: string, fn: (o: DetailedOrder) => DetailedOrder) {
  let changed = false;
  orders = orders.map((o) => {
    if (o.id !== orderId) return o;
    changed = true;
    return fn(o);
  });
  if (changed) notify();
}

function advance(orderId: string) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;
  const idx = ORDER_STATUS_SEQUENCE.indexOf(order.status);
  if (idx >= ORDER_STATUS_SEQUENCE.length - 1) return; // delivered

  const next = ORDER_STATUS_SEQUENCE[idx + 1];
  patch(orderId, (o) => ({
    ...o,
    status: next,
    statusTimestamps: { ...o.statusTimestamps, [next]: Date.now() },
  }));

  // During shopping step, stream item update events
  if (next === 'shopping') {
    order.items.forEach((item, i) => {
      const kind: ItemUpdateKind =
        i === order.items.length - 1 && order.items.length > 2
          ? 'refunded'
          : i % 3 === 1
          ? 'replaced'
          : 'found';

      arm(
        orderId,
        () => {
          const update: OrderItemUpdate = {
            productId: item.id,
            productName: item.name,
            kind,
            at: Date.now(),
            note:
              kind === 'replaced'
                ? 'Swapped for closest available match'
                : kind === 'refunded'
                ? 'Out of stock — refunded to original payment'
                : undefined,
          };
          patch(orderId, (o) => ({
            ...o,
            itemUpdates: [update, ...o.itemUpdates],
          }));
        },
        Math.round((STEP_MS.shopping / (order.items.length + 1)) * (i + 1))
      );
    });
  }

  if (next !== 'delivered') {
    arm(orderId, () => advance(orderId), STEP_MS[next]);
  } else {
    clearTimers(orderId);
  }
}

function startEngine(orderId: string) {
  const order = orders.find((o) => o.id === orderId);
  if (!order || order.status === 'delivered') return;
  if (timers.has(orderId)) return;
  arm(orderId, () => advance(orderId), STEP_MS[order.status]);
}

export const orderEngine = {
  createOrder(payload: PlaceOrderPayload): DetailedOrder {
    const now = Date.now();
    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: DetailedOrder = {
      id: orderId,
      items: payload.items,
      subtotal: payload.subtotal,
      cgst: payload.cgst,
      sgst: payload.sgst,
      totalGst: payload.totalGst,
      deliveryFee: payload.deliveryFee,
      serviceFee: payload.serviceFee,
      tip: payload.tip,
      total: payload.total,
      mode: payload.mode,
      slotLabel: payload.slotLabel,
      addressLabel: payload.addressLabel,
      paymentMethod: payload.paymentMethod,
      status: 'received',
      placedAt: now,
      etaMinutes: payload.mode === 'delivery' ? 25 : 15,
      statusTimestamps: { received: now },
      itemUpdates: [],
    };

    orders = [newOrder, ...orders];
    notify();
    startEngine(newOrder.id);
    return newOrder;
  },

  getOrders(): DetailedOrder[] {
    return orders;
  },

  getOrder(id: string): DetailedOrder | undefined {
    return orders.find((o) => o.id === id);
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
