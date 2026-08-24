import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import { API } from "../../config";
import { qk } from "../../data/queryKeys";

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
  /** Recomputed fresh server-side on every fetch — the one fact about standings a resident
   *  may see about themselves. The leaderboard itself stays staff-only. */
  is_top_earner: boolean;
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

export interface ClaimChampionRewardResult {
  points_spent: number;
  discount_amount: number;
  balance: number;
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

/**
 * Redeem this cycle's top-earner standing for a rent discount.
 *
 * Not automatic: the resident must explicitly claim it, and the server re-verifies both that
 * they are actually first right now and that they can afford the points — never trusted from
 * whatever the client believes its own standing is. 409s if either isn't true, or if this
 * cycle's reward was already claimed.
 */
export function claimChampionReward(pgId: string): Promise<ClaimChampionRewardResult> {
  return apiFetch<ClaimChampionRewardResult>(`${API.REWARDS_CLAIM_CHAMPION}?pg_id=${pgId}`, {
    method: "POST",
  });
}

export function useMyRewardsQuery(pgId?: string) {
  return useQuery<RewardBalance>({
    queryKey: qk.rewards.mine(pgId ?? ""),
    queryFn: () => getMyRewards(pgId!),
    enabled: !!pgId,
  });
}

export function useClaimChampionRewardMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => claimChampionReward(pgId!),
    onSuccess: () => {
      if (pgId) qc.invalidateQueries({ queryKey: qk.rewards.all(pgId) });
    },
  });
}

export function useRewards() {
  return { getMyRewards, getLeaderboard, claimChampionReward };
}
