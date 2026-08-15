/**
 * React binding over `data/apiClient`.
 *
 * The client owns every request, the refresh dance and the error types; this exists only so
 * the feature hooks can keep their `const { apiFetch } = useApi()` shape. Nothing that is
 * not a component or a hook should import this — call `apiFetch` from `data/apiClient`
 * directly instead.
 *
 * Re-exports the client's types so existing `import { PGowApiError, isOffline } from
 * "../hooks/useApi"` call sites keep resolving to the same classes. Two copies of an error
 * class is one `instanceof` check that silently returns false.
 */

import { useCallback } from "react";

import { apiFetch as clientFetch, type ApiFetchOptions } from "../data/apiClient";

export {
  PGowApiError,
  isOffline,
  fetchWithTimeout,
  REQUEST_TIMEOUT_MS,
  setSessionExpiredHandler,
  setGateHandler,
} from "../data/apiClient";
export type { ApiError, Page, ApiFetchOptions } from "../data/apiClient";

export function useApi() {
  const apiFetch = useCallback(
    <T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> =>
      clientFetch<T>(path, options),
    []
  );
  return { apiFetch };
}
