/**
 * Master Root Layout — handles app initialization, SafeAreaProvider,
 * StatusBar, top/bottom overlays, and Expo Router Stack navigation setup.
 */
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/data/queryClient';
import { setGateHandler, setSessionExpiredHandler } from '@/data/apiClient';
import {
  registerNotificationChannels,
  registerMealRsvpCategory,
  routeFromPushData,
} from '@/features/notifications/channels';
// Side-effect import: defines BACKGROUND_NOTIFICATION_TASK at module scope, which must happen
// on every JS launch — including Expo's headless relaunch for a killed app — before the OS can
// deliver an Eat/Skip button tap to it.
import { BACKGROUND_NOTIFICATION_TASK } from '@/tasks/backgroundNotificationTask';
import { Colors } from '@/theme';

/**
 * Bridges the network layer's two "the app must react to this" events onto the screen
 * state this app already navigates by. Registered once, outside the component, so a
 * re-render never re-installs them and a request that lands mid-render still finds a
 * handler.
 */
setSessionExpiredHandler(() => {
  queryClient.clear();
  // Not just a screen change: the previous account's property, roster and payments are still
  // sitting in the store, and leaving them there means the next person to open the app sees
  // someone else's data behind the login screen.
  usePGowStore.getState().patch({
    currentScreen: 'WELCOME',
    activeRole: null,
    isManagerMode: false,
    loggedInOwner: null,
    loggedInGuest: null,
    loggedInStaff: null,
    currentGuests: [], currentStaff: [], currentPayments: [], currentRSVPs: [],
    currentFeedbackComplaints: [], currentPGNotifications: [], currentRoleNotifications: [],
    currentExpenses: [], currentOwnerForGuest: null,
    allPGsState: [], allGuestsState: [], allStaffState: [], allPaymentsState: [],
    allComplaintsState: [], allExpensesState: [], allNotifications: [], allRSVPsState: [],
    _initialized: false,
  });
});

// Gates do NOT navigate. This app surfaces KYC state inside the guest dashboard's own tab,
// so moving the user on a gate would change the flow rather than report it — the caller
// receives the PGowApiError and shows it where the action was taken.
setGateHandler(() => {});

export default function RootLayout() {
  const init = usePGowStore((s) => s.init);
  const submitRSVP = usePGowStore((s) => s.submitRSVP);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);

  useEffect(() => {
    // Tokens first: every query is gated on having one, so hydrating after `init()` would
    // let the first render fire a signed-out session fetch and bounce to WELCOME.
    hydrateFromStorage().finally(() => {
      init();
    });
  }, [init, hydrateFromStorage]);

  useEffect(() => {
    // Independent of auth: channels/categories must exist before a push naming one can
    // arrive, and this device may receive one before anyone signs in.
    registerNotificationChannels();
    registerMealRsvpCategory();
    // Activates the task backgroundNotificationTask.ts already defined at module scope above —
    // without this call the task exists but is never subscribed to notification-response
    // events, so an Eat/Skip tap while the app is backgrounded or fully killed goes nowhere.
    Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => {
      // Best-effort — the killed-app RSVP path is an enhancement, not a boot requirement.
    });

    // Tapping a push (foreground, background, or the app fully closed) routes here. Background/
    // killed taps are handled by BACKGROUND_NOTIFICATION_TASK instead, which runs with no React
    // tree mounted yet — this listener only ever fires for a foreground tap.
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data as
        | { actionType?: string; actionId?: string; screen?: string }
        | undefined;

      if (actionIdentifier === 'EAT' || actionIdentifier === 'SKIP') {
        if (data?.actionType !== 'meal' || !data.actionId) return;
        const result = await submitRSVP(data.actionId, actionIdentifier === 'EAT' ? 'REQUIRED' : 'NOT_REQUIRED');
        if (result.ok) {
          usePGowStore.getState().patch({
            activeAlert: {
              title: actionIdentifier === 'EAT' ? '✅ Marked as eating' : '❌ Marked as skipping',
              description: 'Your RSVP was recorded.',
              type: 'SUCCESS',
              timestamp: Date.now(),
            },
          });
        }
        // On failure, submitRSVP already surfaced its own "❌ RSVP NOT RECORDED" alert.
        await Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
        return;
      }

      routeFromPushData(data as Record<string, unknown> | undefined);
    });
    return () => sub.remove();
  }, [submitRSVP]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <View style={styles.container}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.LuxuryPureBlack,
  },
});
