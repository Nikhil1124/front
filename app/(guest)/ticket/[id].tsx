/**
 * Real ticket-id route — replaces the old `TICKET_DETAIL` screen-stack case, which had no
 * way to say which ticket to show and fell back to "the most recently created complaint"
 * (a documented gap in the code it replaced, not a preserved behavior).
 *
 * Uses `useComplaintQuery` (the per-ticket detail endpoint), not `useComplaintsQuery` (the
 * list) — the list never hydrates attachments (`toComplaint`'s own comment: "every
 * list-derived complaint has mediaUri: null no matter what the resident photographed").
 * This route used to read from the list, so a resident's own photo never showed up on their
 * own ticket's detail page — the exact gap the owner-side screens were already fixed for.
 */
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Txt, LoadingState, ErrorState } from '@/components/ui';
import { Colors } from '@/theme';
import { useComplaintQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';
import { TicketDetailScreen } from '@/features/guest/screens/TicketDetailScreen';

export default function TicketDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: ticket, isLoading, error, refetch, isRefetching } = useComplaintQuery(id, activePgId ?? undefined);

  // The three states are distinct and used to collapse into one line of copy: while the
  // ticket list was still in flight this said "No ticket selected", which is both wrong and
  // alarming when you have just tapped a push notification about that exact ticket.
  if (isLoading) return <LoadingState label="Loading ticket…" />;
  if (error) return <ErrorState error={error} title="Could not load this ticket" onRetry={refetch} />;
  if (!ticket) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Txt size={14} weight="700" color={Colors.textPrimary}>Ticket not found</Txt>
        <Txt size={12} color={Colors.textMuted} style={{ marginTop: 4, textAlign: 'center' }}>
          It may have been closed, or it belongs to a different property.
        </Txt>
      </View>
    );
  }

  return <TicketDetailScreen ticket={ticket} onRefresh={refetch} refreshing={isRefetching} />;
}
