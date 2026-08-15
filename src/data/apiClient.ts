/**
 * The one place a network request is made.
 *
 * Deliberately a plain module, not a hook: Zustand actions, React Query `queryFn`s and
 * background tasks all need to call this, and none of them can call a hook. The React
 * bindings live on top (`hooks/useApi.ts`, `features/*`), never underneath.
 *
 * It also never navigates. The network layer knowing about the router is what made the
 * previous version untestable and impossible to reuse outside a component — a 401 arriving
 * during a background refresh would try to drive navigation from a task with no UI. Instead
 * it raises typed errors and notifies whoever registered a handler; the app decides what
 * screen that means.
 */

import { API, BASE_URL, GATE_CODES, GateCode } from "../config";
import { useAuthStore } from "../store/authStore";
import { mockFetch } from "./mockBackend";

// ─── Error shape from every endpoint ─────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** The shape every list endpoint returns. Cursor-based, never offset — offset paging skips
 *  and repeats rows when the underlying data shifts between requests. */
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export class PGowApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  httpStatus: number;

  constructor(httpStatus: number, error: ApiError) {
    super(error.message);
    this.name = "PGowApiError";
    this.code = error.code;
    this.details = error.details;
    this.httpStatus = httpStatus;
  }
}

/**
 * A few auth endpoints answer 401 for bad credentials on purpose. They must surface that to
 * their own form rather than triggering session recovery and tearing down the screen the
 * user is typing into.
 */
export type ApiFetchOptions = RequestInit & {
  unauthorized?: "refresh" | "throw";
};

// ─── Timeouts ────────────────────────────────────────────────────────────────

/**
 * No request may hang forever. `fetch` on React Native has no default timeout, so a server
 * that accepts the connection and never answers leaves the promise pending for the life of
 * the app — which renders as a spinner with no way to know why.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * There is no server behind this build — every request is answered by the in-memory mock
 * backend (`mockBackend.ts`) instead of a real `fetch`. This is the one place that decides
 * that, so the rest of the app (and the two call sites that bypass `apiFetch` and call this
 * directly — `mapStyle.ts`, `useDeviceLocation.ts`) never has to know.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await mockFetch(url, options);
  } catch (err: any) {
    // Airplane mode, wrong host, DNS failure and our own abort all arrive as a bare
    // TypeError, which no `instanceof PGowApiError` check catches. Status 0 means the
    // request never reached the server, as opposed to getting a bad answer from it.
    if (err?.name === "AbortError") {
      throw new PGowApiError(0, {
        code: "TIMEOUT",
        message: "The server took too long to respond. Check your connection and try again.",
      });
    }
    throw new PGowApiError(0, {
      code: "NETWORK",
      message: "Could not reach the server. Check your connection and try again.",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** True when the request never got an answer, as opposed to getting a bad one. */
export function isOffline(err: unknown): boolean {
  return err instanceof PGowApiError && (err.code === "NETWORK" || err.code === "TIMEOUT");
}

// ─── Handlers the app registers (instead of this layer navigating) ───────────

type SessionExpiredHandler = () => void;
type GateHandler = (code: GateCode) => void;

let onSessionExpired: SessionExpiredHandler = () => {};
let onGate: GateHandler = () => {};

/** Called when the refresh token is refused — the session is genuinely over. */
export function setSessionExpiredHandler(fn: SessionExpiredHandler): void {
  onSessionExpired = fn;
}

/** Called for ADR-004 gate codes so the app can show the matching screen. */
export function setGateHandler(fn: GateHandler): void {
  onGate = fn;
}

// ─── Token refresh ───────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetchWithTimeout(`${BASE_URL}${API.REFRESH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error("REFRESH_FAILED");
  const data = await res.json();
  await useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

// ─── The request ─────────────────────────────────────────────────────────────

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
  retry = true
): Promise<T> {
  const { unauthorized = "refresh", ...requestOptions } = options;

  // Read from the store rather than closing over a value: a token refreshed by a concurrent
  // request must be picked up by this one, and a captured token would be the stale one.
  const token = useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(requestOptions.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetchWithTimeout(`${BASE_URL}${path}`, { ...requestOptions, headers });

  // 304 from an ETag poll carries no body and is not a failure.
  if (res.status === 304) return null as unknown as T;

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (res.ok) return json as T;

  const apiError: ApiError = json?.error ?? {
    code: "UNKNOWN",
    message: `HTTP ${res.status}`,
  };

  // ── 401 → refresh once, then give up ──────────────────────────────────────
  if (res.status === 401 && retry && unauthorized === "refresh") {
    const rt = useAuthStore.getState().refreshToken;
    if (!rt) {
      await useAuthStore.getState().logout();
      onSessionExpired();
      throw new PGowApiError(401, apiError);
    }
    try {
      // Keyed off the promise itself, not a separate boolean: a second caller arriving
      // after the first cleared the flag would otherwise await nothing, resolve instantly,
      // and retry with the token it already knew was stale.
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken(rt).finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      return apiFetch<T>(path, options, false);
    } catch (err) {
      // Only the server *refusing* the refresh token ends the session. A timeout or a dead
      // connection must not sign anyone out — the token is probably still valid, and
      // logging out here means losing your session for walking into a lift, then being
      // unable to sign back in because you are offline.
      if (isOffline(err)) throw err;
      await useAuthStore.getState().logout();
      onSessionExpired();
      throw new PGowApiError(401, {
        code: "UNAUTHENTICATED",
        message: "Session expired.",
      });
    }
  }

  // ── 403 gate codes → tell the app, still throw ────────────────────────────
  if (res.status === 403 && GATE_CODES.includes(apiError.code as GateCode)) {
    onGate(apiError.code as GateCode);
    throw new PGowApiError(403, apiError);
  }

  throw new PGowApiError(res.status, apiError);
}
