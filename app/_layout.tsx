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

import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/data/queryClient';
import { setGateHandler, setSessionExpiredHandler } from '@/data/apiClient';
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
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);

  useEffect(() => {
    // Tokens first: every query is gated on having one, so hydrating after `init()` would
    // let the first render fire a signed-out session fetch and bounce to WELCOME.
    hydrateFromStorage().finally(() => {
      init();
    });
  }, [init, hydrateFromStorage]);

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
