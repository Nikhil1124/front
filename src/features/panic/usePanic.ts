/**
 * Panic hooks — staff triggers, owner/manager lists/acks/resolves.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { toPanicAlert } from "../../data/mappers";
import type { PanicAlert } from "../../types";

// ─── Plain functions ─────────────────────────────────────────────────────────

export interface TriggerPanicParams {
  message?: string;
  latitude?: number;
  longitude?: number;
}

export function triggerPanic(pgId: string, params: TriggerPanicParams = {}): Promise<PanicAlert> {
  const body: Record<string, unknown> = {};
  if (params.message) body.message = params.message;
  if (params.latitude != null) body.latitude = params.latitude;
  if (params.longitude != null) body.longitude = params.longitude;
  return apiFetch<any>(`${API.PANIC_TRIGGER}?pg_id=${encodeURIComponent(pgId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((dto) => toPanicAlert(dto));
}

export async function listPanicAlerts(pgId: string, status: "open" | "resolved" = "open"): Promise<PanicAlert[]> {
  const dto = await apiFetch<{ items: any[] } | any[]>(API.PANIC_ALERTS(pgId, status));
  const items = Array.isArray(dto) ? dto : (dto?.items ?? []);
  return items.map(toPanicAlert);
}

export function acknowledgePanic(alertId: string, note?: string): Promise<PanicAlert> {
  return apiFetch<any>(API.PANIC_ACKNOWLEDGE(alertId), {
    method: "POST",
    body: JSON.stringify({ note }),
  }).then(toPanicAlert);
}

export function resolvePanic(alertId: string, resolutionNote: string): Promise<PanicAlert> {
  return apiFetch<any>(API.PANIC_RESOLVE(alertId), {
    method: "POST",
    body: JSON.stringify({ resolution_note: resolutionNote }),
  }).then(toPanicAlert);
}

// ─── React bindings ──────────────────────────────────────────────────────────

export function useActivePanicAlerts(pgId: string | null) {
  return useQuery({
    queryKey: qk.panic.activeAlerts(pgId ?? ""),
    queryFn: () => listPanicAlerts(pgId!, "open"),
    enabled: !!pgId,
    // Poll every 15s — panic alerts are time-critical.
    refetchInterval: 15_000,
  });
}

export function useAcknowledgePanic(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { alertId: string; note?: string }) =>
      acknowledgePanic(params.alertId, params.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.panic.activeAlerts(pgId ?? "") });
    },
  });
}

export function useResolvePanic(pgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { alertId: string; resolutionNote: string }) =>
      resolvePanic(params.alertId, params.resolutionNote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.panic.activeAlerts(pgId ?? "") });
    },
  });
}
