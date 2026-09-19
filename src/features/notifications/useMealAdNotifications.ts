import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MealNotificationData, MealResponsePayload } from '../../types/notification';
import { mockMealNotifications } from '../../mocks/mealNotifications';

// A mock service layer for now. Will be swapped out for real endpoints later.
const fetchMealAdNotifications = async (): Promise<MealNotificationData[]> => {
  return Promise.resolve(mockMealNotifications);
};

const respondToMeal = async (payload: MealResponsePayload): Promise<void> => {
  // In a real app, this would hit /meals/respond
  console.log('Mock respond to meal:', payload);
  return Promise.resolve();
};

const dismissAd = async (adId: string): Promise<void> => {
  // In a real app, this would persist the ad dismissal
  console.log('Mock dismiss ad:', adId);
  return Promise.resolve();
};

export function useMealAdNotificationsQuery() {
  return useQuery({
    queryKey: ['mealAdNotifications'],
    queryFn: fetchMealAdNotifications,
  });
}

export function useMealAdRespondMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: respondToMeal,
    onSuccess: () => {
      // Invalidate if needed, but since we handle optimistic state locally in the card, we might not need to.
      queryClient.invalidateQueries({ queryKey: ['mealAdNotifications'] });
    },
  });
}

export function useAdDismissMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissAd,
    onSuccess: () => {
      // Invalidate if needed
      queryClient.invalidateQueries({ queryKey: ['mealAdNotifications'] });
    },
  });
}
