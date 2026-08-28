/**
 * Where an owner/manager lands from a complaint push, or from a deep link to one ticket.
 *
 * The push carries only `action_id` — the request id — so this fetches the one thing that id
 * can resolve to (`GET /v1/requests/{id}`, the detail endpoint, which is also the only one
 * that hydrates attachments). A FEEDBACK submission and a COMPLAINT arrive on the same push
 * shape server-side (`create_request` notifies for both, with `category: "complaint"` either
 * way), so this is also where the two are told apart — a "Book a technician" button on a
 * five-star meal review would be a design bug, not a helpful shortcut.
 */
import { StyleSheet, View, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Btn, Card, Col, Row, Spacer, Txt, LoadingState, ErrorState } from '@/components/ui';
import { KycDocumentsCard } from '@/components/KycDocumentsCard';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { useComplaintQuery } from '@/features/requests/useComplaints';
import { tradeForComplaint } from '@/features/requests/technicianTrades';
import { useAuthStore } from '@/store/authStore';
import { Colors, Layout } from '@/theme';

export function TicketDetailForRoleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: ticket, isLoading, error, refetch, isRefetching } = useComplaintQuery(id, activePgId ?? undefined);

  const isComplaint = ticket?.type === 'COMPLAINT';
  const canBook = isComplaint && ticket?.status !== 'Resolved';
  const spec = ticket ? tradeForComplaint(ticket.category, ticket.title) : null;

  return (
    <HubScreenWrapper
      title={isComplaint ? 'Complaint' : 'Feedback'}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {isLoading ? (
        <LoadingState label="Loading…" />
      ) : error || !ticket ? (
        <ErrorState error={error} title="Could not load this ticket" onRetry={refetch} />
      ) : (
        <View style={styles.body}>
          <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Row gap={10} align="center">
              <View style={[styles.badge, { backgroundColor: isComplaint ? `${Colors.danger}14` : `${Colors.success}14` }]}>
                <Ionicons
                  name={isComplaint ? 'alert-circle-outline' : 'star-outline'}
                  size={18}
                  color={isComplaint ? Colors.danger : Colors.success}
                />
              </View>
              <Col style={{ flex: 1 }}>
                <Txt size={15} weight="800" color={Colors.textPrimary}>{ticket.title}</Txt>
                <Txt size={12} color={Colors.textMuted} style={{ marginTop: 2 }}>
                  {ticket.guestName}{ticket.roomNo ? ` • Room ${ticket.roomNo}` : ''} • {ticket.status}
                </Txt>
              </Col>
            </Row>
            <Spacer size={10} />
            <Txt size={13} color={Colors.textSecondary} style={{ lineHeight: 19 }}>{ticket.description}</Txt>
          </Card>

          <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
              {ticket.mediaUri ? 'ATTACHED EVIDENCE' : 'EVIDENCE'}
            </Txt>
            <Spacer size={10} />
            <KycDocumentsCard idPhotoUri={ticket.mediaUri} selfieUri={null} emptyHint="No photo was attached to this ticket." />
          </Card>

          {ticket.adminResponse ? (
            <Card containerColor={Colors.surfaceElevated} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
              <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>YOUR RESPONSE</Txt>
              <Spacer size={6} />
              <Txt size={13} color={Colors.textPrimary}>{ticket.adminResponse}</Txt>
            </Card>
          ) : null}

          {canBook && spec ? (
            <Btn
              onPress={() => router.push(`/book-technician/${ticket.id}`)}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={Layout.borderRadiusButton}
              height={50}
            >
              <Ionicons name={spec.icon as any} size={18} color={Colors.textInverse} />
              <Txt size={14} weight="800" color={Colors.textInverse} style={{ marginLeft: 8 }}>{spec.label}</Txt>
            </Btn>
          ) : null}
        </View>
      )}
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

export default TicketDetailForRoleScreen;
