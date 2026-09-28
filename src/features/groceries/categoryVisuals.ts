/**
 * A category's picture and tile colour. Ops set both in the portal; until they do, the app
 * falls back to a picture it ships with, chosen by the category's name.
 *
 * One copy — the home grid, the quick chips and the categories screen each had their own
 * name-matching, and they had already started to disagree.
 */
import type { SupplyCategory } from '@/types';
import { Palette } from '@/theme';

function shippedPicture(name: string) {
  const n = name.toLowerCase();
  if (n.includes('fruit') || n.includes('veg'))
    return require('../../../assets/productimages/promo_fresh_picks_nobg.webp');
  if (n.includes('dairy') || n.includes('milk') || n.includes('bread') || n.includes('egg'))
    return require('../../../assets/productimages/cat_dairy_nobg.webp');
  if (n.includes('chicken') || n.includes('meat') || n.includes('fish'))
    return require('../../../assets/productimages/cat_chicken_eggs_nobg.webp');
  if (
    ['oil', 'masala', 'ghee', 'spice', 'atta', 'rice', 'dal', 'grain'].some((k) => n.includes(k))
  )
    return require('../../../assets/productimages/cat_masala_nobg.webp');
  return require('../../../assets/productimages/cat_addons_nobg.webp');
}

function shippedTint(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('fruit') || n.includes('veg')) return Palette.TintGreen;
  if (n.includes('dairy') || n.includes('milk') || n.includes('bread')) return Palette.TintAmber;
  if (n.includes('chicken') || n.includes('meat') || n.includes('egg')) return Palette.TintRed;
  if (n.includes('oil') || n.includes('masala') || n.includes('ghee')) return Palette.TintAmber;
  return Palette.TintGreen;
}

export function categoryPicture(cat: SupplyCategory) {
  return cat.image_url ? { uri: cat.image_url } : shippedPicture(cat.name);
}

export function categoryTint(cat: SupplyCategory): string {
  return cat.tint ?? shippedTint(cat.name);
}
