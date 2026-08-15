import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

import { BASE_URL, API } from "../../config";
import { fetchWithTimeout } from "../../hooks/useApi";

/** A blank-but-valid style — MapLibre renders an empty map it can still take a camera
 * position on, rather than crashing, when the backend has nothing to serve. */
const EMPTY_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [] };

function absolute(path: string): string {
  return path.startsWith("/") ? `${BASE_URL}${path}` : path;
}

/**
 * Ola's real, live map style — vector tiles (MVT), not a raster image. The backend's
 * `/style.json` already proxies every url in it (no map credential ever reaches this device)
 * and rewrites them to **relative** paths, because it doesn't know its own public base url.
 * Making them absolute is all this function does.
 *
 * No token, and no auth header: the picker's first caller is the PG registration form, where
 * no account exists yet, so the whole `/v1/places` group is IP-limited server-side instead.
 * That also suits MapLibre's native tile/sprite/glyph loading, which happens outside the JS
 * layer with no hook to attach a header to.
 */
export async function fetchMapStyle(): Promise<StyleSpecification> {
  const res = await fetchWithTimeout(`${BASE_URL}${API.PLACES_STYLE}`);
  if (!res.ok) return EMPTY_STYLE;

  const style = await res.json();

  const sources: Record<string, unknown> = {};
  for (const [name, source] of Object.entries(style.sources ?? {})) {
    const src = source as { tiles?: string[]; [k: string]: unknown };
    sources[name] = src.tiles
      ? { ...src, tiles: src.tiles.map((t) => absolute(t)) }
      : src;
  }

  return {
    ...style,
    sources,
    sprite: style.sprite ? absolute(style.sprite) : style.sprite,
    glyphs: style.glyphs ? absolute(style.glyphs) : style.glyphs,
  };
}
