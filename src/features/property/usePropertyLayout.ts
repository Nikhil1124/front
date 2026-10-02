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

/** The owner's first description of the building — every floor, room and bed at once, only
 *  while the property has no rooms. It also makes the property's bed count what was described. */
export function setupLayout(
  pgId: string,
  floors: { floor_number: number; rooms: { room_number: string; sharing_type: number }[] }[],
): Promise<PropertyLayoutResponse> {
  return apiFetch<any>(API.PG_LAYOUT_SETUP(pgId), {
    method: "POST",
    body: JSON.stringify({ floors }),
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

/**
 * Correct a room's number, its floor, or its rent.
 *
 * Allowed while residents are in the room, unlike resizing or deleting: nobody moves, the
 * label changes, and the server carries each occupant's own `room_no` across with it. This is
 * the one route by which a property whose rooms were never described — invented instead from
 * each resident's typed room number — can be made to match the actual building.
 *
 * Only the fields passed are touched. A 409 means another room already has that number.
 */
export function updateRoom(
  pgId: string,
  roomId: string,
  changes: { room_number?: string; floor_number?: number; base_rent?: number | null },
): Promise<PropertyLayoutResponse> {
  return apiFetch<any>(API.PG_ROOM(pgId, roomId), {
    method: "PATCH",
    body: JSON.stringify(changes),
  }).then(toPropertyLayout);
}

/**
 * Remove a room and its beds.
 *
 * Refused with a 422 while anybody lives in it — the server will not let a room disappearing
 * be how a tenancy ends, and names who is still there. Vacate them first. Past stays in the
 * room go with it; there is no archive.
 */
export function deleteRoom(pgId: string, roomId: string): Promise<PropertyLayoutResponse> {
  return apiFetch<any>(API.PG_ROOM(pgId, roomId), { method: "DELETE" }).then(toPropertyLayout);
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

export function useSetupLayout(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (floors: Parameters<typeof setupLayout>[1]) => setupLayout(pgId!, floors),
    // Every "properties" key: the layout, the staff room list, and the property itself,
    // whose bed count this sets.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.properties.all() }),
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

export function useUpdateRoom(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      roomId: string;
      changes: { room_number?: string; floor_number?: number; base_rent?: number | null };
    }) => updateRoom(pgId!, params.roomId, params.changes),
    // Not just the layout: renumbering rewrites the occupants' own `room_no`, which is what
    // the residents list and every room picker read.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.properties.all() });
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
  });
}

export function useDeleteRoom(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => deleteRoom(pgId!, roomId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.properties.all() });
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
  });
}
