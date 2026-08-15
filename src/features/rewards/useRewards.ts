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

export function useRewards() {
  return { getMyRewards, getLeaderboard };
}
