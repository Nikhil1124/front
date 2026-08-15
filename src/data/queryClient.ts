/**
 * The app's single QueryClient.
 *
 * Defaults are chosen for a phone on Indian mobile data, not for a desktop on wifi.
 */

import { QueryClient } from "@tanstack/react-query";

import { PGowApiError, isOffline } from "./apiClient";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx is an answer, not a hiccup — retrying a 403 three times just delays the error
      // the user needs to see, and retrying a 404 does it while burning their data. Only
      // genuine "never reached the server" failures are worth another attempt.
      retry: (failureCount, error) => {
        if (isOffline(error)) return failureCount < 2;
        if (error instanceof PGowApiError && error.httpStatus >= 400) return false;
        return failureCount < 1;
      },
      staleTime: 30_000,
      // React Native has no window focus; the equivalent refetch is wired to AppState where
      // a screen actually needs it, rather than globally re-fetching everything on resume.
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Never automatic. A retried POST is a second payment, a second guest, a second
      // ticket — the server's idempotency keys cover the cases where that is safe, and the
      // call sites that have one opt in deliberately.
      retry: false,
    },
  },
});
