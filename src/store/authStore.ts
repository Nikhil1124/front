import { create } from "zustand";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};

// ─── Types (matching /v1/me response) ────────────────────────────────────────

export interface Membership {
  pg_id: string;
  pg_name: string;
  role: "owner" | "manager" | "chef" | "kitchen_staff" | "maintenance" | "guest" | "delivery_agent";
  membership_id: string;
  /** Only a guest membership has one, so this is null for owners and staff. It is how a
   *  resident learns their own room number — the roster is the owner's and they cannot
   *  read it. */
  room_no: string | null;
  /** A resident's own away/vacation flag (`PATCH /v1/me/away`). Null for owners and staff —
   *  guest-only, same reasoning as `room_no` above. */
  is_away: boolean | null;
}

/** A PGow-staff role, not a property role. `area_id` is null for super_admin and support. */
export interface PlatformGrant {
  role: "super_admin" | "area_manager" | "support" | "delivery_agent" | "laundry_provider";
  area_id: string | null;
}

/**
 * A role the app can be "in" — a membership role, or one of the PGow-side roles that has its
 * own screens in this app.
 *
 * `laundry_provider` is the second kind: PGow's own worker, scoped to an AREA rather than a
 * property, so they hold no membership at all. `activeRole` was derived purely from
 * `memberships`, which left them signed in with a null role and nowhere to land.
 */
export type ActiveRole = Membership["role"] | "laundry_provider";

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

// ─── Store shape ─────────────────────────────────────────────────────────────

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  activePgId: string | null;

  // Derived from memberships — the role in the active PG. Falls back to a platform role for
  // the PGow-side workers who hold no membership; see `platformAppRole`.
  activeRole: ActiveRole | null;

  // This phone's `devices` row, once registered for push. In memory only: it is re-derived
  // on every launch by re-registering the token, so persisting it would just risk holding a
  // stale id after a reinstall.
  deviceId: string | null;

  // Actions
  setTokens: (access: string, refresh: string) => Promise<void>;
  setUser: (user: User, roleHint?: Membership["role"] | null) => void;
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

/**
 * The PGow-side role this app has screens for, or null.
 *
 * Only `laundry_provider`. They are a field worker — they stand in somebody's corridor with a
 * bag of clothes — so a phone is the only place that job can be worked from.
 *
 * `area_manager` and `super_admin` deliberately have none: PGow ops work from the web portal,
 * where assigning a provider belongs next to the areas, staff-roles and dispatch screens that
 * are the rest of that job. The membership-flavoured `delivery_agent` arrives through
 * `memberships` instead — the platform role of the same name is the supply/trips plane.
 */
function platformAppRole(user: User): ActiveRole | null {
  const roles = new Set((user.platform_roles ?? []).map((g) => g.role));
  return roles.has("laundry_provider") ? "laundry_provider" : null;
}

/**
 * True for a PGow role whose work lives on the web portal, not here.
 *
 * `area_manager` and `super_admin` run areas, staff roles, dispatch, catalogue and stock —
 * a desk job with a wide screen. Signing into the app is not wrong, it just has nothing for
 * them, and without this they fall into the owner branch (they hold no membership either)
 * and are shown "Add your first property" — an invitation to create a PG, aimed at the one
 * kind of user who should never do that from here.
 */
export function isOpsPortalUser(user: User | null): boolean {
  if (!user) return false;
  const roles = new Set((user.platform_roles ?? []).map((g) => g.role));
  if (roles.has("laundry_provider")) return false;
  return roles.has("area_manager") || roles.has("super_admin");
}

/**
 * True for a PGow worker who DOES have screens here.
 *
 * They hold ZERO memberships by design, which is the trap: "no memberships" was being read as
 * "a freshly registered owner who has not added a property yet" in both the entry redirect
 * and the route guard, so a laundry provider landed on the owner's "Add your first property"
 * screen. Anywhere membership count stands in for "new owner", this has to be subtracted.
 */
export function isPlatformWorkerRole(role: ActiveRole | null): boolean {
  return role === 'laundry_provider';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  activePgId: null,
  activeRole: null,
  deviceId: null,

  setDeviceId: (id) => set({ deviceId: id }),

  setTokens: async (access, refresh) => {
    await storage.setItem(KEYS.ACCESS, access);
    await storage.setItem(KEYS.REFRESH, refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  setUser: (user, roleHint = null) => {
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
    // A laundry provider has no memberships at all, so the membership lookup below finds
    // nothing and `activeRole` used to come out null — signed in, with no screen to land on.
    const platformRole = platformAppRole(user);
    const membership = held ?? user.memberships[0];
    if (!held && membership) {
      // Heal the persisted value so this correction sticks instead of silently
      // re-happening from memory on every subsequent load.
      storage.setItem(KEYS.PG_ID, membership.pg_id).catch(() => {});
    }
    set({
      user,
      activeRole: membership?.role ?? platformRole ?? roleHint ?? null,
      activePgId: membership?.pg_id ?? null,
    });
  },

  setActivePgId: async (pgId) => {
    await storage.setItem(KEYS.PG_ID, pgId);
    const { user, activePgId } = get();
    const membership = user?.memberships.find((m) => m.pg_id === pgId);
    set({
      activePgId: pgId,
      activeRole: membership?.role ?? (user ? platformAppRole(user) : null) ?? null,
    });
    // Clear the persisted cart whenever the active property changes — cart items are scoped
    // to a specific PG (the warehouse area, pricing, catalog all differ per property). Without
    // this, switching to a new PG (or creating one) left the old cart visible with items that
    // belong to a completely different property.
    if (activePgId !== pgId) {
      AsyncStorage.removeItem('slv-cart').catch(() => {});
    }
  },

  logout: async () => {
    // State first: the (auth) route group's guard is `!accessToken`, so this is what
    // actually signs the user out on screen. The SecureStore deletes below are real cleanup
    // but must never gate that — a slow or failed delete would otherwise leave someone
    // looking at protected content with a token that no longer works.
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      activePgId: null,
      activeRole: null,
      deviceId: null,
    });
    await Promise.all([
      storage.deleteItem(KEYS.ACCESS),
      storage.deleteItem(KEYS.REFRESH),
      storage.deleteItem(KEYS.PG_ID),
    ]).catch(() => {
      // Best-effort — the in-memory session is already cleared, which is what matters for
      // the guard. A leftover SecureStore entry is overwritten on the next successful login.
    });
  },

  hydrateFromStorage: async () => {
    const access = await storage.getItem(KEYS.ACCESS);
    const refresh = await storage.getItem(KEYS.REFRESH);
    const pgId = await storage.getItem(KEYS.PG_ID);
    set({
      accessToken: access ?? null,
      refreshToken: refresh ?? null,
      activePgId: pgId ?? null,
    });
  },
}));

/**
 * Manager mode, derived from the role held at the CURRENTLY active property.
 *
 * `usePGowStore.isManagerMode` is a boolean written once at login/init and never again.
 * `setActivePgId` changes `activeRole` here without touching it, so a person who owns
 * property A and manages property B kept whichever role they signed in with after switching
 * — wrong quick-action tiles, wrong header badge, wrong owner-only controls. Reading the
 * role instead of remembering a snapshot of it removes the class of bug rather than adding
 * another write to keep in sync.
 */
export function useIsManagerMode(): boolean {
  return useAuthStore((s) => s.activeRole === "manager");
}
