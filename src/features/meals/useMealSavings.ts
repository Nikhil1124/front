/**
 * Meal savings hook — `GET /v1/meals/analytics/savings?pg_id=&start_date=&end_date=`.
 * Money saved on portions residents skipped via the meal broadcast RSVP.
 */
import { useQuery } from "@tanstack/react-query";

import { qk } from "../../data/queryKeys";
import { getMealSavingsAnalytics, type MealSavingsAnalytics } from "./useMeals";

/** `pgId` null disables the query. */
export function useMealSavings(pgId: string | null, startDate: string, endDate: string) {
  return useQuery<MealSavingsAnalytics>({
    queryKey: qk.meals.savings(pgId ?? "", startDate, endDate),
    queryFn: () => getMealSavingsAnalytics(pgId!, startDate, endDate),
    enabled: !!pgId,
    staleTime: 60_000,
  });
}
