/**
 * Attendance hooks — shifts + punch-in/out + weekly schedule.
 *
 * Staff punches via `usePunchIn` / `usePunchOut`. Manager & staff both read
 * `useWeeklySchedule` (manager passes any staffMembershipId; staff passes
 * their own). `usePunches` is the recent-punches list.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { toAttendancePunch, toStaffShift } from "../../data/mappers";
import type { AttendancePunch, StaffShift } from "../../types";

// ─── Plain functions ─────────────────────────────────────────────────────────

export async function listMyShifts(
  pgId: string,
  opts?: { staffMembershipId?: string; shiftDate?: string },
): Promise<StaffShift[]> {
  const params = new URLSearchParams({ pg_id: pgId });
  if (opts?.staffMembershipId) params.append("staff_membership_id", opts.staffMembershipId);
  if (opts?.shiftDate) params.append("shift_date", opts.shiftDate);
  const dto = await apiFetch<{ items: any[] } | any[]>(`${API.ATTENDANCE_SHIFTS}?${params.toString()}`);
  const items = Array.isArray(dto) ? dto : (dto?.items ?? []);
  return items.map(toStaffShift);
}

export interface PunchInParams {
  pg_id: string;
  shift_id: string;
  method?: "qr" | "geofence" | "manual";
  qr_code_hash?: string;
  latitude?: number;
  longitude?: number;
}

export function punchIn(params: PunchInParams): Promise<AttendancePunch> {
  return apiFetch<any>(`${API.ATTENDANCE_PUNCH_IN}?pg_id=${encodeURIComponent(params.pg_id)}`, {
    method: "POST",
    body: JSON.stringify({
      shift_id: params.shift_id,
      method: params.method ?? "manual",
      qr_code_hash: params.qr_code_hash,
      latitude: params.latitude,
      longitude: params.longitude,
    }),
  }).then(toAttendancePunch);
}

export function punchOut(
  punchId: string,
  pgId: string,
  params: { method?: "qr" | "geofence" | "manual"; latitude?: number; longitude?: number } = {},
): Promise<AttendancePunch> {
  return apiFetch<any>(`${API.ATTENDANCE_PUNCH_OUT(punchId)}?pg_id=${encodeURIComponent(pgId)}`, {
    method: "POST",
    body: JSON.stringify({
      method: params.method ?? "manual",
      latitude: params.latitude,
      longitude: params.longitude,
    }),
  }).then(toAttendancePunch);
}

export async function listPunches(
  pgId: string,
  opts: { staffMembershipId?: string; startDate?: string; endDate?: string } = {},
): Promise<AttendancePunch[]> {
  const params = new URLSearchParams({ pg_id: pgId });
  if (opts.staffMembershipId) params.append("staff_membership_id", opts.staffMembershipId);
  if (opts.startDate) params.append("start_date", opts.startDate);
  if (opts.endDate) params.append("end_date", opts.endDate);
  const dto = await apiFetch<{ items: any[] } | any[]>(`${API.ATTENDANCE_PUNCHES}?${params.toString()}`);
  const items = Array.isArray(dto) ? dto : (dto?.items ?? []);
  return items.map(toAttendancePunch);
}

export interface WeeklyScheduleDay {
  date: string;
  shift: StaffShift | null;
  punch: AttendancePunch | null;
}

export interface WeeklySchedule {
  weekStartDate: string;
  days: WeeklyScheduleDay[];
}

export async function fetchWeeklySchedule(
  pgId: string,
  staffMembershipId: string,
  weekStartDate: string,
): Promise<WeeklySchedule> {
  const dto = await apiFetch<any>(
    API.ATTENDANCE_WEEKLY_SCHEDULE(pgId, staffMembershipId, weekStartDate),
  );
  const days: WeeklyScheduleDay[] = Array.isArray(dto?.days)
    ? dto.days.map((d: any) => ({
        date: String(d?.date ?? ""),
        shift: d?.shift ? toStaffShift(d.shift) : null,
        punch: d?.punch ? toAttendancePunch(d.punch) : null,
      }))
    : [];
  return {
    weekStartDate: String(dto?.week_start_date ?? weekStartDate),
    days,
  };
}

// ─── React bindings ──────────────────────────────────────────────────────────

/** Today's shift for the signed-in staff member (or any staffMembershipId). */
export function useMyTodayShift(pgId: string | null, staffMembershipId?: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: qk.attendance.shifts(pgId ?? "", staffMembershipId ?? null),
    queryFn: () => listMyShifts(pgId!, { staffMembershipId: staffMembershipId ?? undefined, shiftDate: today }),
    enabled: !!pgId,
  });
}

export function usePunches(
  pgId: string | null,
  staffMembershipId?: string | null,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: qk.attendance.punches(pgId ?? "", staffMembershipId ?? null, startDate ?? null, endDate ?? null),
    queryFn: () =>
      listPunches(pgId!, {
        staffMembershipId: staffMembershipId ?? undefined,
        startDate,
        endDate,
      }),
    enabled: !!pgId,
  });
}

export function useWeeklySchedule(
  pgId: string | null,
  staffMembershipId: string | null,
  weekStartDate: string | null,
) {
  return useQuery({
    queryKey: ["attendance", "weekly", pgId ?? "", staffMembershipId ?? "", weekStartDate ?? ""],
    queryFn: () => fetchWeeklySchedule(pgId!, staffMembershipId!, weekStartDate!),
    enabled: !!pgId && !!staffMembershipId && !!weekStartDate,
  });
}

export function usePunchIn(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Omit<PunchInParams, "pg_id">) => punchIn({ ...params, pg_id: pgId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function usePunchOut(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { punchId: string; method?: "qr" | "geofence" | "manual"; latitude?: number; longitude?: number }) =>
      punchOut(params.punchId, pgId!, {
        method: params.method,
        latitude: params.latitude,
        longitude: params.longitude,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}
