import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { API } from "../../config";
import * as map from "../../data/mappers";
import type { StaffMemberEntity } from "../../types";

export interface StaffMember {
  membership_id: string;
  user_id: string;
  pg_id: string;
  name: string;
  phone: string;
  email: string | null;
  role: "manager" | "chef" | "kitchen_staff" | "maintenance" | "owner" | "delivery_agent";
  // A string on the way out ("15000.00"), a number on the way in — see addStaff below.
  // Pydantic serializes Decimal to a JSON string, so arithmetic on this needs parseFloat.
  monthly_salary: string | null;
  shift_start: string | null;
  shift_end: string | null;
  has_pin: boolean;
  started_at: string;
  ended_at: string | null;
}

// `delivery_agent` per migration 0020_add_delivery_agent_role — a real backend-accepted
// staff role, not just a `PlatformGrant` one (see authStore.ts's `activeRole`).
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
