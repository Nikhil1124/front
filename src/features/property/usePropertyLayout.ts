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

/** Creates a room (and, if its floor hasn't been used yet, effectively a new floor) with
 *  `sharing_type` beds. The server rejects this — 422 VALIDATION_ERROR — if it would push
 *  the property past the total_beds it's registered for. */
export function createRoom(
  pgId: string,
  params: { floor_number: number; room_number: string; sharing_type: number; base_rent?: number },
): Promise<PropertyLayoutResponse> {
  return apiFetch<any>(API.PG_ROOMS(pgId), {
    method: "POST",
    body: JSON.stringify(params),
  }).then(toPropertyLayout);
}

/**
 * Set how many beds a room holds, in either direction.
 *
 * Raising adds beds and is still capped by the property's `total_beds`. Lowering deletes the
 * surplus beds — highest-numbered first, so what remains is 1..n — and the server refuses it
 * with a 422 if any of those beds is still occupied, rather than quietly ending a tenancy.
 * Setting the value a room already has is a no-op, so this is safe to retry.
 */
export function setRoomSharing(
  pgId: string,
  roomId: string,
  sharingType: number,
): Promise<PropertyLayoutResponse> {
  return apiFetch<any>(API.PG_ROOM_SHARING(pgId, roomId), {
    method: "PATCH",
    body: JSON.stringify({ sharing_type: sharingType }),
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

export function useCreateRoom(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { floor_number: number; room_number: string; sharing_type: number; base_rent?: number }) =>
      createRoom(pgId!, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.properties.layout(pgId ?? "") });
    },
  });
}

export function useSetRoomSharing(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { roomId: string; sharingType: number }) =>
      setRoomSharing(pgId!, params.roomId, params.sharingType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.properties.layout(pgId ?? "") });
    },
  });
}
