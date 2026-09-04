/**
 * NotificationHelper — React Native port of Kotlin `NotificationHelper`.
 * Uses `expo-notifications` for local push notifications. In Expo Go,
 * notifications may be suppressed; we wrap every call in try/catch.
 */
import Notifications from '@/data/notificationsCompat';
import type { MealNotificationEntity } from '@/types';

let channelConfigured = false;

async function ensureChannel(): Promise<void> {
  if (channelConfigured) return;
  try {
    await Notifications.setNotificationChannelAsync('meal_rsvp_channel', {
      name: 'Meal RSVPs & PG Alerts',
      description: 'Push notifications for daily meal RSVPs, food announcements, and PG alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#14E2B1',
    });
    await Notifications.setNotificationChannelAsync('kyc_verification_channel', {
      name: 'KYC Verifications',
      description: 'Notifications regarding guest identity document verification',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('payment_verification_channel', {
      name: 'Payment Receipts & Dues',
      description: 'Notifications for rent payments, receipts, and owner verifications',
      importance: Notifications.AndroidImportance.HIGH,
    });
    channelConfigured = true;
  } catch (e) {
    // ignore — Expo Go may not support channels
  }
}

async function push(title: string, body: string, channelId: string = 'meal_rsvp_channel'): Promise<void> {
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: {}, sound: true },
      // `{ channelId }` delivers immediately, same as `null`, but on the channel that
      // actually carries this notification's importance/vibration/color — a bare `null`
      // silently drops every caller's channelId and falls back to Android's default.
      trigger: { channelId },
    });
  } catch (e) {
    // Silently swallow — the in-app activeAlert toast still surfaces the message.
  }
}

/**
 * A fixed `identifier` makes this idempotent — scheduling again with the same identifier
 * replaces the previous request instead of stacking a duplicate, so callers don't need to
 * track whether a given reminder is already scheduled (across re-renders, tab remounts,
 * app restarts) before calling this again.
 */
async function scheduleRepeating(
  identifier: string,
  title: string,
  body: string,
  trigger: Record<string, unknown>,
  channelId: string = 'meal_rsvp_channel'
): Promise<void> {
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, data: {}, sound: true },
      trigger: { ...trigger, channelId },
    });
  } catch (e) {
    // Same device without notification permission, or Expo Go — the toggle stays on
    // screen but nothing is actually scheduled, same soft-fail as every other call here.
  }
}

export const NotificationHelper = {
  async showRsvpNotification(notification: MealNotificationEntity, _activeGuestId: string): Promise<void> {
    const title = `⏰ RSVP: ${notification.mealType} is ready!`;
    const body = `Menu: ${notification.menuItems}\nSelect Eating or Skipping below directly.`;
    await push(title, body, 'meal_rsvp_channel');
  },

  async showFoodAnnouncementNotification(title: string, message: string): Promise<void> {
    await push(title, message, 'meal_rsvp_channel');
  },

  async showKycNotification(guestName: string, isVerified: boolean, rejectReason = ''): Promise<void> {
    const title = isVerified ? '✅ KYC Verified!' : '❌ KYC Action Needed';
    const body = isVerified
      ? `Hello ${guestName}, your ID document & selfie photo have been officially verified by your PG Owner!`
      : `Hello ${guestName}, your KYC submission was rejected by the owner.${rejectReason ? ` Reason: ${rejectReason}` : ''}`;
    await push(title, body, 'kyc_verification_channel');
  },

  async showPaymentNotification(title: string, message: string): Promise<void> {
    await push(title, message, 'payment_verification_channel');
  },

  showRentDueAlertNotification: async function (title: string, message: string): Promise<void> {
    await this.showPaymentNotification(title, message);
  },

  /** Fires every day at `hour:minute`, device-local time, until `cancelScheduled` is called
   *  with the same `identifier`. */
  async scheduleDailyReminder(identifier: string, hour: number, minute: number, title: string, body: string): Promise<void> {
    await scheduleRepeating(identifier, title, body, { type: 'daily', hour, minute });
  },

  /** Fires every `intervalSeconds` from now until `cancelScheduled` is called with the same
   *  `identifier`. iOS ignores a repeating interval under 60 seconds. */
  async scheduleRepeatingReminder(identifier: string, intervalSeconds: number, title: string, body: string): Promise<void> {
    await scheduleRepeating(identifier, title, body, { type: 'timeInterval', seconds: intervalSeconds, repeats: true });
  },

  async cancelScheduled(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (e) {
      // ignore
    }
  },
};
