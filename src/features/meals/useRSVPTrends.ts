/**
 * RSVP trends hook — `GET /v1/meals/analytics/rsvp-trends?pg_id=&start_date=&end_date=`.
 * Eating vs. skipping per meal, for the owner/chef portion-planning chart.
 */
import { useQuery } from "@tanstack/react-query";

import { qk } from "../../data/queryKeys";
import { getMealRSVPTrends, type MealRSVPTrends } from "./useMeals";

/** `pgId` null disables the query. */
export function useRSVPTrends(pgId: string | null, startDate: string, endDate: string) {
  return useQuery<MealRSVPTrends>({
    queryKey: qk.meals.rsvpTrends(pgId ?? "", startDate, endDate),
    queryFn: () => getMealRSVPTrends(pgId!, startDate, endDate),
    enabled: !!pgId,
    staleTime: 60_000,
  });
}
