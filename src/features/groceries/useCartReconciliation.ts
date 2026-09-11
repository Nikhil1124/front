/**
 * Reconcile a persisted cart against the live catalog.
 *
 * `useCartStore` persists a snapshot of each line — id, name, price — taken when the item was
 * added. The catalog moves underneath it: an item is retired (`is_active=false`) or repriced,
 * and the cart keeps showing what it captured. Two consequences, and the first is the reason
 * this exists:
 *
 *   - `createOrder` sends `item_id` per line, and the server answers `not_found("Item")` for
 *     anything it cannot resolve. One retired line fails the WHOLE order, including every
 *     valid line beside it, with nothing on screen saying which one was at fault.
 *   - a repriced line shows the old number until checkout, where the server bills the real
 *     one. The total the user agreed to is not the total they are charged.
 *
 * Detection only — this reports, it does not mutate the cart. Silently deleting someone's
 * basket while they are looking at it is worse than telling them what changed, and the user
 * is the one who should decide whether a 30% price rise still suits them.
 */
import { useMemo } from 'react';

import { useCartStore } from './store/useCartStore';
import { useSupplyItems } from './useSupply';

export interface CartDrift {
  /** Lines whose product is no longer in the catalog — these will 404 the entire order. */
  unavailable: { cartItemId: string; name: string }[];
  /** Lines whose live price differs from the one captured at add-to-cart time. */
  repriced: { cartItemId: string; name: string; was: number; now: number }[];
  /** True when the cart cannot be checked out as-is. */
  blocking: boolean;
}

export function useCartDrift(pgId?: string): CartDrift & { isLoading: boolean } {
  const items = useCartStore((s) => s.items);
  const { data: catalog, isLoading } = useSupplyItems(pgId);

  return useMemo(() => {
    // Until the catalog resolves there is nothing to compare against, and reporting every
    // line as "unavailable" during the fetch would be worse than reporting nothing.
    if (!catalog) {
      return { unavailable: [], repriced: [], blocking: false, isLoading };
    }
    const live = new Map(catalog.map((p) => [p.id, p]));
    const unavailable: CartDrift['unavailable'] = [];
    const repriced: CartDrift['repriced'] = [];

    for (const line of items) {
      const product = live.get(line.productId);
      if (!product) {
        unavailable.push({ cartItemId: line.id, name: line.name });
        continue;
      }
      // The cart line is a specific pack size; the catalog row for that size carries its own
      // price, so a straight compare is right. A difference of paise is still a difference —
      // the server bills its own number either way.
      if (Number(product.price) !== Number(line.price)) {
        repriced.push({
          cartItemId: line.id, name: line.name,
          was: Number(line.price), now: Number(product.price),
        });
      }
    }
    return { unavailable, repriced, blocking: unavailable.length > 0, isLoading };
  }, [items, catalog, isLoading]);
}
