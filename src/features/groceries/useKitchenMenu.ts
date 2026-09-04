import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/data/apiClient';
import { KitchenMenuDay, KitchenMenuMealType, KitchenMenuWeekday } from '@/types';

export function useKitchenMenuQuery(pgId?: string) {
  return useQuery<KitchenMenuDay[]>({
    queryKey: ['kitchen_menu', pgId],
    queryFn: () => apiFetch(`/v1/supply/kitchen-menu?pg_id=${pgId}`),
    enabled: !!pgId,
  });
}

export interface SetKitchenMenuDayInput {
  weekday: KitchenMenuWeekday;
  meal_type: KitchenMenuMealType;
  dishes: string[];
  ingredients: { item_id: string; quantity: number }[];
}

/** A full replace of one weekday's plan — matches the server's PUT, which is not a PATCH. */
export function useSetKitchenMenuDayMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ weekday, ...body }: SetKitchenMenuDayInput) =>
      apiFetch<KitchenMenuDay>(`/v1/supply/kitchen-menu/${weekday}?pg_id=${pgId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (pgId) qc.invalidateQueries({ queryKey: ['kitchen_menu', pgId] });
    },
  });
}
