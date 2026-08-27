/**
 * One route for every role — the screen itself only needs a label, and the label is
 * whatever the caller already knew (owner vs manager, chef vs delivery agent) when it
 * pushed here, so there is no reason for four near-identical route files.
 */
import { useLocalSearchParams } from 'expo-router';
import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';

export default function NotificationsRoute() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  return <NotificationsScreen roleTitle={role ?? 'OWNER'} />;
}
