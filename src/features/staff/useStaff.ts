import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { API } from "../../config";

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

export function useStaff() {
  return { listStaff, getStaff, addStaff, updateStaff, removeStaff };
}
