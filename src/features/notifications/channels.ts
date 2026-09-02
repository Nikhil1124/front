import Notifications from "../../data/notificationsCompat";
import { Platform } from "react-native";
import { router } from "expo-router";
import { Colors } from "../../theme";
import { MEAL_RSVP_CATEGORY } from "../../tasks/backgroundNotificationTask";

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
    id: "announcements",
    name: "Announcements",
    description: "Notices from your property or from PGow.",
    importance: Notifications.AndroidImportance.LOW,
  },
];

export async function registerNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Promise.all(
    CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        description: c.description,
        importance: c.importance,
        lightColor: Colors.primary,
      })
    )
  );
}

/**
 * The "I'll eat" / "Skip" buttons on a meal push. The identifier here MUST match
 * `push.MEAL_RSVP_CATEGORY` server-side exactly — Android reads it straight out of the FCM
 * `categoryId` data field to decide which buttons to attach, including when the app is fully
 * closed. `opensAppToForeground: false` is what makes tapping a button submit silently
 * instead of launching the app to the meals screen.
 */
export async function registerMealRsvpCategory(): Promise<void> {
  // Meaningful on iOS and Android, but not implemented at all on web (throws, not a no-op).
  if (Platform.OS === "web") return;
  await Notifications.setNotificationCategoryAsync(MEAL_RSVP_CATEGORY, [
    { identifier: "EAT", buttonTitle: "I'll eat ✅", options: { opensAppToForeground: false } },
    { identifier: "SKIP", buttonTitle: "Skip ❌", options: { opensAppToForeground: false } },
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

  // Prevent duplicate navigation by using router.navigate instead of push
  if (screen) {
    router.navigate(screen as never);
  }
}
