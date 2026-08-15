/**
 * PnL hook — `GET /v1/billing/pnl?pg_id=…&interval=…`.
 *
 * React Query-driven: the interval selector changes the cache key so toggling
 * 3m / 6m / 1y re-fetches fresh rather than serving a stale answer.
 */
import { useQuery } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { toPnLData } from "../../data/mappers";
import type { PnLData, PnLInterval } from "../../types";

/** Raw fetch used by both the hook and any non-React caller. */
export async function fetchPnL(pgId: string, interval: PnLInterval): Promise<PnLData> {
  const dto = await apiFetch<any>(API.BILLING_PNL(pgId, interval));
  return toPnLData(dto);
}

/** React binding. `pgId` null disables the query. */
export function usePnL(pgId: string | null, interval: PnLInterval) {
  return useQuery({
    queryKey: qk.billing.pnl(pgId ?? "", interval),
    queryFn: () => fetchPnL(pgId!, interval),
    enabled: !!pgId,
    staleTime: 60_000,
  });
}
