export interface SupplyCategory {
  id: string;
  name: string;
  sort_order: number;
  area_id?: string;
  is_active?: boolean;
}

export interface SupplyItem {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  unit_label: string;
  price: number;
  mrp?: number | null;
  variant_group?: string | null;
  image_url?: string | null;
  available?: boolean;
  is_active?: boolean;
}

export type SupplyOrderStatus =
  | 'draft'
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'loaded'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';


export type SupplyPaymentMethod = 'upi' | 'credit' | 'cash';

export interface SupplyOrderItem {
  id: string;
  order_id: string;
  item_id: string;
  item_name: string;
  unit_label: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  fulfilled_quantity?: number;
  status?: string;
}

export interface SupplyOrderDetail {
  id: string;
  order_no: string;
  pg_id: string;
  area_id?: string;
  user_id?: string;
  user_name?: string;
  user_phone?: string;
  status: SupplyOrderStatus;
  subtotal_amount: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
  payment_method: SupplyPaymentMethod;
  payment_status: 'pending' | 'submitted' | 'paid' | 'failed' | 'refunded';
  delivery_slot?: string;
  delivery_notes?: string;
  items: SupplyOrderItem[];
  created_at: string;
  updated_at?: string;
}

export interface SupplyOrderSummary {
  id: string;
  order_no: string;
  pg_id: string;
  pg_name?: string;
  area_id?: string;
  status: SupplyOrderStatus;
  total_amount: number;
  item_count: number;
  created_at: string;
}

