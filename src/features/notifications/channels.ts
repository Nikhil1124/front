import Notifications from "../../data/notificationsCompat";
import { Platform } from "react-native";
import { router } from "expo-router";
import { Colors } from "../../theme";
import { MEAL_DONE_CATEGORY, MEAL_RSVP_CATEGORY } from "../../tasks/backgroundNotificationTask";

/**
 * Without this, expo-notifications' default handler shows nothing while the app is in the
 * foreground — a push still arrives (the listener below fires), but no banner, no sound, no
 * tray entry. Set at module scope, not inside a hook, so it's active from the very first
 * notification the process ever sees, including one delivered before any screen has mounted.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Android notification channels, and what happens when a push is tapped.
 *
 * Channels must exist on the device before a push naming one arrives, otherwise Android
 * silently drops it into a default channel. The ids here MUST match `CHANNEL_FOR_CATEGORY`
 * in the backend's `integrations/push.py`.
 *
 * Why more than one: once channels exist, the OS owns their sound and importance. A resident
 * can silence shift chatter without silencing "your rent is overdue". One channel for
 * everything is the reason people turn an app's notifications off wholesale rather than
 * turning down the part that annoys them.
 *
 * ── Two things about importance that are easy to get wrong ──
 *
 * `LOW` on Android means NO SOUND and no heads-up banner — the notification slides into the
 * shade in silence. That is correct for genuine chatter and wrong for anything a person has
 * to act on. It is what made the meal RSVP silent: meals had no channel of their own, so they
 * were sent as `announcement` and inherited this channel's LOW.
 *
 * And Android will not let an app RAISE a channel's importance once the channel exists —
 * that dial belongs to the user, permanently. So correcting an importance in this file does
 * nothing on any phone that already has the app. A NEW id is the only way the fix lands,
 * which is why `announcements` is now `announcements_v2` and the old one is deleted below
 * rather than left behind as a dead row in the user's notification settings.
 */
const CHANNELS: {
  id: string;
  name: string;
  description: string;
  importance: any;
}[] = [
  {
    id: "tickets",
    name: "Complaints & requests",
    description: "Replies, assignments and resolutions on tickets you're involved in.",
    importance: Notifications.AndroidImportance.HIGH,
  },
  {
    id: "money",
    name: "Rent & payments",
    description: "Rent due, payment verified or rejected.",
    importance: Notifications.AndroidImportance.HIGH,
  },
  {
    id: "account",
    name: "Account & KYC",
    description: "Identity verification decisions and account changes.",
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    id: "shifts",
    name: "Shifts",
    description: "Shift changes and staff scheduling.",
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    // MAX, not HIGH: this is the one push with a deadline attached. A resident who misses it
    // is not mildly inconvenienced — they are counted as eating, or not, by a kitchen that
    // has already started cooking. It is also the only channel whose notification carries
    // buttons, and a silent notification with buttons is a contradiction.
    id: "meals",
    name: "Meals",
    description: "Meal prompts you need to answer, and your points.",
    importance: Notifications.AndroidImportance.MAX,
  },
  {
    // DEFAULT, not LOW: a notice makes a sound now. "Water is off tomorrow morning" arriving
    // in silence is a notice nobody reads. Still below meals and rent, which is the point of
    // having the levels — a resident who mutes this one keeps the two that matter.
    id: "announcements_v2",
    name: "Announcements",
    description: "Notices from your property or from PGow.",
    importance: Notifications.AndroidImportance.DEFAULT,
  },
];

/** Channels that have been superseded by a new id. Deleted on launch so a phone that had the
 *  old one does not show a dead, un-silenceable entry in the app's notification settings
 *  alongside its replacement. */
const RETIRED_CHANNELS = ["announcements"];

export async function registerNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Promise.all([
    ...CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        description: c.description,
        importance: c.importance,
        lightColor: Colors.primary,
        // Explicit rather than relying on the importance default. An OEM skin that ships a
        // stricter default is exactly the environment where "it is silent on my phone only"
        // comes from, and these two cost nothing to state.
        sound: "default",
        enableVibrate: true,
      })
    ),
    // Best effort: deleting a channel that was never created is not an error worth failing
    // launch over.
    ...RETIRED_CHANNELS.map((id) =>
      Notifications.deleteNotificationChannelAsync?.(id)?.catch?.(() => {}) ??
      Promise.resolve()
    ),
  ]);
}

/**
 * The "I'll eat" / "Skip" buttons on a meal push. The identifier here MUST match
 * `push.MEAL_RSVP_CATEGORY` server-side exactly — Android reads it straight out of the FCM
 * `categoryId` data field to decide which buttons to attach, including when the app is fully
 * closed. `opensAppToForeground: false` is what makes tapping a button submit silently
 * instead of launching the app to the meals screen.
 */
export async function registerMealRsvpCategory(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.setNotificationCategoryAsync(MEAL_RSVP_CATEGORY, [
    { identifier: "EAT", buttonTitle: "I'll eat ✅", options: { opensAppToForeground: false } },
    { identifier: "SKIP", buttonTitle: "Skip ❌", options: { opensAppToForeground: false } },
    { identifier: "PROMO_CTA", buttonTitle: "View Offer", options: { opensAppToForeground: true } },
  ]);

  // The second state. Once the RSVP is in, "I'll eat" and "Skip" are no longer the available
  // moves — offering them again would invite a tap that earns nothing and says nothing new.
  // The confirmation is worth leaving in the shade, because it carries the points; `Close`
  // is how a resident is done with it, and like the other two it never opens the app.
  await Notifications.setNotificationCategoryAsync(MEAL_DONE_CATEGORY, [
    { identifier: "CLOSE", buttonTitle: "Close", options: { opensAppToForeground: false } },
  ]);
}

/**
 * Where a tapped push goes. The backend puts `screen` in the push `data` block precisely so
 * this does not have to re-derive it — without it every notification opens the home screen
 * and the person has to go find whatever it was about.
 */
export function routeFromPushData(data: Record<string, unknown> | undefined): void {
  let screen = typeof data?.screen === "string" ? data.screen : null;

  // Maintenance and Ticket routing override
  const category = data?.category as string | undefined;
  const actionType = data?.actionType as string | undefined;
  const actionId = data?.actionId as string | undefined;

  if (
    category === "complaint" ||
    category === "service" ||
    actionType === "request"
  ) {
    // Dynamic import to avoid circular dependencies if any, though authStore is usually safe.
    // We can require it inline or assume it's available since channels is top-level.
    const { useAuthStore } = require("../../store/authStore");
    const activeRole = useAuthStore.getState().activeRole;

    if (activeRole === "guest") {
      screen = actionId ? `/(guest)/ticket/${actionId}` : "/(guest)/(tabs)/support";
    } else if (activeRole === "owner" || activeRole === "manager") {
      // Straight to the ticket, not the services tab list — the server's own push already
      // names it via actionId, so making the owner find it again in a list is the exact gap
      // this deep link exists to close. That screen fetches the full ticket (photo included;
      // the list endpoint the services tab reads never carries attachments) and, for a
      // COMPLAINT still open, offers the same "book a technician" action that hands it to
      // the area manager.
      screen = actionId ? `/(owner)/ticket/${actionId}` : "/(owner)/services";
    } else if (activeRole === "maintenance") {
      screen = "/(staff)/housekeeping";
    }
  }

  // A payment notification is a DECISION, so it has to land where the decision can be made.
  //
  // "2 payments waiting to be verified" used to open the payments tab — the collection view,
  // which reports what has already been settled and offers no verify/reject. The owner then
  // had to work out for themselves that the actions live in the notifications inbox. That
  // inbox (`/notifications` → `OwnerAnnouncementsTab`) renders each pending payment as a
  // decision card with Verify and Reject on it, which is exactly what the notification is
  // asking them to do, so that is where the tap goes now.
  //
  // A resident tapping their own payment notification is not making a decision — they are
  // checking whether theirs went through — so they keep going to their payments tab.
  if (category === "rent" || category === "finance" || actionType === "payment") {
    const { useAuthStore } = require("../../store/authStore");
    const activeRole = useAuthStore.getState().activeRole;
    if (activeRole === "owner" || activeRole === "manager") {
      // UNCHANGED, and deliberately so — see the note above. Verify/Reject live in the inbox,
      // so that is where an owner's payment notification has to land. A receipt is a record,
      // not a decision surface, and routing an owner there would undo this fix.
      screen = "/notifications";
    } else if (actionId) {
      // A resident tapping their own payment notification is checking whether it went
      // through. Now that the receipt is an addressable route, it can answer that directly
      // rather than dropping them on the payments tab to find the row themselves.
      screen = `/receipt/${actionId}`;
    } else {
      screen = "/(guest)/(tabs)/guest-payments";
    }
  }

  // NOT deep-linked to /resident/[id]/kyc, though the route now exists. `kyc/service.py`
  // sends `action_id = kyc.id` — the SUBMISSION's id, not the membership's — and the resident
  // routes are keyed on membership (that is what the roster returns). Pointing this at the
  // resident route would land every KYC push on "this resident is no longer in this PG".
  // Resolving one to the other needs a lookup the client does not have, so KYC keeps falling
  // through to the inbox, where its decision card already lives.

  // Prevent duplicate navigation by using router.navigate instead of push
  if (screen) {
    router.navigate(screen as never);
  }
}
