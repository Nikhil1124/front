/**
 * PGowApp — root container. Mirrors Kotlin `PGowApp(repository)`.
 * Renders:
 *   - Animated transitions between AppScreen routes
 *   - AlertOverlay (top floating toast)
 *
 * Back-stack & hardware back button:
 *   - The store owns a `screenStack: AppScreen[]`. `pushScreen`/`popScreen`/
 *     `replaceScreen`/`resetScreenTo` manipulate it.
 *   - This file wires the Android `BackHandler` to `popScreen`. Returning
 *     `true` from the handler tells RN we handled it (don't exit). Returning
 *     `false` lets the OS do its default (exit app) when at root.
 *   - iOS swipe-back gestures are handled by react-native-screens under the
 *     hood, but since we're using a custom switch, we expose a visible back
 *     arrow on every header instead (see each screen's header).
 */
import { useEffect } from 'react';
import { BackHandler, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { usePGowStore } from '@/store/usePGowStore';
import { Colors } from '@/theme';
import { WelcomeScreen } from '@/features/owner/WelcomeScreen';
import { OwnerRegisterScreen } from '@/features/owner/OwnerRegisterScreen';
import { OwnerLoginScreen } from '@/features/owner/OwnerLoginScreen';
import { OwnerSubscriptionScreen } from '@/features/owner/OwnerSubscriptionScreen';
import { OwnerDashboardScreen } from '@/features/owner/OwnerDashboardScreen';
import { GuestDashboardScreen } from '@/features/guest/GuestDashboardScreen';
import { StaffDashboardScreen } from '@/features/staff/StaffDashboardScreen';
// ── Task 8: new screens ─────────────────────────────────────────────────────
import { HousekeepingDashboard } from '@/features/housekeeping/HousekeepingDashboard';
import { ProcurementScreen } from '@/features/procurement/ProcurementScreen';
import { StaffAttendanceScreen } from '@/features/attendance/StaffAttendanceScreen';
// ── Cyber Mint hub-and-spoke drill-downs ─────────────────────────────────────
import { PnLAnalyticsDetailScreen } from '@/features/owner/screens/PnLAnalyticsDetailScreen';
import { ManagerProvisioningScreen } from '@/features/owner/screens/ManagerProvisioningScreen';
import { BedVisualizerScreen } from '@/features/manager/screens/BedVisualizerScreen';
import { TenantListScreen } from '@/features/manager/screens/TenantListScreen';
import { PortfolioScreen } from '@/features/owner/screens/PortfolioScreen';
import { TicketDetailScreen } from '@/features/guest/screens/TicketDetailScreen';
import { OwnerServicesScreen } from '@/features/owner/screens/OwnerServicesScreen';
import { UpiSettingsScreen } from '@/features/owner/screens/UpiSettingsScreen';
import { ManagePropertiesScreen } from '@/features/owner/screens/ManagePropertiesScreen';
import { SettingsScreen } from '@/features/owner/screens/SettingsScreen';
import { GuestHubServicesScreen } from '@/features/guest/screens/GuestHubServicesScreen';
// ── Groceries ─────────────────────────────────────────────────────────────
import { GroceriesScreen } from '@/features/groceries/screens/GroceriesScreen';
import { GroceryCategoryScreen } from '@/features/groceries/screens/GroceryCategoryScreen';
import { GroceryProductScreen } from '@/features/groceries/screens/GroceryProductScreen';
import { GroceryCartScreen } from '@/features/groceries/screens/GroceryCartScreen';
import { GroceryCheckoutScreen } from '@/features/groceries/screens/GroceryCheckoutScreen';
import { GroceryOrdersScreen } from '@/features/groceries/screens/GroceryOrdersScreen';
import { GroceryOrderDetailScreen } from '@/features/groceries/screens/GroceryOrderDetailScreen';
import type { FeedbackComplaintEntity } from '@/types';

import { AlertOverlay } from '@/components/AlertOverlay';
import { RoleGuard } from '@/components/RoleGuard';
import { Txt } from '@/components/ui';
import { haptic } from '@/utils/haptics';

/**
 * TAB INDEXES — must match `TABS` in `OwnerLoginScreen.tsx`:
 *   [0: PG Owner, 1: PG Manager, 2: Kitchen & Staff, 3: Resident / Guest]
 *
 * The bug being fixed: previously `STAFF_LOGIN` was passing `initialTab={1}`
 * (Manager) and `GUEST_JOIN` was passing `initialTab={2}` (Staff). The
 * welcome cards "Open Staff Dashboard" and "Access Resident Portal" therefore
 * opened the wrong login form. Mapped below to the correct tab indices.
 */
const TAB_INDEX = {
  OWNER: 0,
  MANAGER: 1,
  STAFF: 2,
  GUEST: 3,
} as const;

export function PGowApp() {
  const currentScreen = usePGowStore((s) => s.currentScreen);
  const popScreen = usePGowStore((s) => s.popScreen);

  // NOTE: `init()` is called from `app/_layout.tsx`, sequenced after
  // `hydrateFromStorage()` resolves. Calling it again here would race ahead
  // of hydration (child effects run before parent effects on mount), see
  // it with no token yet, and permanently mark the store `_initialized`
  // before the real token is available — silently breaking session restore.

  // Hardware back-button handling — Android only. iOS swipe-back gesture is
  // not applicable here because we don't use a Navigator; the visible header
  // back arrow is the iOS affordance.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const popped = popScreen();
      if (popped) {
        // Confirm the back navigation with a soft tick — feels native.
        haptic('selection');
        return true; // we handled it
      }
      // At root: let the OS do its default (exit the app). Returning false
      // also avoids trapping the user on the welcome screen.
      return false;
    });
    return () => subscription.remove();
  }, [popScreen]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'WELCOME': return <WelcomeScreen />;
      case 'OWNER_REGISTER': return <OwnerRegisterScreen />;
      case 'OWNER_LOGIN': return <OwnerLoginScreen initialTab={TAB_INDEX.OWNER} />;
      case 'OWNER_SUBSCRIPTION': return <OwnerSubscriptionScreen />;
      case 'OWNER_DASHBOARD': return <OwnerDashboardScreen />;
      // Resident portal → tab index 3 (Resident / Guest)
      case 'GUEST_JOIN': return <OwnerLoginScreen initialTab={TAB_INDEX.GUEST} />;
      case 'GUEST_DASHBOARD': return <GuestDashboardScreen />;
      // Staff portal → tab index 2 (Kitchen & Staff)
      case 'STAFF_LOGIN': return <OwnerLoginScreen initialTab={TAB_INDEX.STAFF} />;
      case 'STAFF_DASHBOARD': return <StaffDashboardScreen />;
      // ── Task 8: new screens ────────────────────────────────────────────────
      case 'HOUSEKEEPING_DASHBOARD':
        return (
          <RoleGuard allowedRoles={['chief', 'staff_housekeeping', 'manager', 'owner']}>
            <HousekeepingDashboard />
          </RoleGuard>
        );
      case 'PROCUREMENT_SCREEN': {
        // Manager-mode if the signed-in role is manager (or staff acting as one).
        // Owner otherwise. Falls back to owner if no role resolved.
        // NOTE: `usePGowStore.activeRole` is the UI's UserRole enum
        // ('OWNER' | 'GUEST' | 'STAFF' | 'MANAGER'), not the backend's
        // lowercase role string. Compare against 'MANAGER'.
        const role = usePGowStore.getState().activeRole;
        const isManager = role === 'MANAGER' || usePGowStore.getState().isManagerMode;
        const allowed = isManager
          ? (['manager', 'owner'] as const)
          : (['owner', 'manager'] as const);
        return (
          <RoleGuard allowedRoles={[...allowed]}>
            <ProcurementScreen mode={isManager ? 'manager' : 'owner'} />
          </RoleGuard>
        );
      }
      case 'STAFF_ATTENDANCE':
        return (
          <RoleGuard allowedRoles={['chief', 'staff_housekeeping', 'manager', 'owner']}>
            <StaffAttendanceScreen />
          </RoleGuard>
        );
      // ── Cyber Mint hub-and-spoke drill-downs ────────────────────────────────
      // Each is a dedicated full-screen page with a sticky back button
      // (see HubScreenWrapper). The dashboard hubs route to these via
      // pushScreen(...), keeping the home screens uncluttered.
      case 'PNL_ANALYTICS':
        return (
          <RoleGuard allowedRoles={['owner', 'manager']}>
            <PnLAnalyticsDetailScreen />
          </RoleGuard>
        );
      case 'MANAGER_PROVISIONING':
        return (
          <RoleGuard allowedRoles={['owner']}>
            <ManagerProvisioningScreen />
          </RoleGuard>
        );
      case 'BED_VISUALIZER':
        return (
          <RoleGuard allowedRoles={['manager', 'owner']}>
            <BedVisualizerScreen />
          </RoleGuard>
        );
      case 'TENANT_LIST':
        return (
          <RoleGuard allowedRoles={['manager', 'owner']}>
            <TenantListScreen />
          </RoleGuard>
        );
      case 'TICKET_DETAIL': {
        // The store doesn't track a selected ticket; the screen reads from
        // the complaints list. We grab the most recent one for now — a full
        // implementation would push the ticket id onto the stack too.
        const complaints = usePGowStore.getState().currentFeedbackComplaints;
        const ticket: FeedbackComplaintEntity | undefined = [...complaints].sort(
          (a, b) => b.timestamp - a.timestamp
        )[0];
        if (!ticket) {
          return (
            <RoleGuard allowedRoles={['tenant', 'manager', 'owner']}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Txt>No ticket selected.</Txt>
              </View>
            </RoleGuard>
          );
        }
        return (
          <RoleGuard allowedRoles={['tenant', 'manager', 'owner']}>
            <TicketDetailScreen ticket={ticket} />
          </RoleGuard>
        );
      }
      case 'OWNER_SERVICES':
        return (
          <RoleGuard allowedRoles={['owner', 'manager']}>
            <OwnerServicesScreen />
          </RoleGuard>
        );
      case 'UPI_SETTINGS':
        return (
          <RoleGuard allowedRoles={['owner', 'manager']}>
            <UpiSettingsScreen />
          </RoleGuard>
        );
      case 'MANAGE_PROPERTIES':
        return (
          <RoleGuard allowedRoles={['owner']}>
            <ManagePropertiesScreen />
          </RoleGuard>
        );
      case 'PORTFOLIO':
        return (
          <RoleGuard allowedRoles={['owner']}>
            <PortfolioScreen />
          </RoleGuard>
        );
      case 'SETTINGS_SCREEN':
        return (
          <RoleGuard allowedRoles={['owner', 'manager']}>
            <SettingsScreen />
          </RoleGuard>
        );
      case 'GUEST_HUB_SERVICES':
        return (
          <RoleGuard allowedRoles={['tenant', 'manager', 'owner']}>
            <GuestHubServicesScreen />
          </RoleGuard>
        );
      // INVOICE_DETAIL is rendered as a Modal at the call site (see
      // InvoiceDetailModal) rather than as a full-screen route — there is
      // no full-screen case here for it. The case exists in AppScreen so
      // the back-stack has a valid value if a future caller pushes it.
      case 'INVOICE_DETAIL':
        return (
          <RoleGuard allowedRoles={['tenant', 'manager', 'owner']}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Txt>Invoice detail opens as a modal.</Txt>
            </View>
          </RoleGuard>
        );
      case 'GROCERIES_SCREEN':
        return (
          <RoleGuard allowedRoles={['owner', 'manager', 'chief', 'tenant']}>
            <GroceriesScreen />
          </RoleGuard>
        );
      case 'GROCERY_CATEGORY':
        return (
          <RoleGuard allowedRoles={['owner', 'manager', 'chief', 'tenant']}>
            <GroceryCategoryScreen />
          </RoleGuard>
        );
      case 'GROCERY_PRODUCT':
        return (
          <RoleGuard allowedRoles={['owner', 'manager', 'chief', 'tenant']}>
            <GroceryProductScreen />
          </RoleGuard>
        );
      case 'GROCERY_CART':
        return (
          <RoleGuard allowedRoles={['owner', 'manager', 'chief', 'tenant']}>
            <GroceryCartScreen />
          </RoleGuard>
        );
      case 'GROCERY_CHECKOUT':
        // Chef is deliberately excluded — checkout is a real purchase, and
        // Chef can only build a request for the Manager to buy (see
        // GroceryCartScreen's role branch).
        return (
          <RoleGuard allowedRoles={['owner', 'manager', 'tenant']}>
            <GroceryCheckoutScreen />
          </RoleGuard>
        );
      case 'GROCERY_ORDERS':
        return (
          <RoleGuard allowedRoles={['owner', 'manager', 'tenant']}>
            <GroceryOrdersScreen />
          </RoleGuard>
        );
      case 'GROCERY_ORDER_DETAIL':
        return (
          <RoleGuard allowedRoles={['owner', 'manager', 'tenant']}>
            <GroceryOrderDetailScreen />
          </RoleGuard>
        );
      default: return <WelcomeScreen />;
    }
  };

  // Keying the Animated.View by `currentScreen` makes Reanimated mount a fresh
  // node per screen transition, which is what triggers the FadeIn/FadeOut.
  // A 220ms fade is short enough not to feel sluggish but long enough to mask
  // the screen swap.
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Cyber Mint migration: the canvas is now light mint (#F0FDF9), so the
          status bar text must be DARK to remain readable. The previous dark
          theme used style="light" (white text) which would be invisible on mint. */}
      <StatusBar style="dark" />
      <View style={styles.screenContainer}>
        <Animated.View
          key={currentScreen}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(120)}
          style={StyleSheet.absoluteFill}
        >
          {renderScreen()}
        </Animated.View>
      </View>
      <AlertOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  screenContainer: {
    flex: 1,
  },
});
