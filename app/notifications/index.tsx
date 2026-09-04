/**
 * One route, one screen, for every role — OwnerAnnouncementsTab is the combined
 * notifications+notices inbox (KYC approvals, announcements, and a broadcast composer for
 * owner/manager; the same generic notification inbox and announcements for everyone else —
 * it gates its own owner/manager-only sections internally on `activeRole`). This used to
 * fork to a second, plainer `NotificationsScreen` for every non-owner/manager role, which
 * duplicated the inbox rendering and had drifted slightly out of sync with it; one screen
 * now serves both audiences instead of two screens reading the same data.
 *
 * A plain root-level Stack screen, reachable from any tab context regardless of which Tabs
 * navigator is currently active — see the historical note this replaced: the header bell in
 * (owner)/(tabs)/_layout.tsx used to push straight to a "notices" tab route, but a route
 * with no TabTrigger isn't part of that Tabs navigator's route table (expo-router/ui builds
 * it from declared TabTriggers, not the file system), so router.push('/notices') silently
 * went nowhere once its TabTrigger was removed from the dock.
 */
import { OwnerAnnouncementsTab } from '@/features/owner/tabs/OwnerAnnouncementsTab';

export default function NotificationsRoute() {
  return <OwnerAnnouncementsTab />;
}
