/**
 * Properties, and the UPI accounts that hang off them.
 *
 * Every request is a plain top-level function so the Zustand store and React Query `queryFn`s
 * can call it — neither can call a hook. `useProperties()` stays as the component-facing
 * shape; it just hands back the same functions rather than owning a second copy of them.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { API } from "../../config";
import { useAuthStore } from "../../store/authStore";
import * as map from "../../data/mappers";
import type { PGOwnerEntity } from "../../types";

export interface PgResponse {
  id: string;
  name: string;
  // Always a string — the server defaults it to "" rather than null.
  address: string;
  total_beds: number;
  area_id: string | null;
  roles: string[];
  // Derived from the property's `PgUpiId` list — whichever row is active, or null if the
  // owner has not configured one yet. Managing the list itself goes through useUpiIds.
  active_upi_vpa: string | null;
  // Null together, always — the server refuses half a coordinate. Decimal on the wire is a
  // string, same as rent_amount.
  latitude: string | null;
  longitude: string | null;
  // The provider's canonical string; `address` above stays the owner's own line.
  formatted_address: string;
  // Signed URL for the cached static map, or null when the property has not been geocoded.
  map_image_url: string | null;
  // The lobby code. Null for anyone who does not manage this property — the server treats it
  // as a credential, because whoever holds it can create an account here.
  join_code: string | null;
  // What a resident who joins with that code is put on. Null until the owner sets it, and
  // self-join is refused until they do — rent is never the joiner's to choose.
  default_rent_amount: string | null;
  // Whether this property has a live subscription with PGow. Derived server-side from the
  // `subscriptions` table, never a stored flag that could drift once one expires.
  subscription_active: boolean;
}

// Paginated for chains: a single owner never notices, a hundred-branch chain would.
export function listProperties(
  opts: { limit?: number; cursor?: string } = {}
): Promise<Page<PgResponse>> {
  const q = new URLSearchParams();
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.cursor) q.set("cursor", opts.cursor);
  const qs = q.toString();
  return apiFetch<Page<PgResponse>>(qs ? `${API.PGS}?${qs}` : API.PGS);
}

export function getProperty(pgId: string): Promise<PgResponse> {
  return apiFetch<PgResponse>(API.PG(pgId));
}

export function createProperty(params: {
  name: string;
  total_beds: number;
  address?: string;
  // From autocomplete — the server resolves it rather than trusting our coordinates.
  place_id?: string;
  // From the map picker. Accepted because the point the owner chose IS the fact being
  // recorded; there is nothing to verify it against.
  latitude?: number;
  longitude?: number;
}): Promise<PgResponse> {
  return apiFetch<PgResponse>(API.PGS, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateProperty(
  pgId: string,
  params: Partial<{
    name: string;
    address: string;
    total_beds: number;
    place_id: string;
    latitude: number;
    longitude: number;
    // What a resident joining with the lobby code is put on. Self-join stays refused until
    // this is set — rent is the owner's number, not the joiner's.
    default_rent_amount: number;
  }>
): Promise<PgResponse> {
  return apiFetch<PgResponse>(API.PG(pgId), {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

/**
 * Mint a fresh join code, replacing any existing one. Owner-only.
 *
 * Always a new value: a property has exactly one code, so issuing another revokes every
 * printed copy of the old — which is the entire recovery story for one that has leaked.
 */
export function rotateJoinCode(pgId: string): Promise<{ pg_id: string; join_code: string }> {
  return apiFetch<{ pg_id: string; join_code: string }>(API.PG_JOIN_CODE(pgId), {
    method: "POST",
  });
}

/** Turn self-join off. Residents who already joined keep their tenancy. */
export function disableJoinCode(pgId: string): Promise<void> {
  return apiFetch<void>(API.PG_JOIN_CODE(pgId), { method: "DELETE" });
}

export function usePropertiesQuery() {
  return useQuery({
    queryKey: qk.properties.list(),
    queryFn: () => listProperties({ limit: 100 }),
    select: (page) => page.items,
  });
}

/**
 * The properties this person actually holds a membership at — "my portfolio", not "every
 * property on the platform".
 *
 * The membership filter is the point. `GET /v1/pgs` scopes to `principal.pg_ids` for an
 * ordinary owner, so for them this changes nothing. For a SUPER_ADMIN it returns the entire
 * platform, and every consumer of this hook is an owner-role screen — the dashboard header,
 * the PG swapper, Portfolio, Manage Properties, Staff, Residents, Manager Provisioning. So a
 * super-admin who also owns properties saw "14 PGs" on their owner dashboard when they own
 * five, and the swapper offered to switch them into strangers' properties.
 *
 * Worse than the label: five of those screens fall back to `allPGs[0]` when `activePgId` is
 * unset, and with the platform-wide list that first entry is whichever property sorts first
 * by name — someone else's. The owner dashboard would silently adopt it as "your PG".
 *
 * Scoping here rather than at each call site because the fix has to hold for all eight of
 * them, including any added later. A platform-wide list is a legitimate need for admin
 * screens — it just is not this hook.
 */
export function usePropertiesEntitiesQuery() {
  const user = useAuthStore((s) => s.user);
  const myPgIds = useMemo(
    () => new Set((user?.memberships ?? []).map((m) => m.pg_id)),
    [user?.memberships]
  );
  return useQuery<PGOwnerEntity[]>({
    queryKey: [...qk.properties.list(), "entities", user?.id ?? ""],
    queryFn: async () => {
      const res = await listProperties({ limit: 100 });
      return res.items
        .filter((pg) => myPgIds.has(pg.id))
        .map((pg) => map.toPgOwner(pg, user, null));
    },
  });
}

export function usePropertyQuery(pgId?: string) {
  return useQuery({
    queryKey: qk.properties.detail(pgId ?? ""),
    queryFn: () => getProperty(pgId!),
    enabled: !!pgId,
  });
}

export function useActiveProperty() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const user = useAuthStore((s) => s.user);
  const { data: properties = [] } = usePropertiesQuery();
  const activePg = properties.find((p) => p.id === activePgId) ?? properties[0] ?? null;
  const activeEntity = activePg ? map.toPgOwner(activePg, user, null) : null;
  return { activePg, activeEntity, activePgId };
}

export function useCreatePropertyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProperty,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.properties.list() });
      qc.invalidateQueries({ queryKey: qk.properties.all() });
    },
  });
}

export function useUpdatePropertyMutation(pgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof updateProperty>[1]) => updateProperty(pgId, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.properties.list() });
      qc.invalidateQueries({ queryKey: qk.properties.detail(pgId) });
    },
  });
}

export function useProperties() {
  const { activePgId } = useAuthStore();
  return {
    listProperties,
    getProperty,
    createProperty,
    updateProperty,
    rotateJoinCode,
    disableJoinCode,
    activePgId,
  };
}

// ─── UPI accounts: a property owns a list, at most one active ───────────────

export interface UpiIdResponse {
  id: string;
  pg_id: string;
  vpa_address: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

export function listUpiIds(pgId: string): Promise<UpiIdResponse[]> {
  return apiFetch<UpiIdResponse[]>(API.PG_UPI_IDS(pgId));
}

// The first account added for a property becomes active automatically (server-side) — a
// property with an account and no active one would fail every payment anyway.
export function addUpiId(
  pgId: string,
  vpaAddress: string,
  label?: string
): Promise<UpiIdResponse> {
  return apiFetch<UpiIdResponse>(API.PG_UPI_IDS(pgId), {
    method: "POST",
    body: JSON.stringify({ vpa_address: vpaAddress, label }),
  });
}

export function activateUpiId(pgId: string, upiId: string): Promise<UpiIdResponse> {
  return apiFetch<UpiIdResponse>(API.PG_UPI_ID_ACTIVATE(pgId, upiId), { method: "POST" });
}

// 409 from the server if this is the active account and others exist — the caller must
// activate a replacement first. Left for the screen to catch and explain, not swallowed
// here, since "why didn't this work" needs the server's actual reason.
export function removeUpiId(pgId: string, upiId: string): Promise<void> {
  return apiFetch<void>(API.PG_UPI_ID(pgId, upiId), { method: "DELETE" });
}

export function useUpiIdsQuery(pgId?: string) {
  return useQuery({
    queryKey: qk.properties.upiIds(pgId ?? ""),
    queryFn: () => listUpiIds(pgId!),
    enabled: !!pgId,
  });
}

export function useUpiIds() {
  return { listUpiIds, addUpiId, activateUpiId, removeUpiId };
}
