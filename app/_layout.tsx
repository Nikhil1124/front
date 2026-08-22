/**
 * Master Root Layout — app initialization, providers, and the top-level Stack.Protected
 * guards that replace the old screenStack/pushScreen system. Each guard mirrors what
 * `RoleGuard` used to check per-screen; here it's declared once per group instead of on
 * every one of the 23 screens that used to wrap themselves in it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Stack, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import Notifications from '../src/data/notificationsCompat';

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
import { AlertOverlay } from '@/components/AlertOverlay';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Bridges the network layer's two "the app must react to this" events onto auth state. The
 * (auth) group's guard is `!accessToken`, so clearing the token here is the whole navigation
 * story — Stack.Protected reacts to the flip on its own, nothing here calls a router.
 */
setSessionExpiredHandler(() => {
  queryClient.clear();
  // Not just an auth clear: the previous account's property, roster and payments are still
  // sitting in the store, and leaving them there means the next person to open the app sees
  // someone else's data behind the login screen.
  usePGowStore.getState().patch({
    activeRole: null,
    isManagerMode: false,
    loggedInOwner: null,
    loggedInGuest: null,
    loggedInStaff: null,
    _initialized: false,
  });
  useAuthStore.getState().logout();
});

// Gates do NOT navigate. This app surfaces KYC state inside the guest dashboard's own tab,
// so moving the user on a gate would change the flow rather than report it — the caller
// receives the PGowApiError and shows it where the action was taken.
setGateHandler(() => {});

export default function RootLayout() {
  const init = usePGowStore((s) => s.init);
  const submitRSVP = usePGowStore((s) => s.submitRSVP);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeRole = useAuthStore((s) => s.activeRole);

  const [isHydrated, setIsHydrated] = useState(false);

  // Cold-start gotcha: a notification tap can fire before the Stack's navigation state has
  // actually finished initializing, even though this component has "mounted" by then — calling
  // router.push in that window silently does nothing. So a push received too early is held
  // here and flushed once navigationState.key confirms the router is really ready, instead of
  // assuming mount-order guarantees routing works.
  const navigationState = useRootNavigationState();
  const pendingPushData = useRef<Record<string, unknown> | undefined>(undefined);
  const isRouterReady = !!navigationState?.key;

  useEffect(() => {
    if (isRouterReady && pendingPushData.current) {
      routeFromPushData(pendingPushData.current);
      pendingPushData.current = undefined;
    }
  }, [isRouterReady]);

  useEffect(() => {
    // Tokens first: every query is gated on having one, so hydrating after `init()` would
    // let the first render fire a signed-out session fetch and bounce to (auth).
    hydrateFromStorage()
      .finally(() => init())
      .finally(() => setIsHydrated(true));
  }, [init, hydrateFromStorage]);

  // Splash stays up until hydration resolves — without this, a returning signed-in user's
  // very first frame is the (auth) group (accessToken is still null pre-hydration), which
  // flips to their dashboard a moment later. That flash was latent in the old screenStack
  // system too (it always booted at WELCOME), just never fixed; folding this in now since
  // the boot sequence is already being rewritten.
  const onRootLayout = useCallback(() => {
    if (isHydrated) SplashScreen.hideAsync().catch(() => {});
  }, [isHydrated]);

  useEffect(() => {
    onRootLayout();
  }, [onRootLayout]);

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
    const sub = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
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

      // Cold-start guard — see the pendingPushData ref above. isRouterReady is read fresh
      // via the ref-less closure variable capture below by re-registering this listener
      // whenever readiness flips (see the dependency array), so a tap that arrives after
      // the router becomes ready still routes immediately rather than waiting on the next
      // flush effect.
      if (isRouterReady) {
        routeFromPushData(data as Record<string, unknown> | undefined);
      } else {
        pendingPushData.current = data as Record<string, unknown> | undefined;
      }
    });
    return () => sub.remove();
  }, [submitRSVP, isRouterReady]);

  const isStaffRole = activeRole === 'chef' || activeRole === 'kitchen_staff' || activeRole === 'maintenance';
  const isOwnerRole = activeRole === 'owner' || activeRole === 'manager';
  // On a cold launch, accessToken is hydrated from SecureStore (fast) before activeRole is
  // known (a separate /v1/me round trip, slower) — a real gap, not just a render tick. If
  // groceries' guard only checked accessToken, that gap left it as the ONLY eligible screen
  // in the Stack (every role guard below still false), so it would flash before the real
  // role-based guard caught up and corrected it. Requiring a resolved role closes the gap
  // structurally instead of racing it.
  const hasResolvedRole = isOwnerRole || activeRole === 'guest' || isStaffRole;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          {/* Single top-edge SafeAreaView for the whole app — every screen in every group
              trusts this and must not consume the top inset again itself (that was the
              cause of the double-safe-area header bugs fixed earlier). */}
          <SafeAreaView style={styles.container} edges={[]}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={!accessToken}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>

              <Stack.Protected guard={!!accessToken && isOwnerRole}>
                <Stack.Screen name="(owner)" />
              </Stack.Protected>

              <Stack.Protected guard={!!accessToken && activeRole === 'guest'}>
                <Stack.Screen name="(guest)" />
              </Stack.Protected>

              <Stack.Protected guard={!!accessToken && isStaffRole}>
                <Stack.Screen name="(staff)" />
              </Stack.Protected>

              {/* Shared across every signed-in role (owner/manager/chef/tenant all shop
                  here) — guarded on "signed in AND role-resolved", not just "has a token".
                  See hasResolvedRole above: a bare accessToken check here raced the role
                  fetch on cold launch and could flash this screen before the real
                  role-based guard above ever got a chance to be true. */}
              <Stack.Protected guard={!!accessToken && hasResolvedRole}>
                <Stack.Screen name="groceries" />
              </Stack.Protected>
            </Stack>
            <AlertOverlay />
          </SafeAreaView>
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
