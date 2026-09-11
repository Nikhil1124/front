/**
 * Re-groups the catalogue's one-row-per-pack items into one product per card.
 *
 * The server sells a pack, not a weight — "Onion (250 g)", "Onion (500 g)", "Onion (1 kg)" and
 * "Onion (2 kg)" are four rows with four prices, deliberately ("resist modelling kg/g/pack
 * conversion", `models/catalog.py`). What ties them together is `variant_group`, a free-text
 * tag the same file describes as "purely how the client re-groups those rows into one product
 * card with a size picker".
 *
 * Nothing had ever used it. Every pack was its own card, so a shop with 210 items showed 210
 * cards where it has 55 products — four Onion cards in a row, differing only by a number in
 * the name.
 *
 * Grouping is presentation only. The thing added to the cart is still the individual pack row,
 * with its own id and its own price.
 */
import type { SupplyItem } from '@/types';

/** How big a pack is, in the item's own base unit, for ordering the size chips. */
function packSize(unitLabel: string): number {
  const m = unitLabel.match(/([\d.]+)\s*(kg|g|l|ml|eggs?|pcs?|piece)/i);
  if (!m) return Number.POSITIVE_INFINITY; // unparseable sorts last, order untouched
  const value = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'kg' || unit === 'l') return value * 1000;
  return value;
}

/**
 * One entry per product, each holding its pack sizes smallest-first.
 *
 * Input order is preserved: a group takes the position of its first member, so a list that was
 * sorted by price or name does not get reshuffled by grouping. An item with no `variant_group`
 * is its own group of one — every item in the current catalogue has the tag, but an item added
 * through the admin UI without one must still appear.
 */
export function groupByVariant(items: SupplyItem[]): SupplyItem[][] {
  const groups = new Map<string, SupplyItem[]>();
  const order: string[] = [];

  for (const item of items) {
    // Fall back to the item's own id so an untagged item cannot collide with another.
    const key = item.variant_group?.trim() || `__solo_${item.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
      order.push(key);
    }
  }

  return order.map((key) => {
    const group = groups.get(key)!;
    return group.length > 1
      ? [...group].sort((a, b) => packSize(a.unit_label) - packSize(b.unit_label))
      : group;
  });
}

/**
 * The product's name without its pack size — "Onion (250 g)" → "Onion".
 *
 * Only used when a card actually shows a size picker: with the chips right underneath, the
 * size in the title is the same fact twice, and it is the half that makes four cards look
 * like four products.
 */
export function baseProductName(name: string): string {
  return name.replace(/\s*\([^()]*\)\s*$/, '').trim() || name;
}
