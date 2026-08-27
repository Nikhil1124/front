/**
 * Real ticket-id route — replaces the old `TICKET_DETAIL` screen-stack case, which had no
 * way to say which ticket to show and fell back to "the most recently created complaint"
 * (a documented gap in the code it replaced, not a preserved behavior).
 */
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Txt, LoadingState, ErrorState } from '@/components/ui';
import { Colors } from '@/theme';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';
import { TicketDetailScreen } from '@/features/guest/screens/TicketDetailScreen';

export default function TicketDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: complaints = [], isLoading, error, refetch } = useComplaintsQuery(activePgId ?? undefined);
  const ticket = complaints.find((t) => t.id === id);

  // The three states are distinct and used to collapse into one line of copy: while the
  // ticket list was still in flight this said "No ticket selected", which is both wrong and
  // alarming when you have just tapped a push notification about that exact ticket.
  if (isLoading) return <LoadingState label="Loading ticket…" />;
  if (error) return <ErrorState error={error} title="Could not load this ticket" onRetry={refetch} />;
  if (!ticket) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Txt size={14} weight="800" color={Colors.textPrimary}>Ticket not found</Txt>
        <Txt size={12} color={Colors.textMuted} style={{ marginTop: 4, textAlign: 'center' }}>
          It may have been closed, or it belongs to a different property.
        </Txt>
      </View>
    );
  }

  return <TicketDetailScreen ticket={ticket} />;
}
