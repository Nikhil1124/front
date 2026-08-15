/**
 * Property layout hook — `GET /v1/pgs/{id}/layout`.
 *
 * The BookMyShow-style seat map reads this. Assign/vacate mutate the same
 * server state and invalidate this query on success.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { toPropertyLayout } from "../../data/mappers";
import type { PropertyLayoutResponse } from "../../types";

// ─── Plain functions ─────────────────────────────────────────────────────────

export async function fetchPropertyLayout(pgId: string): Promise<PropertyLayoutResponse> {
  const dto = await apiFetch<any>(API.PG_LAYOUT(pgId));
  return toPropertyLayout(dto);
}

export function assignBed(
  pgId: string,
  bedId: string,
  params: { tenant_membership_id: string },
): Promise<PropertyLayoutResponse> {
  return apiFetch<any>(API.PG_BED_ASSIGN(pgId, bedId), {
    method: "POST",
    body: JSON.stringify(params),
  }).then(toPropertyLayout);
}

export function vacateBed(pgId: string, bedId: string): Promise<PropertyLayoutResponse> {
  return apiFetch<any>(API.PG_BED_VACATE(pgId, bedId), {
    method: "POST",
  }).then(toPropertyLayout);
}

// ─── React bindings ──────────────────────────────────────────────────────────

export function usePropertyLayout(pgId: string | null) {
  return useQuery({
    queryKey: qk.properties.layout(pgId ?? ""),
    queryFn: () => fetchPropertyLayout(pgId!),
    enabled: !!pgId,
    staleTime: 30_000,
  });
}

export function useAssignBed(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { bedId: string; tenant_membership_id: string }) =>
      assignBed(pgId!, params.bedId, { tenant_membership_id: params.tenant_membership_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.properties.layout(pgId ?? "") });
      // The residents list also changes when a bed is assigned.
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
  });
}

export function useVacateBed(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bedId: string) => vacateBed(pgId!, bedId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.properties.layout(pgId ?? "") });
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
  });
}
