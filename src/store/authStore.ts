import { create } from "zustand";
import * as SecureStore from "@/utils/secureStorage";

// ─── Types (matching /v1/me response) ────────────────────────────────────────

export interface Membership {
  pg_id: string;
  pg_name: string;
  role: "owner" | "manager" | "chef" | "kitchen_staff" | "maintenance" | "guest";
  membership_id: string;
  /** Only a guest membership has one, so this is null for owners and staff. It is how a
   *  resident learns their own room number — the roster is the owner's and they cannot
   *  read it. */
  room_no: string | null;
}

/** A PGow-staff role, not a property role. `area_id` is null for super_admin and support. */
export interface PlatformGrant {
  role: "super_admin" | "area_manager" | "support";
  area_id: string | null;
}

/** ADR-004's gate for the caller's guest membership. Null for owners and staff — the gate
 *  is about residency, not employment — and null for a resident who is fully cleared. */
export type Gate = "KYC_REQUIRED" | "KYC_PENDING" | "KYC_REJECTED" | "RENT_UNPAID" | null;

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  must_change_password: boolean;
  /** Signed and short-lived, or null when no photo is set. Re-read from /v1/me rather than
   *  cached — the URL expires, the photo does not. */
  avatar_url: string | null;
  memberships: Membership[];
  platform_roles: PlatformGrant[];
  gate: Gate;
}

/** A fresh self-registered owner has no membership until property #1 is created. */
export function canCreateProperty(user: User | null): boolean {
  return !!user && (
    user.memberships.length === 0 || user.memberships.some((m) => m.role === "owner")
  );
}

/** Property settings and property metadata are owner-only, including on deep links. */
export function isPropertyOwner(user: User | null, pgId: string | null | undefined): boolean {
  return !!user && !!pgId && user.memberships.some(
    (membership) => membership.pg_id === pgId && membership.role === "owner"
  );
}

// ─── Store shape ─────────────────────────────────────────────────────────────

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  activePgId: string | null;

  // Derived from memberships — the role in the active PG
  activeRole: Membership["role"] | null;

  // This phone's `devices` row, once registered for push. In memory only: it is re-derived
  // on every launch by re-registering the token, so persisting it would just risk holding a
  // stale id after a reinstall.
  deviceId: string | null;

  // Actions
  setTokens: (access: string, refresh: string) => Promise<void>;
  setUser: (user: User) => void;
  setActivePgId: (pgId: string) => Promise<void>;
  setDeviceId: (id: string | null) => void;
  logout: () => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
}

// ─── Secure storage keys ─────────────────────────────────────────────────────

const KEYS = {
  ACCESS: "pgowAccessToken",
  REFRESH: "pgowRefreshToken",
  PG_ID: "pgowActivePgId",
} as const;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  activePgId: null,
  activeRole: null,
  deviceId: null,

  setDeviceId: (id) => set({ deviceId: id }),

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync(KEYS.ACCESS, access);
    await SecureStore.setItemAsync(KEYS.REFRESH, refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  setUser: (user) => {
    const { activePgId } = get();
    const held = user.memberships.find((m) => m.pg_id === activePgId);
    // Falls back to the first membership ONLY when the persisted id matches nothing this
    // user currently holds — a stale id from a previous account/session on this device, or
    // a membership that ended. When it DOES still match, keep it exactly as is: this used
    // to always re-derive from `user.memberships[0]` on the fallback path, which is a
    // silent, unpersisted override — the in-memory store would show a different property
    // than what SecureStore still had recorded, and the mismatch would recur on every
    // future `setUser()` call (every cold start, every post-mutation refetch) rather than
    // ever actually correcting itself.
    const membership = held ?? user.memberships[0];
    if (!held && membership) {
      // Heal the persisted value so this correction sticks instead of silently
      // re-happening from memory on every subsequent load.
      SecureStore.setItemAsync(KEYS.PG_ID, membership.pg_id).catch(() => {});
    }
    set({
      user,
      activeRole: membership?.role ?? null,
      activePgId: membership?.pg_id ?? null,
    });
  },

  setActivePgId: async (pgId) => {
    await SecureStore.setItemAsync(KEYS.PG_ID, pgId);
    const { user } = get();
    const membership = user?.memberships.find((m) => m.pg_id === pgId);
    set({ activePgId: pgId, activeRole: membership?.role ?? null });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(KEYS.ACCESS);
    await SecureStore.deleteItemAsync(KEYS.REFRESH);
    await SecureStore.deleteItemAsync(KEYS.PG_ID);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      activePgId: null,
      activeRole: null,
      deviceId: null,
    });
  },

  hydrateFromStorage: async () => {
    const access = await SecureStore.getItemAsync(KEYS.ACCESS);
    const refresh = await SecureStore.getItemAsync(KEYS.REFRESH);
    const pgId = await SecureStore.getItemAsync(KEYS.PG_ID);
    set({
      accessToken: access ?? null,
      refreshToken: refresh ?? null,
      activePgId: pgId ?? null,
    });
  },
}));
