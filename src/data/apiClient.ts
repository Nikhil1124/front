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

import { API, BASE_URL } from "../config";
import { gateCodeFrom, type GateCode } from "./gateCodes";
import { useAuthStore } from "../store/authStore";

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

/**
 * A 422 from the API carries `message: "Request validation failed."` and puts the part a
 * human can act on in `details.fields` — so every validation error reached the user as that
 * one sentence, identical whether they had mistyped a phone number or picked a document type
 * the endpoint refuses. Folding the field detail into `.message` means the existing
 * `err.message` call sites (there are dozens) start saying something useful without each one
 * having to learn the envelope's shape.
 */
function readableMessage(error: ApiError): string {
  const fields = (error.details as { fields?: { loc?: string; msg?: string }[] } | undefined)?.fields;
  if (!Array.isArray(fields) || fields.length === 0) return error.message;
  const parts = fields
    .map((f) => {
      const msg = (f?.msg ?? "").trim();
      if (!msg) return null;
      // "body.aadhaar_last4" → "aadhaar_last4"; the "body" prefix means nothing to a user.
      const field = (f?.loc ?? "").split(".").filter((p) => p && p !== "body").pop();
      return field ? `${field}: ${msg}` : msg;
    })
    .filter(Boolean);
  return parts.length ? parts.join("\n") : error.message;
}

export class PGowApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  httpStatus: number;

  constructor(httpStatus: number, error: ApiError) {
    super(readableMessage(error));
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
  /**
   * Turn this GET into a conditional request (ADR-008's polling pattern).
   *
   * Sends `If-None-Match` from the last response seen on this exact path, and answers a 304
   * from memory. Only worth setting on a poll: it costs one cached body per path, and it
   * buys nothing on a request made once.
   */
  conditional?: boolean;
};

/**
 * The last 200 seen per conditional path, so a 304 has something to return.
 *
 * A 304 carries no body by definition, so a caller that polls needs the previous one from
 * somewhere — without this, every 304 would blank the screen it was supposed to leave alone.
 * Keyed by full path (query string included), and only ever written for `conditional` GETs,
 * so it holds a handful of entries at most.
 */
const conditionalCache = new Map<string, { etag: string; body: unknown }>();

/** Drop cached bodies on sign-out — they belong to the account that just left. */
export function clearConditionalCache(): void {
  conditionalCache.clear();
}

// ─── Timeouts ────────────────────────────────────────────────────────────────

/**
 * No request may hang forever. `fetch` on React Native has no default timeout, so a server
 * that accepts the connection and never answers leaves the promise pending for the life of
 * the app — which renders as a spinner with no way to know why.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestOptions = { ...options, signal: controller.signal };
    return await fetch(url, requestOptions);
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
  const { unauthorized = "refresh", conditional = false, ...requestOptions } = options;

  // Read from the store rather than closing over a value: a token refreshed by a concurrent
  // request must be picked up by this one, and a captured token would be the stale one.
  const token = useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(requestOptions.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const cached = conditional ? conditionalCache.get(path) : undefined;
  if (cached) headers["If-None-Match"] = cached.etag;

  const res = await fetchWithTimeout(`${BASE_URL}${path}`, { ...requestOptions, headers });

  // 304 from an ETag poll carries no body and is not a failure — it means "what you already
  // have is current". Returning the previous body keeps that true for the caller.
  if (res.status === 304) {
    if (cached) return cached.body as T;
    // A 304 with nothing cached should not happen (we only send a validator we hold), but a
    // null here would blank a screen, so treat it as a miss and let the caller retry.
    throw new PGowApiError(304, {
      code: "STALE_VALIDATOR",
      message: "Please refresh to load the latest.",
    });
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (res.ok) {
    if (conditional) {
      const etag = res.headers.get("ETag");
      if (etag) conditionalCache.set(path, { etag, body: json });
      else conditionalCache.delete(path);
    }
    return json as T;
  }

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
  // Same rule the UI uses to decide whether to render a gate notice — one implementation, so
  // the network layer and the screens can never disagree about what counts as a gate.
  const gate = gateCodeFrom(res.status, apiError.code);
  if (gate) {
    onGate(gate);
    throw new PGowApiError(403, apiError);
  }

  throw new PGowApiError(res.status, apiError);
}
