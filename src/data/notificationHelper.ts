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
};
