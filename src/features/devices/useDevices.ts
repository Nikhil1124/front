import Notifications from "../../data/notificationsCompat";
import { Platform } from "react-native";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";

export interface DeviceResponse {
  id: string;
  platform: "ios" | "android";
  app_version: string | null;
  /** Whether the device actually reached its property's SNS topic. False while the server
   *  has no SNS credentials configured — the token is stored either way, and the server
   *  subscribes it on the next registration once the ARNs exist. */
  subscribed: boolean;
  last_seen_at: string;
  created_at: string;
}

/**
 * Acquire this phone's push token, if we can.
 *
 * `getDevicePushTokenAsync` — the NATIVE FCM/APNs token — never `getExpoPushTokenAsync`.
 * ADR-006 delivers through our own SNS platform applications, and an `ExponentPushToken[…]`
 * is only usable by Expo's service. The price of that choice is that this cannot work in
 * Expo Go or on a simulator: both throw here. Hence best-effort — it returns null rather
 * than surfacing an error, because an app with no push still works. A dev build is the
 * prerequisite for a real token.
 */
async function acquireToken(): Promise<string | null> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;
    return (await Notifications.getDevicePushTokenAsync()).data;
  } catch {
    return null;
  }
}

/**
 * Register this phone and subscribe it to `pgId`'s topic.
 *
 * Safe to call on every launch and on every property switch: the server upserts on
 * `device_token` (`devices_token_key`), so repeat calls update the one row instead of
 * piling up duplicates. Returns null when there is no token to register.
 */
export async function registerDevice(pgId: string | null): Promise<DeviceResponse | null> {
  const deviceToken = await acquireToken();
  if (!deviceToken) return null;
  return apiFetch<DeviceResponse>(API.DEVICES, {
    method: "POST",
    body: JSON.stringify({
      device_token: deviceToken,
      platform: Platform.OS === "ios" ? "ios" : "android",
      pg_id: pgId,
    }),
  });
}

/** Unsubscribe and forget this device server-side. */
export function unregisterDevice(deviceId: string): Promise<void> {
  return apiFetch<void>(API.DEVICE(deviceId), { method: "DELETE" });
}

export function useDevices() {
  return { registerDevice, unregisterDevice };
}
