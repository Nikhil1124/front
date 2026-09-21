import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * `expo-notifications` where it exists, and a stub where it does not.
 *
 * Expo Go dropped remote push in SDK 53, and `require('expo-notifications')` can also fail in
 * a web build — so every call site would need its own guard without this. The stub is a
 * no-op, which is the honest behaviour: an app with no push still works.
 */
const isExpoGo = Constants?.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Android's real importance levels, copied from
 * `expo-notifications/build/NotificationChannelManager.types.d.ts`.
 *
 * These were previously written out one level low — the stub's `DEFAULT` was 4, which is the
 * real enum's `LOW`, and `LOW` on Android means no sound and no heads-up banner. So any
 * channel created through the fallback path came out a step quieter than the code asked for,
 * and `MAX` did not exist at all, which would have made the meals channel `undefined`.
 *
 * Silent-notification bugs are hard to notice precisely because nothing fails: the row is
 * written, the payload is right, delivery succeeds, and the phone just says nothing.
 */
const AndroidImportance = {
  UNKNOWN: 0,
  UNSPECIFIED: 1,
  NONE: 2,
  MIN: 3,
  LOW: 4,
  DEFAULT: 5,
  HIGH: 6,
  MAX: 7,
} as const;

const stub = {
  AndroidImportance,
  setNotificationHandler: () => {},
  setNotificationChannelAsync: async () => {},
  deleteNotificationChannelAsync: async () => {},
  setNotificationCategoryAsync: async () => {},
  scheduleNotificationAsync: async () => {},
  cancelScheduledNotificationAsync: async () => {},
  dismissNotificationAsync: async () => {},
  registerTaskAsync: async () => {},
  getPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  requestPermissionsAsync: async () => ({ granted: false }),
  getDevicePushTokenAsync: async () => ({ data: '' }),
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  addNotificationReceivedListener: () => ({ remove: () => {} }),
};

let Notifications: any = stub;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch {
    Notifications = stub;
  }
}

export default Notifications;

/** The shape a notification arrives as. `any` because the stub and the real module disagree
 *  about it and no call site here inspects more than `request.content.data`. */
export type Notification = any;
