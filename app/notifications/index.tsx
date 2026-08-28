/**
 * One route for every role — the screen itself only needs a label, and the label is
 * whatever the caller already knew (owner vs manager, chef vs delivery agent) when it
 * pushed here, so there is no reason for four near-identical route files.
 *
 * Owner/manager get OwnerAnnouncementsTab instead of the plain NotificationsScreen — same
 * reasoning as the header bell in (owner)/(tabs)/_layout.tsx: it's the richer screen (a
 * broadcast composer, approvals, folded-in Reviews). That bell used to push straight to
 * the "notices" tab route, but a route with no TabTrigger isn't part of this Tabs
 * navigator's route table (expo-router/ui builds it from declared TabTriggers, not the
 * file system) — router.push('/notices') silently went nowhere once its TabTrigger was
 * removed from the dock. This route is a plain root-level Stack screen, reachable from any
 * tab context regardless of which Tabs navigator is currently active, so it doesn't have
 * that problem.
 */
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';
import { OwnerAnnouncementsTab } from '@/features/owner/tabs/OwnerAnnouncementsTab';

export default function NotificationsRoute() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'owner' || activeRole === 'manager') return <OwnerAnnouncementsTab />;
  return <NotificationsScreen roleTitle={role ?? 'OWNER'} />;
}
