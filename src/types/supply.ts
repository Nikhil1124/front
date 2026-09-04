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
  /** Per-item GST percentage. Groceries are not one flat rate — the server carries 0/5/12/18
   *  per item and prices tax-INCLUSIVE (`price` is what the customer pays), so this is what
   *  the client needs to break the tax out of a line rather than add it on top. */
  gst_rate?: number;
  hsn_code?: string;
}

export type KitchenMenuMealType = 'veg' | 'non_veg' | 'pure_veg';

export type KitchenMenuWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** A catalog item plus how many packs one day's recipe needs. Never a name/price snapshot —
 *  resolved against the live catalog on every read, per pg-backend's `models/kitchen_menu.py`. */
export interface KitchenMenuIngredient extends SupplyItem {
  quantity: number;
}

/** One weekday of a PG's recurring kitchen plan. The server always returns all seven,
 *  synthesizing an empty one (`meal_type: null`) for a day nobody has configured yet. */
export interface KitchenMenuDay {
  weekday: KitchenMenuWeekday;
  meal_type: KitchenMenuMealType | null;
  dishes: string[];
  ingredients: KitchenMenuIngredient[];
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


/** Mirrors the server's `PaymentMethodName` literal (supply/schemas.py). It is NOT the same
 *  set as credit-payment methods — 'cash' belongs to that other enum, and sending it here is
 *  a 422. */
export type SupplyPaymentMethod = 'card' | 'upi' | 'credit' | 'cod';

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
  /** The server's own split of a tax-inclusive total: taxable_amount + tax_amount ==
   *  total_amount, exactly (it derives tax as the remainder so the two always reconcile).
   *  There is no separate delivery fee or discount on a supply order — `total_amount` is
   *  the sum of line totals, full stop; earlier versions of this type invented
   *  `subtotal_amount`/`delivery_fee`/`discount_amount` fields the server never sent,
   *  which is why the order-detail bill used to render "₹NaN". */
  taxable_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: SupplyPaymentMethod;
  payment_status: 'pending' | 'submitted' | 'paid' | 'failed' | 'refunded';
  /** The server's field is singular `delivery_note` and there is no slot column — the
   *  chosen slot is prefixed into this note at checkout. */
  delivery_note?: string;
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

