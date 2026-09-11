import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/data/apiClient';
import { toAmount } from '@/data/mappers';
import { SupplyCategory, SupplyItem } from '@/types';

const MOCK_MEATS: SupplyItem[] = [
  { id: 'mock_meat_1', category_id: 'cat_meats_mock', name: 'Chicken Curry Cut', unit_label: '250 g', price: 90 },
  { id: 'mock_meat_2', category_id: 'cat_meats_mock', name: 'Chicken Curry Cut', unit_label: '500 g', price: 175 },
  { id: 'mock_meat_3', category_id: 'cat_meats_mock', name: 'Chicken Curry Cut', unit_label: '1 kg', price: 340 },
  { id: 'mock_meat_4', category_id: 'cat_meats_mock', name: 'Skinless Chicken', unit_label: '250 g', price: 100 },
  { id: 'mock_meat_5', category_id: 'cat_meats_mock', name: 'Skinless Chicken', unit_label: '500 g', price: 190 },
  { id: 'mock_meat_6', category_id: 'cat_meats_mock', name: 'Skinless Chicken', unit_label: '1 kg', price: 370 },
  { id: 'mock_meat_7', category_id: 'cat_meats_mock', name: 'Boneless Chicken', unit_label: '250 g', price: 110 },
  { id: 'mock_meat_8', category_id: 'cat_meats_mock', name: 'Boneless Chicken', unit_label: '500 g', price: 210 },
  { id: 'mock_meat_9', category_id: 'cat_meats_mock', name: 'Boneless Chicken', unit_label: '1 kg', price: 410 },
  { id: 'mock_meat_10', category_id: 'cat_meats_mock', name: 'Chicken Breast', unit_label: '250 g', price: 120 },
  { id: 'mock_meat_11', category_id: 'cat_meats_mock', name: 'Chicken Breast', unit_label: '500 g', price: 230 },
  { id: 'mock_meat_12', category_id: 'cat_meats_mock', name: 'Chicken Keema', unit_label: '250 g', price: 130 },
  { id: 'mock_meat_13', category_id: 'cat_meats_mock', name: 'Chicken Keema', unit_label: '500 g', price: 250 },
  { id: 'mock_meat_14', category_id: 'cat_meats_mock', name: 'Chicken Liver', unit_label: '250 g', price: 80 },
  { id: 'mock_meat_15', category_id: 'cat_meats_mock', name: 'Chicken Liver', unit_label: '500 g', price: 150 },
  { id: 'mock_meat_16', category_id: 'cat_meats_mock', name: 'Chicken Lollipop', unit_label: '250 g', price: 140 },
  { id: 'mock_meat_17', category_id: 'cat_meats_mock', name: 'Chicken Lollipop', unit_label: '500 g', price: 270 },
  { id: 'mock_meat_18', category_id: 'cat_meats_mock', name: 'Country Chicken Curry Cut', unit_label: '500 g', price: 350 },
  { id: 'mock_meat_19', category_id: 'cat_meats_mock', name: 'Country Chicken Curry Cut', unit_label: '1 kg', price: 680 },
];

export function useSupplyCategories(pgId?: string) {
  return useQuery<SupplyCategory[]>({
    queryKey: ['supply_categories', pgId],
    queryFn: async () => {
      const cats = await apiFetch<SupplyCategory[]>(`/v1/supply/categories?pg_id=${pgId}`);
      if (!cats.some(c => c.id === 'cat_meats_mock')) {
        cats.push({ id: 'cat_meats_mock', name: 'Chicken, Meat & Fish', sort_order: 99 });
      }
      return cats;
    },
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
      const items = await apiFetch<SupplyItem[]>(`/v1/supply/items?${params.toString()}`);
      
      // Inject mock meats
      let combined = [...items, ...MOCK_MEATS];
      
      // If a specific category was requested, filter the mock items so we don't leak meats into vegetables
      if (categoryId) {
        combined = combined.filter(item => item.category_id === categoryId);
      }
      
      // If a search query was provided, filter the mock items
      if (q) {
        const lowerQ = q.toLowerCase();
        combined = combined.filter(item => item.name.toLowerCase().includes(lowerQ));
      }
      
      return combined;
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
