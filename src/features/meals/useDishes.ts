import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dishService, CreateDishInput, UpdateDishInput } from '@/services/dishService';

export const DISHES_QUERY_KEY = 'custom-dishes';

export function useCustomDishesQuery(pgId?: string) {
  return useQuery({
    queryKey: [DISHES_QUERY_KEY, pgId],
    queryFn: () => {
      if (!pgId) return Promise.resolve([]);
      return dishService.getPGDishes(pgId);
    },
    enabled: !!pgId,
  });
}

export function useCreateDishMutation(pgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDishInput) => {
      if (!pgId) throw new Error('No PG ID provided');
      return dishService.createCustomDish(pgId, data);
    },
    onSuccess: () => {
      if (pgId) {
        queryClient.invalidateQueries({ queryKey: [DISHES_QUERY_KEY, pgId] });
      }
    },
  });
}

export function useUpdateDishMutation(pgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dishId, data }: { dishId: string; data: UpdateDishInput }) => {
      return dishService.updateCustomDish(dishId, data);
    },
    onSuccess: () => {
      if (pgId) {
        queryClient.invalidateQueries({ queryKey: [DISHES_QUERY_KEY, pgId] });
      }
    },
  });
}

export function useArchiveDishMutation(pgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dishId: string) => dishService.archiveCustomDish(dishId),
    onSuccess: () => {
      if (pgId) {
        queryClient.invalidateQueries({ queryKey: [DISHES_QUERY_KEY, pgId] });
      }
    },
  });
}
