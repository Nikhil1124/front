/**
 * Portfolio aggregates — sums per-property data across every PG an owner holds.
 *
 * There is no bulk endpoint for this, so it fans out one request per property per metric.
 * That is bounded by how many PGs an owner actually runs, not by row count, so it stays
 * cheap — and both hooks below are `enabled` only past 2 properties, since a portfolio of
 * one is the same number the single-PG screens already show.
 *
 * Two tiers, not one: `usePortfolioTeaser` is the cheap one-call-per-property version for
 * the Overview hub's summary card, so a multi-PG owner isn't paying for the full breakdown
 * on every dashboard visit. `usePortfolioDetail` is the full fan-out (occupancy, net,
 * saved, pending dues) and only runs once the owner actually opens the Portfolio screen.
 */
import { useQuery } from "@tanstack/react-query";

import { qk } from "../../data/queryKeys";
import { listGuests } from "../guests/useGuests";
import { listPayments } from "../payments/usePayments";
import { getExpenseSummary } from "../expenses/useExpenses";
import { getMealSavingsAnalytics } from "../meals/useMeals";
import { currentPeriod, toAmount } from "../../data/mappers";
import type { PGOwnerEntity } from "@/types";

export interface PropertyPortfolioStats {
  pgId: string;
  pgName: string;
  totalBeds: number;
  occupiedBeds: number;
  collected: number;
  net: number;
  saved: number;
  pendingDues: number;
}

export interface PortfolioDetail {
  totals: {
    totalBeds: number;
    occupiedBeds: number;
    collected: number;
    saved: number;
    pendingDues: number;
  };
  /** Highest revenue first — the comparison the owner opened this screen to make. */
  byProperty: PropertyPortfolioStats[];
}

/** Order-independent so a re-render's fresh array reference doesn't miss the cache. */
const pgKey = (pgs: PGOwnerEntity[]) => pgs.map((p) => p.id).sort().join(",");

function thisMonthWindow(): { monthStart: string; monthEnd: string } {
  const now = new Date();
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    monthEnd: now.toISOString().slice(0, 10),
  };
}

/**
 * One property's numbers. Each of the four calls is allowed to fail independently — a
 * property the caller can no longer manage, or an endpoint not yet deployed for this role,
 * degrades just that figure to zero rather than blanking every stat for the property, the
 * same tolerance `usePGowStore.refreshAll` applies per list.
 */
async function fetchOne(
  pg: PGOwnerEntity,
  period: string,
  monthStart: string,
  monthEnd: string
): Promise<PropertyPortfolioStats> {
  const [guestsR, paymentsR, summaryR, savingsR] = await Promise.allSettled([
    listGuests(pg.id, { limit: 200 }),
    listPayments(pg.id, { status: "verified", limit: 200 }),
    getExpenseSummary(pg.id, period),
    getMealSavingsAnalytics(pg.id, monthStart, monthEnd),
  ]);

  const guests = guestsR.status === "fulfilled" ? guestsR.value.items : [];
  const payments = paymentsR.status === "fulfilled" ? paymentsR.value.items : [];

  // Same rule the store uses to decide `isBillPaid`: a verified rent payment for the
  // current period, matched by membership. Food/service payments don't settle rent.
  const settled = new Set(
    payments
      .filter((p) => p.purpose === "rent" && p.period === period)
      .map((p) => p.membership_id)
  );

  return {
    pgId: pg.id,
    pgName: pg.pgName,
    totalBeds: pg.totalBeds,
    occupiedBeds: guests.length,
    collected: summaryR.status === "fulfilled" ? toAmount(summaryR.value.collected) : 0,
    net: summaryR.status === "fulfilled" ? toAmount(summaryR.value.net) : 0,
    saved: savingsR.status === "fulfilled" ? savingsR.value.total_saved : 0,
    pendingDues: guests.filter((g) => !settled.has(g.membership_id)).length,
  };
}

/** The Overview hub's teaser card. One call per property (expense summary only) — no
 *  occupancy or meal-savings fan-out, so it's cheap enough to run on every dashboard load
 *  for a multi-PG owner. */
export function usePortfolioTeaser(pgs: PGOwnerEntity[]) {
  return useQuery({
    queryKey: qk.properties.portfolioTeaser(pgKey(pgs)),
    queryFn: async () => {
      const period = currentPeriod();
      const results = await Promise.allSettled(
        pgs.map((pg) => getExpenseSummary(pg.id, period))
      );
      const totalCollected = results.reduce(
        (sum, r) => sum + (r.status === "fulfilled" ? toAmount(r.value.collected) : 0),
        0
      );
      return { totalCollected };
    },
    enabled: pgs.length > 1,
    staleTime: 60_000,
  });
}

/** The full Portfolio screen's data — totals plus the per-property breakdown. */
export function usePortfolioDetail(pgs: PGOwnerEntity[]) {
  return useQuery<PortfolioDetail>({
    queryKey: qk.properties.portfolio(pgKey(pgs)),
    queryFn: async () => {
      const period = currentPeriod();
      const { monthStart, monthEnd } = thisMonthWindow();
      const byProperty = await Promise.all(
        pgs.map((pg) => fetchOne(pg, period, monthStart, monthEnd))
      );
      const totals = byProperty.reduce(
        (acc, p) => ({
          totalBeds: acc.totalBeds + p.totalBeds,
          occupiedBeds: acc.occupiedBeds + p.occupiedBeds,
          collected: acc.collected + p.collected,
          saved: acc.saved + p.saved,
          pendingDues: acc.pendingDues + p.pendingDues,
        }),
        { totalBeds: 0, occupiedBeds: 0, collected: 0, saved: 0, pendingDues: 0 }
      );
      return {
        totals,
        byProperty: [...byProperty].sort((a, b) => b.collected - a.collected),
      };
    },
    enabled: pgs.length > 1,
    staleTime: 60_000,
  });
}
