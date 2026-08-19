import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/data/apiClient';
import { SupplyCategory, SupplyItem } from '@/types';

export function useSupplyCategories(pgId?: string) {
  return useQuery<SupplyCategory[]>({
    queryKey: ['supply_categories', pgId],
    queryFn: () => apiFetch(`/v1/supply/categories?pg_id=${pgId}`),
    enabled: !!pgId,
  });
}

export function useSupplyItems(pgId?: string, categoryId?: string, q?: string) {
  return useQuery<SupplyItem[]>({
    queryKey: ['supply_items', pgId, categoryId, q],
    queryFn: () => {
      const params = new URLSearchParams({ pg_id: pgId! });
      if (categoryId) params.append('category_id', categoryId);
      if (q) params.append('q', q);
      return apiFetch(`/v1/supply/items?${params.toString()}`);
    },
    enabled: !!pgId,
  });
}

export function useDeals(pgId?: string) {
  return useQuery<SupplyItem[]>({
    queryKey: ['supply_deals', pgId],
    queryFn: async () => {
      const items = await apiFetch<SupplyItem[]>(`/v1/supply/items?pg_id=${pgId}`);
      return items.filter(item => item.mrp && item.mrp > item.price);
    },
    enabled: !!pgId,
  });
}
