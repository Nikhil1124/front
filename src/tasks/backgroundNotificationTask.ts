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
import Notifications, { Notification } from "../data/notificationsCompat";
import * as SecureStore from "expo-secure-store";
import { BASE_URL, API } from "../config";
import { useAuthStore } from "../store/authStore";

export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND-NOTIFICATION-TASK";
export const MEAL_RSVP_CATEGORY = "MEAL_RSVP";
/** The confirmation state's category — one action, `CLOSE`. Registered in `channels.ts`. */
export const MEAL_DONE_CATEGORY = "MEAL_DONE";

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
    // Route through the store's own action rather than writing SecureStore directly.
    //
    // Writing only SecureStore here made this the SECOND refresh-token writer in the app,
    // and that is what broke sessions: `hydrateFromStorage` runs once at mount, so when the
    // app is alive the in-memory token stays the pre-rotation one. The next foreground 401
    // then presents an already-rotated token, the server's reuse detection fires
    // `revoke_family`, and the user is signed out with "session ended for security reasons".
    //
    // `setTokens` writes SecureStore *and* memory, so both stay in step. Safe on the
    // killed-app path too: Zustand's store is a plain module object and needs no React tree.
    await useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
    return data.access_token as string;
  } catch {
    return null;
  }
}

/** Submits the RSVP, refreshing the access token once on a 401 — the same 15-minute expiry
 *  that guards every other request applies here, and a killed app is exactly the case most
 *  likely to have an already-stale one sitting in SecureStore. */
export interface MealRsvpResult {
  /** What this answer paid. Zero when the resident is changing an answer already awarded. */
  points_awarded: number;
  points_balance: number;
}

async function submitMealResponse(
  mealId: string,
  choice: "eating" | "skipping"
): Promise<MealRsvpResult> {
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
  // Tolerant of an older server that has not shipped the points fields yet: the confirmation
  // then reads as a plain "response recorded", which is still true.
  const body = (await res.json().catch(() => ({}))) as Partial<MealRsvpResult>;
  return {
    points_awarded: Number(body.points_awarded ?? 0),
    points_balance: Number(body.points_balance ?? 0),
  };
}

async function dismissOriginal(payload: { notification?: Notification } | undefined) {
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
    | { actionIdentifier?: string; notification?: Notification }
    | undefined;
  const actionIdentifier = payload?.actionIdentifier;

  // The confirmation's only button. Dismissing is all it does — no network, no app launch,
  // which is the whole reason it is a notification action and not a deep link.
  if (actionIdentifier === "CLOSE") {
    await dismissOriginal(payload);
    return;
  }

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

  // The meal's name is already the push's title — the server sends `meal.meal_type.title()`,
  // so "Breakfast". Reading it back off the notification beats adding a `mealName` data field
  // the server would have to start sending and old builds would not have.
  const mealName = payload?.notification?.request?.content?.title?.trim() || "this meal";

  try {
    const { points_awarded, points_balance } = await submitMealResponse(
      content.actionId,
      choice
    );
    // Android leaves an action-button notification in the tray after the tap — nothing
    // auto-dismisses it, so without this the meal card just sits there unchanged.
    await dismissOriginal(payload);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "RSVP confirmed ✅",
        // "+15 points" only on the answer that actually paid. A resident changing their mind
        // hits the same ledger row and earns nothing further (`reward_entries_source_key`),
        // so repeating it would promise points the balance never moves by — and both numbers
        // are in the same sentence, where the contradiction is obvious.
        body: [
          `Response recorded: ${choice === "eating" ? "Eating ✅" : "Skipping ❌"} for ${mealName}.`,
          points_awarded > 0 ? `+${points_awarded} points awarded!` : null,
          points_balance > 0 ? `You now have ${points_balance} points.` : null,
        ]
          .filter(Boolean)
          .join(" "),
        categoryIdentifier: MEAL_DONE_CATEGORY,
        data: { categoryId: MEAL_DONE_CATEGORY },
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
