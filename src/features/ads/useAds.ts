import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { API } from "../../config";

export type AdEventType = "impression" | "click" | "coupon_copy";

export interface AdMetrics {
  pg_id: string;
  period: string | null;
  impressions: number;
  clicks: number;
  coupon_copies: number;
  /** USD. Derived server-side from the counts, never a stored total. */
  earnings_usd: string;
}

/**
 * Log one interaction with the sponsored card.
 *
 * Fire-and-forget at the call sites: an ad event is a side effect of rendering something, and
 * a failed metric must never interrupt what the resident was actually doing.
 */
export function recordAdEvent(
  pgId: string,
  eventType: AdEventType,
  adRef = ""
): Promise<void> {
  return apiFetch<void>(API.ADS_EVENTS, {
    method: "POST",
    body: JSON.stringify({ pg_id: pgId, event_type: eventType, ad_ref: adRef }),
  });
}

/** Counts and earnings for a property. Owner and manager only — this is revenue. */
export function getAdMetrics(pgId: string, period?: string): Promise<AdMetrics> {
  const q = new URLSearchParams({ pg_id: pgId });
  if (period) q.set("period", period);
  return apiFetch<AdMetrics>(`${API.ADS_METRICS}?${q}`);
}

export function useAdMetricsQuery(pgId?: string, period?: string) {
  return useQuery<AdMetrics>({
    queryKey: period ? [...qk.ads.metrics(pgId ?? ""), period] : qk.ads.metrics(pgId ?? ""),
    queryFn: () => getAdMetrics(pgId!, period),
    enabled: !!pgId,
  });
}

export function useRecordAdEventMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventType, adRef }: { eventType: AdEventType; adRef?: string }) =>
      recordAdEvent(pgId!, eventType, adRef),
    onSuccess: () => {
      if (pgId) {
        qc.invalidateQueries({ queryKey: qk.ads.metrics(pgId) });
      }
    },
  });
}

export function useAds() {
  return { recordAdEvent, getAdMetrics };
}
