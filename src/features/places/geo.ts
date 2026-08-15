/**
 * Web Mercator pixel maths, so the picker can turn a drag into coordinates.
 *
 * The map is a flat image, and dragging it moves the centre by some number of pixels. These
 * convert that pixel offset into a latitude/longitude offset. It is the same projection every
 * slippy map uses (Google, OSM, Ola), so the numbers line up with the tile being displayed.
 *
 * Longitude is linear in x, latitude is not: Mercator stretches vertically toward the poles,
 * so the same pixel drag covers less latitude in Hyderabad than in Delhi. Treating y as
 * linear is the classic bug — it looks fine at the centre of the screen and drifts as you pan.
 */

/** Pixels across the whole world at a given zoom. Standard 256px tiles. */
const worldPx = (zoom: number) => 256 * Math.pow(2, zoom);

const latToMercatorY = (lat: number): number => {
  const rad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
};

const mercatorYToLat = (y: number): number =>
  (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));

/**
 * Move a coordinate by a pixel offset at a given zoom.
 *
 * `dx`/`dy` are screen pixels: positive dy is *downward on screen*, which is southward, so it
 * increases the Mercator y. Callers pass the negated drag translation — dragging the map
 * right moves the centre left.
 */
export function offsetLatLng(
  lat: number,
  lng: number,
  dx: number,
  dy: number,
  zoom: number
): { latitude: number; longitude: number } {
  const scale = worldPx(zoom);
  const longitude = lng + (dx * 360) / scale;
  const latitude = mercatorYToLat(latToMercatorY(lat) + dy / scale);
  return {
    // Clamp to the projection's valid range; Mercator is undefined at the poles and the
    // server rejects anything outside ±90/±180 anyway.
    latitude: Math.max(-85, Math.min(85, latitude)),
    longitude: ((((longitude + 180) % 360) + 360) % 360) - 180,
  };
}

/** Round for display and for sending — six decimals is ~11 cm, finer than any building. */
export const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;
