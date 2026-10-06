/**
 * Where an owner/manager lands from a complaint push, or from a deep link to one ticket.
 *
 * The push carries only `action_id` — the request id — so this fetches the one thing that id
 * can resolve to (`GET /v1/requests/{id}`, the detail endpoint, which is also the only one
 * that hydrates attachments). A FEEDBACK submission and a COMPLAINT arrive on the same push
 * shape server-side (`create_request` notifies for both, with `category: "complaint"` either
 * way), so this is also where the two are told apart — a "Book a Technician" button on a
 * five-star meal review would be a design bug, not a helpful shortcut.
 */
import { StyleSheet, View, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { KycDocumentsCard } from '@/components/KycDocumentsCard';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { useComplaintQuery } from '@/features/requests/useComplaints';
import { tradeForComplaint } from '@/features/requests/technicianTrades';
import { useAuthStore } from '@/store/authStore';
import { Radii, Colors } from '@/theme';
import { Btn, Card, Col, ErrorState, LoadingState, Row, Spacer, Txt } from '@/components/ui';

export function TicketDetailForRoleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: ticket, isLoading, error, refetch, isRefetching } = useComplaintQuery(id, activePgId ?? undefined);

  const isComplaint = ticket?.type === 'COMPLAINT';
  // A repair's progress lives in the stage, not in `status`. REPAIR's stage machine has
  // `resolves_on=None` — the desk still has to price the work — so `status` stops at
  // "In Progress" and stays there after the technician has finished. Reading `status` alone
  // is what put a "Book a Technician" button on finished work.
  // A ticket carries one stage machine or the other, never both, so whichever is set is the
  // one to read. Laundry was missing here: an owner tapping a laundry push landed on this
  // screen and saw no stage at all, because `details.laundry_stage` is a different key.
  const stage = ticket?.serviceStage || ticket?.laundryStage || '';
  // Each machine's last stage. Laundry's also closes the ticket; a repair's deliberately
  // does not, because the desk still has to price the work.
  const workFinished = stage === 'work_done' || stage === 'delivered';
  // Mirrors `escalate_request`'s own guard (`assigned_platform_role_id is not None` ->
  // 409 "This ticket is already with PGow support."), so the button is shown only when the
  // call behind it would actually succeed.
  const canBook = isComplaint && ticket?.status !== 'Resolved' && !ticket?.withPgowSupport;
  const STAGE_SAID: Record<string, { headline: string; detail: string; icon: string }> = {
    en_route: { headline: 'Technician on the way', detail: 'Assigned and travelling to the property.', icon: 'car-outline' },
    on_site: { headline: 'Technician on site', detail: 'On the property and working on it now.', icon: 'construct-outline' },
    work_done: { headline: 'Work finished', detail: 'The technician is done. Record the final cost to close this ticket.', icon: 'checkmark-done-circle' },
    // Laundry's three. Its last stage resolves the ticket itself, so there is nothing for the
    // desk to do afterwards — which is why this half was never missed.
    picked_up: { headline: 'Laundry collected', detail: "Picked up and on its way to the provider.", icon: 'bag-handle-outline' },
    completed: { headline: 'Laundry washed', detail: 'Done at the provider and ready to come back.', icon: 'water-outline' },
    delivered: { headline: 'Laundry delivered', detail: 'Back with the resident. This ticket is closed.', icon: 'checkmark-done-circle' },
  };
  const said = STAGE_SAID[stage];
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
          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Row gap={10} align="center">
              <View style={[styles.badge, { backgroundColor: isComplaint ? `${Colors.danger}14` : `${Colors.success}14` }]}>
                <Ionicons
                  name={isComplaint ? 'alert-circle-outline' : 'star-outline'}
                  size={18}
                  color={isComplaint ? Colors.danger : Colors.success}
                />
              </View>
              <Col style={{ flex: 1 }}>
                <Txt size={15} weight="700" color={Colors.textPrimary}>{ticket.title}</Txt>
                <Txt size={12} color={Colors.textMuted} style={{ marginTop: 2 }}>
                  {ticket.guestName}{ticket.roomNo ? ` • Room ${ticket.roomNo}` : ''} • {ticket.status}
                </Txt>
              </Col>
            </Row>
            <Spacer size={10} />
            <Txt size={13} color={Colors.textSecondary} style={{ lineHeight: 19 }}>{ticket.description}</Txt>
          </Card>

          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Txt size={12} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
              {ticket.mediaUri ? 'ATTACHED EVIDENCE' : 'EVIDENCE'}
            </Txt>
            <Spacer size={10} />
            <KycDocumentsCard idPhotoUri={ticket.mediaUri} selfieUri={null} emptyHint="No photo was attached to this ticket." />
          </Card>

          {ticket.adminResponse ? (
            <Card containerColor={Colors.surfaceElevated} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
              <Txt size={12} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>YOUR RESPONSE</Txt>
              <Spacer size={6} />
              <Txt size={13} color={Colors.textPrimary}>{ticket.adminResponse}</Txt>
            </Card>
          ) : null}

          {said ? (
            <Card
              containerColor={workFinished ? `${Colors.success}0F` : Colors.surfaceElevated}
              borderRadius={Radii.card}
              borderWidth={1}
              borderColor={workFinished ? Colors.success : Colors.borderSubtle}
              padding={[16, 16]}
            >
              <Row gap={10} align="center">
                <Ionicons
                  name={said.icon as any}
                  size={20}
                  color={workFinished ? Colors.success : Colors.primary}
                />
                <Col style={{ flex: 1 }}>
                  <Txt size={14} weight="700" color={Colors.textPrimary}>{said.headline}</Txt>
                  <Txt size={12} color={Colors.textSecondary} style={{ marginTop: 2 }}>{said.detail}</Txt>
                </Col>
              </Row>
              {workFinished && stage === 'work_done' ? (
                <>
                  <Spacer size={10} />
                  <Txt size={12} color={Colors.textMuted}>
                    Until a final cost is recorded, the resident's invoice shows the visit fee only.
                  </Txt>
                </>
              ) : null}
            </Card>
          ) : null}

          {canBook && spec ? (
            <Btn
              onPress={() => router.push(`/book-technician/${ticket.id}`)}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={Radii.control}
              height={50}
            >
              <Ionicons name={spec.icon as any} size={18} color={Colors.textInverse} />
              <Txt size={14} weight="700" color={Colors.textInverse} style={{ marginLeft: 8 }}>{spec.label}</Txt>
            </Btn>
          ) : null}
        </View>
      )}
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  badge: { width: 36, height: 36, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center' },
});

export default TicketDetailForRoleScreen;
