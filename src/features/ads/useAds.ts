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

/** The one sponsored ad an owner has configured for their property. `null` from the GET
 *  means they haven't set one up — that's the render-nothing signal, not an error. */
export interface AdConfig {
  pg_id: string;
  brand_name: string;
  tagline: string;
  description: string;
  discount_code: string;
  discount_percent: number;
  delivery_time: string;
  cuisines: string;
  image_url: string | null;
  online_url: string | null;
  /** The verb on the button, chosen by the advertiser. Empty means use our own default —
   *  which is what every ad configured before this field existed still says. */
  cta_label: string;
  /** `#RRGGBB`, the brand's own colour. Null means the card stays in the PGow accent. */
  accent_color: string | null;
}

export type UpsertAdConfigInput = Omit<AdConfig, "pg_id"> & { pg_id: string };

export function getAdConfig(pgId: string): Promise<AdConfig | null> {
  return apiFetch<AdConfig | null>(API.ADS_CONFIG(pgId));
}

export function upsertAdConfig(input: UpsertAdConfigInput): Promise<AdConfig> {
  return apiFetch<AdConfig>(API.ADS_CONFIG_BASE, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteAdConfig(pgId: string): Promise<void> {
  return apiFetch<void>(API.ADS_CONFIG(pgId), { method: "DELETE" });
}

/**
 * PGow's own ad for this viewer, today — the one that rides the meal notification card.
 *
 * Not `AdConfig`. That is a property owner's single sponsor, shown as a banner on the meals
 * tab and earning that owner a share. This is PGow's inventory: several run at once, the
 * server rotates them by share of voice, and the same viewer sees the same one all day so an
 * impression corresponds to something a person actually saw.
 *
 * Null means PGow has nothing running, which is the render-nothing signal.
 */
export interface PlatformAd {
  id: string;
  brand_name: string;
  tagline: string;
  description: string;
  discount_code: string;
  discount_percent: number;
  delivery_time: string;
  cuisines: string;
  image_url: string | null;
  online_url: string | null;
  cta_label: string;
  accent_color: string | null;
}

export function getNotificationAd(seq: number): Promise<PlatformAd | null> {
  return apiFetch<PlatformAd | null>(`${API.ADS_NOTIFICATION}?seq=${seq}`);
}

/**
 * The PGow ad at this point in the resident's session.
 *
 * `seq` is the rotation cursor. Hold it steady while a card is on screen and bump it when the
 * resident does something, and the creative changes between actions instead of under
 * somebody mid-read. Each `seq` is its own cache entry, so going back to a previous one
 * returns the same ad rather than a third.
 *
 * `staleTime: Infinity` because the answer for a given viewer and a given `seq` never
 * changes — a refetch could only ever return what is already rendered.
 */
export function useNotificationAdQuery(seq = 0, enabled = true) {
  return useQuery<PlatformAd | null>({
    queryKey: ["notification-ad", seq],
    queryFn: () => getNotificationAd(seq),
    enabled,
    staleTime: Infinity,
  });
}


export function useAdConfigQuery(pgId?: string) {
  return useQuery<AdConfig | null>({
    queryKey: qk.ads.config(pgId ?? ""),
    queryFn: () => getAdConfig(pgId!),
    enabled: !!pgId,
  });
}

export function useUpsertAdConfigMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertAdConfig,
    onSuccess: () => {
      if (pgId) qc.invalidateQueries({ queryKey: qk.ads.config(pgId) });
    },
  });
}

export function useDeleteAdConfigMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAdConfig(pgId!),
    onSuccess: () => {
      if (pgId) qc.invalidateQueries({ queryKey: qk.ads.config(pgId) });
    },
  });
}
