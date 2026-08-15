import { useCallback, useRef, useState } from "react";

import { API } from "../../config";
import { useApi } from "../../hooks/useApi";

/**
 * Address autocomplete, served by our own backend.
 *
 * **No map credential exists in this app.** The provider's key carries no per-app or
 * per-domain restriction, so shipping it here would hand anyone who unzipped the APK a key
 * they could spend from anywhere — worse than the usual restricted-mobile-key arrangement,
 * because there is nothing scoping it to us. The backend holds it and proxies instead.
 *
 * The client never asks for coordinates either. It sends back only the `place_id` it was
 * given, and the server resolves that to a point — a latitude this app reported would be one
 * the server could not verify.
 */

export interface PlaceSuggestion {
  /** Opaque and provider-scoped. Sent back untouched; never parsed. */
  place_id: string;
  /** "IDBI Training College" — the bold line in the dropdown. */
  primary: string;
  /** "53/2, Indira Nagar, Gachibowli, Hyderabad, Telangana, 500032" */
  secondary: string;
}

export function usePlaces() {
  const { apiFetch } = useApi();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const search = useCallback(
    (input: string) => {
      if (timer.current) clearTimeout(timer.current);
      // The server rejects anything under 3 characters, so there is no point spending a
      // request to be told so.
      if (input.trim().length < 3) {
        setSuggestions([]);
        return;
      }
      // Debounced: without this every keystroke is a round trip, which is both slow and a
      // quick way to burn the provider's quota.
      timer.current = setTimeout(async () => {
        const mine = ++seq.current;
        setSearching(true);
        try {
          const results = await apiFetch<PlaceSuggestion[]>(
            `${API.PLACES_AUTOCOMPLETE}?q=${encodeURIComponent(input.trim())}`
          );
          // A slow reply to an earlier keystroke must not overwrite a newer one.
          if (mine !== seq.current) return;
          setSuggestions(results ?? []);
        } catch {
          if (mine === seq.current) setSuggestions([]);
        } finally {
          if (mine === seq.current) setSearching(false);
        }
      }, 350);
    },
    [apiFetch]
  );

  /** Call once the user picks a suggestion, to clear the dropdown. */
  const endSession = useCallback(() => setSuggestions([]), []);

  return { suggestions, searching, search, endSession };
}
