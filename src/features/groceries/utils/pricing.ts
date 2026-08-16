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

function unitLabel(unitStr: string): string {
  const type = unitStr.toLowerCase();
  if (type.includes('kg')) return 'kg';
  if (type.includes('g')) return 'g';
  if (type.includes('l')) return 'L';
  if (type.includes('ml')) return 'ml';
  if (type.includes('pc') || type.includes('dozen') || type.includes('pair') || type.includes('score') || type.includes('gross')) return 'pc';
  return 'unit';
}

/** "₹N/kg" style label for a bulk-pricing option, e.g. for "10 dozen (120 pcs)" @ ₹610 -> "₹5/pc". */
export function getPerUnitRateLabel(unitStr: string, price: number): string {
  const qty = parseUnitQuantity(unitStr);
  if (qty <= 0) return '';
  const perUnit = Math.round(price / qty);
  return `₹${perUnit}/${unitLabel(unitStr)}`;
}
