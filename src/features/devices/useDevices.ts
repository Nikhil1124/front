import { useEffect, useRef } from "react";

import Notifications from "../../data/notificationsCompat";
import { Platform } from "react-native";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import { useAuthStore } from "../../store/authStore";

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

/**
 * Registers this phone for push and keeps its topic subscription pointed at whichever
 * property is currently active — mount this once, at the app root.
 *
 * `registerDevice` was built (this whole file) but nothing ever called it: no device token
 * was ever posted to the server, so no phone was ever subscribed to anything, on any
 * account. The audience filtering in `push._filter_policy` (guest-only vs everyone) and the
 * account-reassignment handling in `device.service.register_device` are both correct
 * server-side — they simply never ran, because the client leg of ADR-006 was missing.
 *
 * Re-registers whenever `accessToken` or `activePgId` changes, which covers every case that
 * matters: a fresh login, a cold-start session restore, and a property switch. All three are
 * "call it again" per this module's own contract (`registerDevice`'s docstring) — the server
 * upserts by device token, so a repeat call updates one row rather than piling up duplicates.
 * This is also what makes a shared phone safe: when a second account logs in and this effect
 * re-fires, the server sees the same token under a new `user_id` and reassigns it — tearing
 * down the previous account's SNS endpoint and subscription before creating a fresh one under
 * the new account's own role (`device.service`'s `user_id != principal.user_id` branch) — so
 * the outgoing account stops receiving pushes on a device it no longer holds.
 */
export function useRegisterDeviceForPush(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const activePgId = useAuthStore((s) => s.activePgId);
  const setDeviceId = useAuthStore((s) => s.setDeviceId);
  // Registration is best-effort background work — a stale closure racing a fast
  // login/logout must not write a deviceId that belongs to the account that just left.
  const generation = useRef(0);

  useEffect(() => {
    if (!accessToken) return;
    const myGeneration = ++generation.current;
    registerDevice(activePgId).then((device) => {
      if (device && generation.current === myGeneration) setDeviceId(device.id);
    });
  }, [accessToken, activePgId, setDeviceId]);
}
