import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import { API } from "../../config";

export interface RewardEntry {
  id: string;
  delta: number;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
}

export interface RewardBalance {
  pg_id: string;
  membership_id: string;
  /** `SUM(delta)`, computed server-side. Never a stored total that could drift. */
  balance: number;
  recent: RewardEntry[];
}

export interface LeaderboardRow {
  membership_id: string;
  name: string;
  room_no: string | null;
  balance: number;
}

export interface Leaderboard {
  pg_id: string;
  rows: LeaderboardRow[];
}

/** The caller's own points, and the movements that produced them. Guests only. */
export function getMyRewards(pgId: string): Promise<RewardBalance> {
  return apiFetch<RewardBalance>(`${API.REWARDS_ME}?pg_id=${pgId}`);
}

/**
 * Standings for a property, highest first — staff only.
 *
 * Also where the month-end champion comes from: whoever tops this list is the winner,
 * computed when asked rather than stored, since a saved winner is wrong the moment anybody
 * earns another point.
 */
export function getLeaderboard(pgId: string, limit = 200): Promise<Leaderboard> {
  return apiFetch<Leaderboard>(`${API.REWARDS}?pg_id=${pgId}&limit=${limit}`);
}

export function useMyRewardsQuery(pgId?: string) {
  return useQuery<RewardBalance>({
    queryKey: ["rewards_me", pgId],
    queryFn: () => getMyRewards(pgId!),
    enabled: !!pgId,
  });
}

export function useRewards() {
  return { getMyRewards, getLeaderboard };
}


/** One name on the podium. No membership id — a resident is shown who is ahead of them, not
 *  handed an identifier for their neighbour. */
export interface StandingsRow {
  name: string;
  room_no: string | null;
  balance: number;
}

/**
 * What a resident may know about everyone else's points.
 *
 * Deliberately not `Leaderboard`, which stays staff-only: a ranked list of every neighbour's
 * score is the sort of thing that makes a shared kitchen unpleasant. But the champion reward
 * is guest-initiated and pays only the top earner, so a resident who cannot see the standings
 * cannot tell the reward exists for them. This is the smallest thing that closes that.
 */
export interface MyStandings {
  pg_id: string;
  balance: number;
  /** 1-based, ties broken by name so it agrees with `top` rather than drifting from it. */
  rank: number;
  total: number;
  top: StandingsRow[];
  /** Whether to offer the button. The server re-verifies on claim regardless. */
  can_claim_champion: boolean;
  champion_cost: number;
  champion_discount: string;
}

export interface ClaimChampionResult {
  points_spent: number;
  discount_amount: string;
  balance: number;
}

export function getMyStandings(pgId: string): Promise<MyStandings> {
  return apiFetch<MyStandings>(`${API.REWARDS_STANDINGS}?pg_id=${pgId}`);
}

export function useMyStandingsQuery(pgId?: string) {
  return useQuery<MyStandings>({
    queryKey: ["rewards_standings", pgId],
    queryFn: () => getMyStandings(pgId!),
    enabled: !!pgId,
  });
}

/**
 * Spend the champion standing on a rent discount.
 *
 * Eligibility is never argued from the client: the server re-checks that the caller is
 * actually first, can afford it, and has not already claimed this cycle, and 409s otherwise.
 * `can_claim_champion` only decides whether a button is worth showing.
 */
export function useClaimChampionMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation<ClaimChampionResult, Error>({
    mutationFn: () =>
      apiFetch<ClaimChampionResult>(`${API.REWARDS_CLAIM_CHAMPION}?pg_id=${pgId}`, {
        method: "POST",
      }),
    onSuccess: () => {
      // Both the balance and the standings moved — the claim spends 100 points, which can
      // lose the caller their own top spot.
      qc.invalidateQueries({ queryKey: ["rewards_me", pgId] });
      qc.invalidateQueries({ queryKey: ["rewards_standings", pgId] });
    },
  });
}
