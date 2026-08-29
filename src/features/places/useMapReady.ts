import { useEffect, useRef, useState } from 'react';

/**
 * Tracks when a MapLibre map is genuinely ready to look at.
 *
 * The screens used to gate on `mapStyle !== null` — the style JSON arriving. That is only
 * the first of several round trips: MapLibre then fetches the sprite, the glyphs, and every
 * tile in view, each proxied through our backend. Style JSON lands in ~350 ms, so the
 * spinner cleared almost immediately and left the user staring at an unpainted map for as
 * long as the tiles took. That gap is what read as "the map is blank".
 *
 * `onDidFinishRenderingMapFully` is the event that actually means "there are tiles on the
 * screen", so that is what clears the spinner now.
 *
 * The timeout is not belt-and-braces, it is required: `maplibreCompat`'s Expo Go fallback
 * renders a plain `View` and drops every prop it is given, so the callback can never fire
 * there. Without a deadline the spinner would cover that fallback's own "use a development
 * build" message forever. It equally covers any device where the native event is missed.
 */
const READY_TIMEOUT_MS = 8000;

export function useMapReady(styleLoaded: boolean) {
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!styleLoaded || rendered || failed) return;
    timer.current = setTimeout(() => setRendered(true), READY_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [styleLoaded, rendered, failed]);

  return {
    /** Show the map's own chrome; hide the loading overlay. */
    ready: rendered,
    failed,
    /** Wire to `onDidFinishRenderingMapFully`. */
    onRendered: () => setRendered(true),
    /** Wire to `onDidFailLoadingMap`. */
    onFailed: () => setFailed(true),
  };
}
