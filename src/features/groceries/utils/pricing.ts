/**
 * Per-unit rate parsing for bulk-pricing comparisons (owner mode).
 *
 * Was duplicated (identically, bugs included) between BulkPricingGrid.tsx and
 * GroceryCartScreen.tsx. Both only read the leading number in a unit string like
 * "10 dozen (120 pcs)", getting 10 instead of 120 - a ~12x-wrong per-unit rate.
 *
 * Fix scope: apply a multiplier for standard English count words (dozen, pair, etc.)
 * to the leading number. Deliberately NOT attempting to parse arbitrary parenthetical
 * hints like "2-pack (140g)" - "pack" has no fixed size, so the parenthetical weight
 * isn't safely derivable from the leading count, and guessing would just trade one
 * wrong number for a different one. Those cases fall back to the leading number, same
 * as before.
 */

const COUNT_WORD_MULTIPLIERS: { pattern: RegExp; multiplier: number }[] = [
  { pattern: /half[\s-]?dozen/i, multiplier: 6 },
  { pattern: /dozen/i, multiplier: 12 },
  { pattern: /\bpair\b/i, multiplier: 2 },
  { pattern: /\bscore\b/i, multiplier: 20 },
  { pattern: /\bgross\b/i, multiplier: 144 },
];

/** The effective quantity a unit string represents, after applying any count-word multiplier. */
export function parseUnitQuantity(unitStr: string): number {
  const numMatch = unitStr.match(/^(\d+(\.\d+)?)/);
  if (!numMatch) return 0;
  const leading = parseFloat(numMatch[1]);
  const wordMatch = COUNT_WORD_MULTIPLIERS.find(({ pattern }) => pattern.test(unitStr));
  return wordMatch ? leading * wordMatch.multiplier : leading;
}

/**
 * Longest unit first, always. `includes('l')` used to be tested before `includes('ml')`, so
 * every millilitre unit came back labelled "L" — a 1000x-wrong rate on the very label this
 * module exists to get right. Ordering is the whole correctness argument here, so the units
 * are listed longest-first rather than by hand-written `if`s that can be reordered by
 * accident.
 */
const UNIT_LABELS: [needle: string, label: string][] = [
  ['kg', 'kg'],
  ['ml', 'ml'],
  ['dozen', 'pc'],
  ['pair', 'pc'],
  ['score', 'pc'],
  ['gross', 'pc'],
  ['pc', 'pc'],
  ['g', 'g'],
  ['l', 'L'],
];

function unitLabel(unitStr: string): string {
  const type = unitStr.toLowerCase();
  return UNIT_LABELS.find(([needle]) => type.includes(needle))?.[1] ?? 'unit';
}

/** "₹N/kg" style label for a bulk-pricing option, e.g. for "10 dozen (120 pcs)" @ ₹610 -> "₹5/pc". */
export function getPerUnitRateLabel(unitStr: string, price: number): string {
  const qty = parseUnitQuantity(unitStr);
  if (qty <= 0) return '';
  const perUnit = price / qty;
  // `Math.round` alone turned every sub-rupee rate into "₹0" — which is most of them once
  // the unit is grams or millilitres (₹100 for 500 ml is ₹0.20/ml, shown as "₹0/ml", i.e.
  // free). At or above ₹1 a whole number is what a shopper wants to compare; below it, the
  // decimals ARE the number.
  const shown = perUnit >= 1 ? String(Math.round(perUnit)) : perUnit.toFixed(2).replace(/\.?0+$/, '');
  return `₹${shown}/${unitLabel(unitStr)}`;
}

/**
 * Split a GST-INCLUSIVE amount into its taxable base and the tax inside it.
 *
 * Mirrors `_split_tax_inclusive` in pg-backend `supply/service/ordering.py`, deliberately
 * step for step: `supply_items.price` is what the customer pays, so tax is broken OUT of the
 * line rather than added to it, the taxable base is rounded, and the tax is the REMAINDER
 * rather than being rounded on its own. Rounding the two independently would let them drift
 * a paisa apart from the line total, and the client bill would stop reconciling with the
 * order the server writes.
 */
export function splitTaxInclusive(lineTotal: number, gstRate: number): { taxable: number; tax: number } {
  const rounded = Math.round(lineTotal * 100) / 100;
  const taxable = Math.round((rounded / (1 + (gstRate || 0) / 100)) * 100) / 100;
  return { taxable, tax: Math.round((rounded - taxable) * 100) / 100 };
}
