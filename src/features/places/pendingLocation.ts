/**
 * A one-shot handoff for the map picker's result.
 *
 * expo-router pushes screens but gives no return channel, and coordinates do not belong in a
 * URL — floats stringified and reparsed lose precision, and a resolved address in a query
 * string is unreadable. This is a single slot the picker writes and the form reads once.
 *
 * `take()` clears as it reads, deliberately: a stale pick must not reattach itself to the
 * next property the owner creates. The window is small but the failure would be silent and
 * wrong, which is the worst kind.
 */

export interface PickedLocation {
  latitude: number;
  longitude: number;
  formatted_address: string;
}

let slot: PickedLocation | null = null;

export const pendingLocation = {
  set(value: PickedLocation) {
    slot = value;
  },
  /** Read and clear. Returns null when nothing is waiting. */
  take(): PickedLocation | null {
    const value = slot;
    slot = null;
    return value;
  },
};
