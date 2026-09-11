/**
 * The laundry provider's side of a booking.
 *
 * A provider is PGow's own worker scoped to an AREA, not a property — so their jobs do not
 * come from `GET /v1/requests?pg_id=`, which is tenant-scoped through memberships they do not
 * hold. They come from the ops queue, `GET /v1/requests/escalated`, filtered to laundry and
 * already narrowed server-side to the areas the caller covers.
 *
 * The three buttons are one endpoint with a `stage`. Order is enforced on the server — a
 * double tap on "Delivered" cannot close a job whose clothes were never collected — so the UI
 * only has to show the next step, not police the sequence.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/data/apiClient';
import type { RequestRecord } from '@/features/requests/useComplaints';

/** In order. The server holds the same tuple; this one drives the button. */
export const LAUNDRY_STAGES = ['picked_up', 'completed', 'delivered'] as const;
export type LaundryStage = (typeof LAUNDRY_STAGES)[number];

/** What the provider's button says at each point, and what it does next. */
export const NEXT_STAGE_LABEL: Record<'none' | LaundryStage, string | null> = {
  none: 'Mark picked up',
  picked_up: 'Mark laundry done',
  completed: 'Mark delivered',
  delivered: null,
};

export const STAGE_LABEL: Record<LaundryStage, string> = {
  picked_up: 'Picked up',
  completed: 'Laundry done',
  delivered: 'Delivered',
};

export function stageOf(record: RequestRecord): LaundryStage | 'none' {
  const stage = (record.details as { laundry_stage?: string } | null)?.laundry_stage;
  return LAUNDRY_STAGES.includes(stage as LaundryStage) ? (stage as LaundryStage) : 'none';
}

export function nextStageAfter(current: LaundryStage | 'none'): LaundryStage | null {
  if (current === 'none') return 'picked_up';
  const i = LAUNDRY_STAGES.indexOf(current);
  return i >= 0 && i < LAUNDRY_STAGES.length - 1 ? LAUNDRY_STAGES[i + 1] : null;
}

export const laundryJobsKey = ['laundry_jobs'] as const;

interface EscalatedPage {
  items: RequestRecord[];
  next_cursor?: string | null;
}

/**
 * Every laundry booking in this provider's areas.
 *
 * Unfiltered by assignee on purpose: the server returns what the caller's area covers, and a
 * provider needs to see a job the moment it is assigned to them. The screens split the list
 * into "mine, still open" and "done" rather than asking the server twice.
 */
export function useLaundryJobsQuery(enabled = true) {
  return useQuery<RequestRecord[]>({
    queryKey: laundryJobsKey,
    queryFn: async () => {
      const page = await apiFetch<EscalatedPage>('/v1/requests/escalated?kind=laundry&limit=100');
      return page.items ?? [];
    },
    enabled,
  });
}

export function useAdvanceLaundryStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, stage }: { requestId: string; stage: LaundryStage }) =>
      apiFetch<RequestRecord>(`/v1/requests/${requestId}/laundry-stage`, {
        method: 'POST',
        body: JSON.stringify({ stage }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: laundryJobsKey });
    },
  });
}

export interface PlatformRoleGrant {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  role: string;
  area_id: string | null;
  area_name: string | null;
}

/**
 * The laundry providers this area manager can assign to.
 *
 * `GET /v1/admin/roles` is already scoped server-side to the caller's own areas, so no area
 * filter is needed here — an area manager cannot see, and cannot assign, another area's.
 */
export function useLaundryProvidersQuery(enabled = true) {
  return useQuery<PlatformRoleGrant[]>({
    queryKey: ['laundry_providers'],
    queryFn: async () => {
      const all = await apiFetch<PlatformRoleGrant[]>('/v1/admin/roles?active_only=true');
      return (all ?? []).filter((g) => g.role === 'laundry_provider');
    },
    enabled,
  });
}

/** Area manager: hand a booking to one of their providers. */
export function useAssignLaundryProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, providerAssignmentId }: {
      requestId: string;
      providerAssignmentId: string;
    }) =>
      apiFetch<RequestRecord>(`/v1/requests/${requestId}/assign-laundry-provider`, {
        method: 'POST',
        body: JSON.stringify({ provider_assignment_id: providerAssignmentId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: laundryJobsKey });
    },
  });
}
