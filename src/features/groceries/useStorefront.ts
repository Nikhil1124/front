/**
 * The grocery home screen, from the backend (`GET /v1/supply/storefront`).
 *
 * Ops build it in the portal: the banners (animated GIFs included) and their dates, the promo
 * cards, the category grid, every product row and its heading, and their order. The server
 * also picks which products each row shows — deals, what the area orders most, what this
 * person buys again — so the app only draws. The header takes the leading banner's colour.
 */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/data/apiClient';

export type StorefrontLink =
  | { type: 'none' }
  | { type: 'deals' }
  | { type: 'all_products' }
  | { type: 'category'; target_id: string }
  | { type: 'item'; target_id: string }
  | { type: 'url'; url: string };

/** Pictures the app ships with, used by the built-in starting layout until ops upload their own. */
export type BuiltinImage = 'fresh_produce' | 'pantry_restock' | 'festive_sweets';

export interface StorefrontCard {
  title: string;
  subtitle: string;
  image_url: string | null;
  builtin_image: BuiltinImage | null;
  tint: string;
  link: StorefrontLink;
}

interface SectionBase {
  id: string;
  title: string;
  subtitle: string;
  theme_color: string | null;
}

export type StorefrontSection =
  | (SectionBase & {
      kind: 'hero' | 'banner';
      data: { image_url: string | null; builtin_image: BuiltinImage | null; link: StorefrontLink };
    })
  | (SectionBase & { kind: 'promo_cards'; data: { cards: StorefrontCard[] } })
  | (SectionBase & { kind: 'categories'; data: { columns: 3 | 4 | 5; category_ids: string[] } })
  | (SectionBase & {
      kind: 'products';
      data: { item_ids: string[]; layout: 'row' | 'grid'; columns: 2 | 3; see_all: StorefrontLink };
    });

export interface Storefront {
  /** `primary_color`: the header colour, or null for the app's own. */
  theme: { primary_color: string | null };
  sections: StorefrontSection[];
}

export function useStorefront(pgId?: string) {
  return useQuery<Storefront>({
    queryKey: ['storefront', pgId],
    queryFn: () => apiFetch<Storefront>(`/v1/supply/storefront?pg_id=${pgId}`),
    enabled: !!pgId,
    staleTime: 60_000,
  });
}

const BUILTIN_IMAGES: Record<BuiltinImage, number> = {
  fresh_produce: require('../../../assets/productimages/promo_fresh_picks_nobg.webp'),
  pantry_restock: require('../../../assets/productimages/cat_masala_nobg.webp'),
  festive_sweets: require('../../../assets/productimages/d1_nobg.webp'),
};

/** An `Image` source: the uploaded picture, else the shipped one, else nothing. */
export function storefrontImage(url: string | null, builtin: BuiltinImage | null) {
  if (url) return { uri: url };
  return builtin ? BUILTIN_IMAGES[builtin] : null;
}
