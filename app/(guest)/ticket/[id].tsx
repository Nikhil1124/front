/**
 * Real ticket-id route — replaces the old `TICKET_DETAIL` screen-stack case, which had no
 * way to say which ticket to show and fell back to "the most recently created complaint"
 * (a documented gap in the code it replaced, not a preserved behavior).
 */
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Txt } from '@/components/ui';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';
import { TicketDetailScreen } from '@/features/guest/screens/TicketDetailScreen';

export default function TicketDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: complaints = [] } = useComplaintsQuery(activePgId ?? undefined);
  const ticket = complaints.find((t) => t.id === id);

  if (!ticket) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Txt>No ticket selected.</Txt>
      </View>
    );
  }

  return <TicketDetailScreen ticket={ticket} />;
}
