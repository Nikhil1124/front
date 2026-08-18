import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants?.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any = {};

if (isExpoGo) {
  // Mock implementations for all expo-notifications functions used in the project
  Notifications = {
    AndroidImportance: {
      UNSPECIFIED: 0,
      NONE: 1,
      MIN: 2,
      LOW: 3,
      DEFAULT: 4,
      HIGH: 5,
    },
    setNotificationHandler: () => {},
    setNotificationChannelAsync: async () => {},
    setNotificationCategoryAsync: async () => {},
    scheduleNotificationAsync: async () => {},
    dismissNotificationAsync: async () => {},
    registerTaskAsync: async () => {},
    getPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
    requestPermissionsAsync: async () => ({ granted: false }),
    getDevicePushTokenAsync: async () => ({ data: '' }),
    addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
    addNotificationReceivedListener: () => ({ remove: () => {} }),
  };
} else {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    // Fail-safe mock if require fails
    Notifications = {
      AndroidImportance: {
        UNSPECIFIED: 0,
        NONE: 1,
        MIN: 2,
        LOW: 3,
        DEFAULT: 4,
        HIGH: 5,
      },
      setNotificationHandler: () => {},
      setNotificationChannelAsync: async () => {},
      setNotificationCategoryAsync: async () => {},
      scheduleNotificationAsync: async () => {},
      dismissNotificationAsync: async () => {},
      registerTaskAsync: async () => {},
      getPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
      requestPermissionsAsync: async () => ({ granted: false }),
      getDevicePushTokenAsync: async () => ({ data: '' }),
      addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
      addNotificationReceivedListener: () => ({ remove: () => {} }),
    };
  }
}

export default Notifications;
export type Notification = any;
