import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/data/apiClient';
import { toAmount } from '@/data/mappers';
import { SupplyCategory, SupplyItem } from '@/types';

export function useSupplyCategories(pgId?: string) {
  return useQuery<SupplyCategory[]>({
    queryKey: ['supply_categories', pgId],
    queryFn: () => apiFetch<SupplyCategory[]>(`/v1/supply/categories?pg_id=${pgId}`),
    enabled: !!pgId,
  });
}

export function useSupplyItems(pgId?: string, categoryId?: string, q?: string) {
  return useQuery<SupplyItem[]>({
    queryKey: ['supply_items', pgId, categoryId, q],
    queryFn: async () => {
      const params = new URLSearchParams({ pg_id: pgId! });
      if (categoryId) params.append('category_id', categoryId);
      if (q) params.append('q', q);
      // The server already applies `category_id` and `q` — they are query params above — so
      // there is nothing left to filter client-side. The filtering that used to live here
      // existed only to keep injected mock items out of the wrong category.
      return apiFetch<SupplyItem[]>(`/v1/supply/items?${params.toString()}`);
    },
    enabled: !!pgId,
  });
}

export function useDeals(pgId?: string) {
  return useQuery<SupplyItem[]>({
    queryKey: ['supply_deals', pgId],
    queryFn: async () => {
      const items = await apiFetch<SupplyItem[]>(`/v1/supply/items?pg_id=${pgId}`);
      // `toAmount`, not a bare `>`: the server sends Decimal as a JSON string, so comparing
      // them directly is LEXICOGRAPHIC — "90.00" > "100.00" is true because "9" > "1". That
      // advertised markups as deals and hid genuine discounts. (`SupplyItem` types these as
      // `number`, which is the wire format lying; the values are strings at runtime.)
      return items.filter(item => item.mrp != null && toAmount(item.mrp) > toAmount(item.price));
    },
    enabled: !!pgId,
  });
}
