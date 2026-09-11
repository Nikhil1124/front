import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { API } from "../../config";
import * as map from "../../data/mappers";
import type { StaffMemberEntity } from "../../types";
import { useAuthStore } from "../../store/authStore";

export interface StaffMember {
  membership_id: string;
  user_id: string;
  pg_id: string;
  name: string;
  phone: string;
  email: string | null;
  role: "manager" | "chef" | "kitchen_staff" | "maintenance" | "delivery_agent" | "owner";
  // A string on the way out ("15000.00"), a number on the way in — see addStaff below.
  // Pydantic serializes Decimal to a JSON string, so arithmetic on this needs parseFloat.
  monthly_salary: string | null;
  shift_start: string | null;
  shift_end: string | null;
  has_pin: boolean;
  started_at: string;
  ended_at: string | null;
}

export type StaffRole = "manager" | "chef" | "kitchen_staff" | "maintenance" | "delivery_agent";

export interface UpdateStaffPayload {
  name?: string;
  email?: string;
  role?: StaffRole;
  monthly_salary?: number;
  shift_start?: string;
  shift_end?: string;
}

export function listStaff(
  pgId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<Page<StaffMember>> {
  const q = new URLSearchParams({ pg_id: pgId });
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.cursor) q.set("cursor", opts.cursor);
  return apiFetch<Page<StaffMember>>(`${API.STAFF}?${q}`);
}

export function getStaff(membershipId: string): Promise<StaffMember> {
  return apiFetch<StaffMember>(API.STAFF_MEMBER(membershipId));
}

export function addStaff(
  pgId: string,
  params: {
    name: string;
    phone: string;
    role: StaffRole;
    pin?: string;
    password?: string;
    // Sent as a JSON number; the server parses it into a Decimal.
    monthly_salary?: number;
    // `CreateStaffRequest` has taken these since the module was written, and the Add Staff
    // form has always collected a shift — it just never sent one, so every staff member was
    // created with no shift and had to be edited afterwards to get the one already chosen.
    // Both or neither: `_shift_is_a_pair` rejects a lone half.
    shift_start?: string;
    shift_end?: string;
  }
): Promise<StaffMember> {
  return apiFetch<StaffMember>(`${API.STAFF}?pg_id=${pgId}`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateStaff(
  membershipId: string,
  params: UpdateStaffPayload
): Promise<StaffMember> {
  return apiFetch<StaffMember>(API.STAFF_MEMBER(membershipId), {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

export function removeStaff(membershipId: string): Promise<StaffMember> {
  return apiFetch<StaffMember>(API.STAFF_MEMBER(membershipId), { method: "DELETE" });
}

/**
 * A new PIN and/or password for a staff member who has lost theirs.
 *
 * Deliberately its own route, not a field on `updateStaff`: the server keeps credentials off
 * `UpdateStaffRequest` because that model is for details anyone on the roster screen may
 * edit. The reset screen used to send `{email: newPin}` through `updateStaff` instead, which
 * could never work — `email` is an `EmailStr` server-side, so a 4-digit PIN was always a 422.
 */
export function resetStaffCredentials(
  membershipId: string,
  params: { pin?: string; password?: string }
): Promise<StaffMember> {
  return apiFetch<StaffMember>(API.STAFF_RESET_CREDENTIALS(membershipId), {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function useStaffQuery(pgId?: string) {
  return useQuery<StaffMemberEntity[]>({
    queryKey: qk.staff.list(pgId ?? ""),
    queryFn: async () => {
      if (!pgId) return [];
      const res = await listStaff(pgId, { limit: 100 });
      return res.items.map(map.toStaff);
    },
    enabled: !!pgId,
  });
}

/**
 * One staff member, by membership id, selected out of the list the directory already has.
 *
 * No per-id endpoint call: `GET /v1/staff?pg_id=` is fetched and cached for this property
 * already, so the detail and edit screens read from it rather than each opening their own
 * request. `isLoading` is the list's, so a cold deep-link into either still shows a spinner
 * instead of "not found". Same shape as `useLaundryOrder`.
 */
export function useStaffMember(membershipId?: string) {
  const activePgId = useAuthStore((s) => s.activePgId);
  const query = useStaffQuery(activePgId ?? undefined);
  return {
    ...query,
    member: membershipId ? (query.data ?? []).find((m) => m.id === membershipId) : undefined,
  };
}

export function useAddStaffMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof addStaff>[1]) => addStaff(pgId!, params),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.staff.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.staff.all(pgId) });
      }
    },
  });
}

export function useUpdateStaffMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, params }: { membershipId: string; params: UpdateStaffPayload }) =>
      updateStaff(membershipId, params),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.staff.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.staff.all(pgId) });
      }
    },
  });
}

export function useRemoveStaffMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => removeStaff(membershipId),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.staff.list(pgId) });
        qc.invalidateQueries({ queryKey: qk.staff.all(pgId) });
      }
    },
  });
}

export function useStaff() {
  return { listStaff, getStaff, addStaff, updateStaff, removeStaff };
}
