/**
 * The chef dashboard's "which meal am I looking at" selection, shared between the Eaters and
 * Broadcast tabs — now separate route files, so this can no longer be local component state
 * the way it was in the single-file StaffDashboardScreen this replaced. `activeNotificationId`
 * already existed as store state for this exact purpose (refreshAll's RSVP scoping reads it
 * too); this hook just makes it the one source of truth instead of a local mirror of it.
 */
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useMealsQuery } from '@/features/meals/useMeals';
import type { MealNotificationEntity } from '@/types';

export function useActiveMeal(): {
  activeMeal: MealNotificationEntity | null;
  setActiveMeal: (meal: MealNotificationEntity) => void;
} {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: notifications = [] } = useMealsQuery(activePgId ?? undefined);
  const activeId = usePGowStore((s) => s.activeNotificationId);
  const setActiveNotificationId = usePGowStore((s) => s.setActiveNotificationId);

  const activeMeal = notifications.find((n) => n.id === activeId) ?? notifications[0] ?? null;

  return {
    activeMeal,
    setActiveMeal: (meal) => setActiveNotificationId(meal.id),
  };
}
