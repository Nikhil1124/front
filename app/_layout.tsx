/**
 * Master Root Layout — app initialization, providers, and the top-level Stack.Protected
 * guards that replace the old screenStack/pushScreen system. Each guard mirrors what
 * `RoleGuard` used to check per-screen; here it's declared once per group instead of on
 * every one of the 23 screens that used to wrap themselves in it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Stack, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
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
import { useRegisterDeviceForPush } from '@/features/devices/useDevices';
import { useSession } from '@/features/auth/useAuth';
// Side-effect import: defines BACKGROUND_NOTIFICATION_TASK at module scope, which must happen
// on every JS launch — including Expo's headless relaunch for a killed app — before the OS can
// deliver an Eat/Skip button tap to it.
import { BACKGROUND_NOTIFICATION_TASK } from '@/tasks/backgroundNotificationTask';
import { Colors } from '@/theme';
import { AlertOverlay } from '@/components/AlertOverlay';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

/**
 * Expo Router's own convention: a route file exporting `ErrorBoundary` gets its subtree
 * wrapped in one (see `expo-router/views/Try`). Exported from the ROOT layout, so it catches
 * a render crash anywhere in the app instead of leaving the user on a blank screen.
 */
export { AppErrorBoundary as ErrorBoundary };

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

function RootLayoutNav() {
  const init = usePGowStore((s) => s.init);
  const submitRSVP = usePGowStore((s) => s.submitRSVP);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeRole = useAuthStore((s) => s.activeRole);
  const user = useAuthStore((s) => s.user);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  // Keeps `useAuthStore.user` fresh in the background once signed in (5-minute staleTime).
  // The initial value on login/register/etc comes from each mutation's own `useTokenLanding`,
  // not from this query directly — but mounting it here is what makes `qk.session()` a live,
  // observed cache entry those mutations can seed via `setQueryData`.
  useSession();

  // Registers this phone for push once signed in, and re-registers on every property
  // switch — see the hook's own doc for why this single line is load-bearing.
  useRegisterDeviceForPush();

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
  const appReady = isHydrated && (fontsLoaded || !!fontError);

  const onRootLayout = useCallback(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  useEffect(() => {
    onRootLayout();
  }, [onRootLayout]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
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

  const isStaffRole = activeRole === 'chef' || activeRole === 'kitchen_staff' || activeRole === 'maintenance' || activeRole === 'delivery_agent';
  // A self-registered owner holds no membership until property #1 exists, so "signed in with
  // nothing" has to resolve to the owner group or they land nowhere. But that must NOT
  // swallow a resident whose membership ended: they are not an owner, they need the join
  // screen, and claiming them here is what made /guest-join unreachable below.
  const hasNoMemberships = !!user && user.memberships.length === 0;
  const isOwnerRole =
    activeRole === 'owner' || activeRole === 'manager' || (hasNoMemberships && activeRole !== 'guest');
  // A resident with a valid token but no property left to belong to. The (auth) group owns
  // /guest-join, so it stays mounted for them — guarding it on `!accessToken` alone meant
  // app/index.tsx redirected them to a screen its own guard had just unmounted, and they
  // landed on +not-found.
  const needsPropertyJoin = !!accessToken && activeRole === 'guest' && hasNoMemberships;
  // On a cold launch, accessToken is hydrated from SecureStore (fast) before activeRole is
  // known (a separate /v1/me round trip, slower) — a real gap, not just a render tick. If
  // groceries' guard only checked accessToken, that gap left it as the ONLY eligible screen
  // in the Stack (every role guard below still false), so it would flash before the real
  // role-based guard caught up and corrected it. Requiring a resolved role closes the gap
  // structurally instead of racing it.
  const hasResolvedRole = isOwnerRole || activeRole === 'guest' || isStaffRole;
  // Groceries is narrower than "every signed-in role" on purpose: owner, manager, guest and
  // chef are the only ones who actually place a grocery order here — kitchen_staff (chef's
  // helper, not the meal planner), maintenance and delivery_agent have no reason to.
  const canOrderGroceries = !!accessToken && (isOwnerRole || activeRole === 'guest' || activeRole === 'chef');

  return (
    <SafeAreaProvider>
      {/* "dark" means dark ICONS, which is what a light background needs. This was
          flipped to "light" alongside userInterfaceStyle: "dark" in app.json, but the
          palette is light-only (Colors.canvas = '#F7F9F7', textPrimary = '#17201A'), so
          light icons rendered white-on-near-white and the status bar disappeared.
          Revisit both together if a real dark theme is ever added. */}
      <StatusBar style="dark" />
      {/* NOT a safe-area boundary — `edges={[]}` applies no inset, deliberately.
          The app is edge-to-edge (`androidStatusBar.translucent: true`), so content
          draws under the status bar and the gesture bar, and **each screen owns its own
          insets**. In practice that means going through one of the shared pieces that
          already do it: `TabHeader` and `HubScreenWrapper` pad by `insets.top + 14`, and
          `useDock` pads the bottom by `max(insets.bottom, MIN_BOTTOM_PAD)`.

          This wrapper consumed `edges={['top']}` once; screens that also padded
          themselves ended up double-inset, and it was emptied rather than removed. The
          comment left behind said every screen "trusts this and must not consume the top
          inset again", which was then the exact opposite of what the code did — a screen
          written against it renders under the notch. That is what put the zoom controls
          in `LocationPicker` behind the clock.

          Anything rendering in a `<Modal>` needs its own insets regardless: a Modal is a
          separate native window and nothing here reaches it. */}
      <SafeAreaView style={styles.container} edges={[]}>
        {appReady ? (
          <Stack screenOptions={{ headerShown: false, animation: 'none', gestureEnabled: true }}>
            {/* The root index route must be explicitly included because we are providing manual children to Stack */}
            <Stack.Screen name="index" />

            <Stack.Protected guard={!accessToken || needsPropertyJoin}>
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

            {/* Owner, manager, guest and chef only — see canOrderGroceries above. */}
            <Stack.Protected guard={canOrderGroceries}>
              <Stack.Screen name="groceries" />
            </Stack.Protected>

            {/* The notifications screen (replaces the old bottom-sheet inbox) — shared
                the same way groceries is: every signed-in, role-resolved user can reach
                it, the screen itself reads which role from the `role` param the bell
                button passes. */}
            <Stack.Protected guard={!!accessToken && hasResolvedRole}>
              <Stack.Screen name="notifications" />
            </Stack.Protected>

            {/* Was under (owner) — owner/manager only. Moved here because a chef can
                raise a requisition too (create_order accepts OWNER/MANAGER/CHEF as
                raiser; list_orders scopes a chef to their own requests automatically).
                ProcurementScreen decides which tabs a given role actually sees. */}
            <Stack.Protected guard={!!accessToken && hasResolvedRole}>
              <Stack.Screen name="procurement" />
            </Stack.Protected>

            {/* Moved from (auth) — that group is unregistered once accessToken exists, so
                it was unreachable for any real signed-in owner/manager (Settings' link to
                it silently went nowhere). require_manage on the backend, so gated the same
                as the (owner) group itself rather than the broader hasResolvedRole. */}
            <Stack.Protected guard={!!accessToken && isOwnerRole}>
              <Stack.Screen name="owner-subscription" />
            </Stack.Protected>

            {/* Diagnostic screen for unmatched routes */}
            <Stack.Screen name="+not-found" />
          </Stack>
        ) : null}
        <AlertOverlay />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.container}>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
});
