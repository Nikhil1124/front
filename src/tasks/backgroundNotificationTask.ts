/**
 * BACKGROUND_NOTIFICATION_TASK
 *
 * Handles a tap on the "I'll eat" / "Skip" buttons attached to a meal push, including when
 * the app is fully closed/killed — no React tree exists yet in that case, so this
 * deliberately does not go through Zustand/useApi and instead reads the persisted session
 * straight from SecureStore and posts the RSVP with a raw fetch.
 *
 * Must be imported at module scope from the root layout (see app/_layout.tsx) so Expo's
 * headless JS launch — which re-runs the whole entry bundle without mounting any screen —
 * reaches this `TaskManager.defineTask` call before the OS delivers the action tap.
 *
 * The category is only ever attached to a meal push server-side (`action_type="meal"`, see
 * `push.MEAL_RSVP_CATEGORY` in pg-backend), so a stray tap from any other push category never
 * reaches here at all.
 */
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { BASE_URL, API } from "../config";

export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND-NOTIFICATION-TASK";
export const MEAL_RSVP_CATEGORY = "MEAL_RSVP";

const KEYS = {
  ACCESS: "pgowAccessToken",
  REFRESH: "pgowRefreshToken",
};

async function refreshedAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(KEYS.REFRESH);
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE_URL}${API.REFRESH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await SecureStore.setItemAsync(KEYS.ACCESS, data.access_token);
    await SecureStore.setItemAsync(KEYS.REFRESH, data.refresh_token);
    return data.access_token as string;
  } catch {
    return null;
  }
}

/** Submits the RSVP, refreshing the access token once on a 401 — the same 15-minute expiry
 *  that guards every other request applies here, and a killed app is exactly the case most
 *  likely to have an already-stale one sitting in SecureStore. */
async function submitMealResponse(mealId: string, choice: "eating" | "skipping"): Promise<void> {
  let token = await SecureStore.getItemAsync(KEYS.ACCESS);
  if (!token) throw new Error("Not logged in");

  const post = (accessToken: string) =>
    fetch(`${BASE_URL}${API.MEAL_RESPONSE(mealId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ choice }),
    });

  let res = await post(token);
  if (res.status === 401) {
    const fresh = await refreshedAccessToken();
    if (!fresh) throw new Error("Session expired");
    res = await post(fresh);
  }
  if (!res.ok) throw new Error(`RSVP submit failed: ${res.status}`);
}

async function dismissOriginal(payload: { notification?: Notifications.Notification } | undefined) {
  const identifier = payload?.notification?.request?.identifier;
  if (!identifier) return;
  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // Cosmetic only — the RSVP is already recorded by the time this runs.
  }
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;

  const payload = data as
    | { actionIdentifier?: string; notification?: Notifications.Notification }
    | undefined;
  const actionIdentifier = payload?.actionIdentifier;
  if (actionIdentifier !== "EAT" && actionIdentifier !== "SKIP") {
    // Plain delivery (no button tap) while backgrounded/killed — the OS already displayed
    // the notification itself; nothing to do here.
    return;
  }

  const content = payload?.notification?.request?.content?.data as
    | { category?: string; actionType?: string; actionId?: string }
    | undefined;
  if (content?.actionType !== "meal" || !content.actionId) return;

  const choice = actionIdentifier === "EAT" ? "eating" : "skipping";

  try {
    await submitMealResponse(content.actionId, choice);
    // Android leaves an action-button notification in the tray after the tap — nothing
    // auto-dismisses it, so without this the meal card just sits there unchanged.
    await dismissOriginal(payload);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "RSVP submitted",
        body:
          choice === "eating"
            ? "You're marked as eating this meal."
            : "You're marked as skipping this meal.",
      },
      trigger: null,
    });
  } catch {
    await Notifications.scheduleNotificationAsync({
      content: { title: "RSVP not submitted", body: "Open PGow to try again." },
      trigger: null,
    });
  }
});
