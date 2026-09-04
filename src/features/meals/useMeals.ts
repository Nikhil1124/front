import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { API } from "../../config";
import * as map from "../../data/mappers";
import type { MealNotificationEntity } from "../../types";

export interface MealOut {
  id: string;
  pg_id: string;
  meal_type: "breakfast" | "lunch" | "dinner";
  menu_items: string;
  /** Null for a meal posted before this field existed. */
  dietary_type: "veg" | "non_veg" | "pure_veg" | null;
  chef_note: string;
  service_at: string;
  response_closes_at: string | null;
  is_open: boolean;
  /** False until the meal has been announced — i.e. it is still a draft. */
  is_broadcast?: boolean;
  created_by: string;
}

export interface MealResponse {
  meal_id: string;
  guest_id: string;
  choice: "eating" | "skipping";
}

// GET /v1/meals?pg_id= — gated for guests
export function listMeals(
  pgId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<Page<MealOut>> {
  const q = new URLSearchParams({ pg_id: pgId });
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.cursor) q.set("cursor", opts.cursor);
  return apiFetch<Page<MealOut>>(`${API.MEALS}?${q}`);
}

// GET /v1/meals/{meal_id}
export function getMeal(mealId: string): Promise<MealOut> {
  return apiFetch<MealOut>(API.MEAL(mealId));
}

// POST /v1/meals?pg_id=
export function createMeal(
  pgId: string,
  params: {
    meal_type: "breakfast" | "lunch" | "dinner";
    menu_items: string;
    service_at: string; // ISO 8601 with offset
    /** Chef-confirmed; omit to leave it unset (renders no badge on the resident side). */
    dietary_type?: "veg" | "non_veg" | "pure_veg";
    chef_note?: string;
  }
): Promise<MealOut> {
  return apiFetch<MealOut>(`${API.MEALS}?pg_id=${pgId}`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// PATCH /v1/meals/{meal_id}. The edit screen deliberately follows this with a
// `menu_update` broadcast for already-announced meals, so residents hear about a real
// change without resetting their existing RSVP.
export function updateMeal(
  mealId: string,
  params: {
    menu_items?: string;
    chef_note?: string;
    service_at?: string;
  }
): Promise<MealOut> {
  return apiFetch<MealOut>(API.MEAL(mealId), {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

// POST /v1/meals/{meal_id}/broadcast
export function broadcastMeal(
  mealId: string,
  params: { kind?: "announce" | "menu_update"; response_closes_at?: string } = {}
): Promise<MealOut> {
  return apiFetch<MealOut>(API.MEAL_BROADCAST(mealId), {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// POST /v1/meals/{meal_id}/close
export function closeMeal(mealId: string): Promise<MealOut> {
  return apiFetch<MealOut>(API.MEAL_CLOSE(mealId), { method: "POST" });
}

// PUT /v1/meals/{meal_id}/response — upsert
export function submitResponse(
  mealId: string,
  choice: "eating" | "skipping"
): Promise<MealResponse> {
  return apiFetch<MealResponse>(API.MEAL_RESPONSE(mealId), {
    method: "PUT",
    body: JSON.stringify({ choice }),
  });
}

// GET /v1/meals/{meal_id}/response — null if unanswered
export function getMyResponse(mealId: string): Promise<MealResponse | null> {
  return apiFetch<MealResponse | null>(API.MEAL_RESPONSE(mealId));
}

// The ETag poll for GET /v1/meals/{meal_id}/response-summary lives in
// app/meals/summary.tsx, not here. It needs the raw Response to read the ETag header,
// which apiFetch deliberately doesn't expose — so there is one implementation, in the one
// screen that polls.

export interface MealResponseRow {
  membership_id: string;
  name: string;
  room_no: string | null;
  /** Null means unanswered — not a third choice. Those rows are the point of this endpoint. */
  choice: "eating" | "skipping" | null;
  responded_at: string | null;
  /** Self-reported (PATCH /v1/me/away). Lets a chef reading an unanswered row tell "away,
   *  don't wait on them" apart from "hasn't answered yet". */
  is_away: boolean;
}

/**
 * GET /v1/meals/{id}/responses — the named headcount, staff only.
 *
 * Includes residents who have NOT answered, which is what a chef chasing a count actually
 * needs; `response-summary` gives the two totals and cannot tell you who is missing.
 */
export function listMealResponses(
  mealId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<Page<MealResponseRow>> {
  const q = new URLSearchParams();
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.cursor) q.set("cursor", opts.cursor);
  const qs = q.toString();
  return apiFetch<Page<MealResponseRow>>(
    qs ? `${API.MEAL_RESPONSES(mealId)}?${qs}` : API.MEAL_RESPONSES(mealId)
  );
}

export interface MealSavingsDay {
  date: string;
  meal_type: "breakfast" | "lunch" | "dinner";
  skipped_portions: number;
  saved: number;
}

export interface MealSavingsAnalytics {
  daily: MealSavingsDay[];
  total_skipped_portions: number;
  total_saved: number;
  cost_per_plate: number;
}

// GET /v1/meals/analytics/savings?pg_id=&start_date=&end_date= — money saved on
// portions residents skipped via the meal broadcast RSVP, for a date window.
export function getMealSavingsAnalytics(
  pgId: string,
  startDate: string,
  endDate: string
): Promise<MealSavingsAnalytics> {
  return apiFetch<MealSavingsAnalytics>(API.MEAL_SAVINGS_ANALYTICS(pgId, startDate, endDate));
}

export interface MealRSVPTrendDay {
  date: string;
  meal_type: "breakfast" | "lunch" | "dinner";
  eating_portions: number;
  skipped_portions: number;
}

export interface MealRSVPTrends {
  daily: MealRSVPTrendDay[];
}

// GET /v1/meals/analytics/rsvp-trends?pg_id=&start_date=&end_date= — eating vs. skipping
// per meal, for the kitchen's portion-planning chart. Staff-readable, no cost figure.
export function getMealRSVPTrends(
  pgId: string,
  startDate: string,
  endDate: string
): Promise<MealRSVPTrends> {
  return apiFetch<MealRSVPTrends>(API.MEAL_RSVP_TRENDS(pgId, startDate, endDate));
}

export function useMealsQuery(pgId?: string) {
  return useQuery<MealNotificationEntity[]>({
    queryKey: qk.meals.list(pgId ?? ""),
    queryFn: async () => {
      if (!pgId) return [];
      const res = await listMeals(pgId, { limit: 50 });
      return res.items.map(map.toMeal);
    },
    enabled: !!pgId,
  });
}

export function useMealResponsesQuery(mealId?: string, pgId?: string) {
  return useQuery<MealResponseRow[]>({
    queryKey: qk.meals.responses(pgId ?? "", mealId ?? ""),
    queryFn: async () => {
      if (!mealId) return [];
      const res = await listMealResponses(mealId, { limit: 500 });
      return res.items;
    },
    enabled: !!mealId,
  });
}

export function useMyMealResponseQuery(mealId?: string, pgId?: string) {
  return useQuery<MealResponse | null>({
    queryKey: qk.meals.myResponse(pgId ?? "", mealId ?? ""),
    queryFn: async () => {
      if (!mealId) return null;
      return getMyResponse(mealId);
    },
    enabled: !!mealId,
  });
}

export function useSubmitResponseMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, choice }: { mealId: string; choice: "eating" | "skipping" }) =>
      submitResponse(mealId, choice),
    onSuccess: (_, vars) => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.meals.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.meals.myResponse(pgId, vars.mealId) });
        qc.invalidateQueries({ queryKey: qk.meals.responses(pgId, vars.mealId) });
      }
    },
  });
}

export function useCreateMealMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof createMeal>[1]) => createMeal(pgId!, params),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.meals.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.meals.all(pgId) });
      }
    },
  });
}

export function useUpdateMealMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, params }: { mealId: string; params: Parameters<typeof updateMeal>[1] }) =>
      updateMeal(mealId, params),
    onSuccess: (_, vars) => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.meals.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.meals.detail(pgId, vars.mealId) });
      }
    },
  });
}

export function useBroadcastMealMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, params }: { mealId: string; params?: Parameters<typeof broadcastMeal>[1] }) =>
      broadcastMeal(mealId, params),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.meals.list(pgId) });
      }
    },
  });
}

export function useCloseMealMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mealId: string) => closeMeal(mealId),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.meals.list(pgId) });
      }
    },
  });
}

export function useMeals() {
  return {
    listMeals,
    listMealResponses,
    getMeal,
    createMeal,
    updateMeal,
    broadcastMeal,
    closeMeal,
    submitResponse,
    getMyResponse,
    getMealSavingsAnalytics,
    getMealRSVPTrends,
  };
}
