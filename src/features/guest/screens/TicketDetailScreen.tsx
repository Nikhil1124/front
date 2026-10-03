/**
 * TicketDetailScreen — Resident drill-down for a maintenance/support ticket.
 *
 * Hub-and-Spoke:
 *   Reached from the Guest dashboard's "🛠️ Maintenance Support" tile when a
 *   resident taps an existing ticket in the tracker list.
 *
 *   Renders the four-stage status tracker the spec calls out:
 *     Submitted → Assigned → In Progress → Resolved
 *
 * Cyber Mint:
 *   - HubScreenWrapper for the sticky back header.
 *   - Status tracker is a horizontal stepper with colour-coded dots.
 *   - The complaint body, photo attachment, and admin response are each in
 *     their own surface card so the page reads like an inbox thread rather
 *     than a wall of text.
 */
import { useState } from 'react';
import { Image, View, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Radii, Colors } from '@/theme';
import { formatDateTime } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';
import { useCancelComplaintMutation, useRateRequestMutation } from '@/features/requests/useComplaints';
import type { FeedbackComplaintEntity } from '@/types';
import { AnimatedPress, Btn, Card, Col, OutlinedBtn, PGowDialog, Pill, Row, Spacer, Txt } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { useToast } from '@/hooks/useToast';

interface Props {
  ticket: FeedbackComplaintEntity;
  onRefresh?: () => void;
  refreshing?: boolean;
}

type Stage = 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED';

function stageFromStatus(status: string): Stage {
  const s = (status ?? '').toUpperCase();
  if (s.includes('RESOLV') || s.includes('CLOSE')) return 'RESOLVED';
  if (s.includes('PROGRESS') || s.includes('WORK')) return 'IN_PROGRESS';
  if (s.includes('ASSIGN')) return 'ASSIGNED';
  return 'SUBMITTED';
}

const STAGES: { key: Stage; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'SUBMITTED', label: 'Submitted', icon: 'paper-plane' },
  { key: 'ASSIGNED', label: 'Assigned', icon: 'person-add' },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: 'construct' },
  { key: 'RESOLVED', label: 'Resolved', icon: 'checkmark-circle' },
];

export function TicketDetailScreen({ ticket, onRefresh, refreshing }: Props) {
  const currentStage = stageFromStatus(ticket.status);
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);

  // Real — calls POST /v1/requests/{id}/cancel, which the backend allows for either staff
  // or the ticket's own raiser (cancel_request, pg-backend request/service/workflow.py).
  // There was no button anywhere that called it: a resident who filed something by mistake,
  // or whose problem resolved itself before anyone picked it up, had no way to withdraw it.
  // React Query, not the store action: see `useCancelComplaintMutation`. The store's
  // `refreshAll()` only invalidated, so the ticket kept reading "Submitted" with an active
  // Withdraw button until the refetch came back.
  const activePgId = useAuthStore((s) => s.activePgId);
  const cancelTicket = useCancelComplaintMutation(activePgId ?? undefined);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const toast = useToast();
  // Mirrors the server: RESOLVED and CANCELLED are both terminal (cancel_request:
  // "This ticket is already closed."), and REQUEST_STATUS collapses both into the single
  // UI label "Resolved" (mappers.ts) — so that's the one check needed here too.
  // A repair's real progress is its stage, not its status. REPAIR's stage machine has
  // `resolves_on=None` — the desk still has to price the work before the ticket closes — so
  // `status` stops at "In Progress" and stays there after the technician has finished.
  // Each machine's LAST stage, which is where the work is over: `work_done` for a repair,
  // `delivered` for laundry. A ticket carries one or the other, never both.
  const workFinished =
    ticket.serviceStage === 'work_done' || ticket.laundryStage === 'delivered';
  // Mirrors the server: RESOLVED and CANCELLED are both terminal (cancel_request:
  // "This ticket is already closed."), and REQUEST_STATUS collapses both into the single
  // UI label "Resolved" (mappers.ts) — so that's the one check needed here too.
  //
  // Finished work is excluded on top of that. `cancel_request` would happily accept it: only
  // RESOLVED and CANCELLED are terminal there, so a ticket sitting at `work_done` is still
  // cancellable server-side. Withdrawing it then voids a job the technician has already done
  // and the desk has not yet billed — so the button comes off once the work is in.
  const canCancel = ticket.status !== 'Resolved' && !workFinished;

  // POST /v1/requests/{id}/rate. The raiser's alone server-side, and open from the last
  // stage rather than from `resolved`, so a resident can rate the moment the technician
  // leaves instead of waiting on somebody's paperwork. Re-rating overwrites on purpose.
  const rate = useRateRequestMutation(activePgId ?? undefined);
  const rated = ticket.serviceRating > 0;
  const [stars, setStars] = useState(ticket.serviceRating || 0);
  const [note, setNote] = useState(ticket.serviceRatingComment ?? '');
  // Opens closed once a score is in: the card's job then is to show what they said, with
  // changing it a deliberate second step rather than a form sitting there inviting a re-tap.
  const [editingRating, setEditingRating] = useState(false);
  const ratingFormOpen = !rated || editingRating;

  const submitRating = async () => {
    if (stars < 1) return;
    try {
      await rate.mutateAsync({ id: ticket.id, rating: stars, comment: note });
      setEditingRating(false);
      toast('success', 'Thanks for rating', 'Your technician and your manager can see this.');
    } catch (err) {
      toast('error', 'Could not send', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleCancel = () => setConfirmingWithdraw(true);

  const confirmWithdraw = async () => {
    setConfirmingWithdraw(false);
    setCancelling(true);
    try {
      await cancelTicket.mutateAsync({ id: ticket.id });
      router.back();
    } catch (err) {
      toast('error', 'Could not withdraw', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <HubScreenWrapper
      title={ticket.title || 'Support Ticket'}
      subtitle={`Opened ${formatDateTime(ticket.timestamp)}`}
      icon="arrow-back"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {/* Status tracker — horizontal stepper */}
      <Card
        containerColor={Colors.surface}
        borderRadius={Radii.card}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[16, 14]}
      >
        <Txt variant="caption" weight="700" color={Colors.textPrimary} style={{ letterSpacing: 0.5 }}>
          STATUS TRACKER
        </Txt>
        <Spacer size={12} />
        <Row align="flex-start" gap={2}>
          {STAGES.map((stage, idx) => {
            const done = idx <= currentIdx;
            const active = idx === currentIdx;
            const tint = done ? Colors.primary : Colors.textMuted;
            return (
              <View key={stage.key} style={styles.stageWrap}>
                <View style={[styles.stageDot, {
                  backgroundColor: done ? Colors.primary : Colors.surfaceMuted,
                  borderColor: done ? Colors.primary : Colors.borderMuted,
                  transform: [{ scale: active ? 1.15 : 1 }],
                }]}>
                  <Ionicons name={stage.icon} size={14} color={done ? Colors.textInverse : Colors.textMuted} />
                </View>
                <Txt
                  size={9}
                  weight={active ? '800' : '700'}
                  color={tint}
                  align="center"
                  style={{ marginTop: 4, lineHeight: 12 }}
                  numberOfLines={2}
                >
                  {stage.label}
                </Txt>
                {idx < STAGES.length - 1 ? (
                  <View style={[styles.stageConnector, {
                    backgroundColor: idx < currentIdx ? Colors.primary : Colors.borderMuted,
                  }]} />
                ) : null}
              </View>
            );
          })}
        </Row>
      </Card>

      {workFinished ? (
        <>
          <Spacer size={14} />
          <Card
            containerColor={`${Colors.success}0F`}
            borderRadius={Radii.card}
            borderWidth={1}
            borderColor={Colors.success}
            padding={[16, 16]}
          >
            <Row gap={10} align="center">
              <Ionicons name="checkmark-done-circle" size={22} color={Colors.success} />
              <Col style={{ flex: 1 }}>
                <Txt variant="body" weight="700" color={Colors.textPrimary}>{ticket.laundryStage === 'delivered' ? 'Laundry delivered' : 'Work finished'}</Txt>
                <Txt variant="caption" color={Colors.textSecondary} style={{ lineHeight: 16, marginTop: 2 }}>
                  {ticket.paidAt
                    ? 'Settled and closed.'
                    : ticket.status === 'Resolved'
                      // Closed by the desk. Saying "working out the final cost" here would be
                      // describing a step that has already happened.
                      ? 'Closed.'
                      : ticket.laundryStage === 'delivered'
                        ? 'Your laundry is back with you.'
                        : 'The technician is done. Your property is working out the final cost — your bill still shows the visit fee until they do.'}
                </Txt>
              </Col>
            </Row>

            <Spacer size={14} />
            <View style={styles.ratingDivider} />
            <Spacer size={12} />

            <Txt variant="caption" weight="700" color={Colors.textPrimary}>
              {rated ? 'You rated this' : 'How did it go?'}
            </Txt>

            <Spacer size={8} />
            <Row gap={6} align="center">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= (ratingFormOpen ? stars : ticket.serviceRating);
                return (
                  <AnimatedPress
                    key={n}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
                    accessibilityState={{ selected: filled }}
                    disabled={!ratingFormOpen || rate.isPending}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    onPress={() => setStars(n)}
                  >
                    <Ionicons
                      name={filled ? 'star' : 'star-outline'}
                      size={28}
                      color={filled ? Colors.warning : Colors.borderMuted}
                    />
                  </AnimatedPress>
                );
              })}
              {!ratingFormOpen ? (
                <AnimatedPress
                  accessibilityRole="button"
                  accessibilityLabel="Change your rating"
                  style={{ marginLeft: 'auto' }}
                  onPress={() => setEditingRating(true)}
                >
                  <Txt variant="caption" weight="700" color={Colors.primary}>Change</Txt>
                </AnimatedPress>
              ) : null}
            </Row>

            {ratingFormOpen ? (
              <>
                <Spacer size={10} />
                <OutlinedTextField
                  placeholder="Anything worth passing on (optional)"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  maxLength={1000}
                />
                <Spacer size={10} />
                <Btn
                  onPress={submitRating}
                  loading={rate.isPending}
                  disabled={stars < 1}
                  containerColor={Colors.primary}
                  textColor={Colors.textInverse}
                  borderRadius={Radii.control}
                  height={46}
                >
                  <Txt variant="body" weight="700" color={Colors.textInverse}>
                    {rate.isPending ? 'Sending…' : rated ? 'Update rating' : 'Send rating'}
                  </Txt>
                </Btn>
              </>
            ) : ticket.serviceRatingComment ? (
              <>
                <Spacer size={8} />
                <Txt variant="caption" color={Colors.textSecondary} style={{ lineHeight: 17 }}>
                  “{ticket.serviceRatingComment}”
                </Txt>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      <Spacer size={14} />

      {/* Ticket body */}
      <Card
        containerColor={Colors.surface}
        borderRadius={Radii.card}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[16, 16]}
      >
        <Row justify="space-between" align="center">
          <Txt variant="body" weight="700" color={Colors.textPrimary}>Ticket Details</Txt>
          <Pill
            label={ticket.category || 'General'}
            color={Colors.primaryDark}
            bg={Colors.surfaceElevated}
          />
        </Row>
        <Spacer size={10} />
        <Txt variant="body" color={Colors.textSecondary} style={{ lineHeight: 19 }}>
          {ticket.description || 'No description provided.'}
        </Txt>
        <Spacer size={10} />
        <Row gap={16}>
          <Row gap={6} align="center">
            <Ionicons name="person" size={12} color={Colors.textMuted} />
            <Txt variant="caption" color={Colors.textMuted}>{ticket.guestName || 'You'}</Txt>
          </Row>
          <Row gap={6} align="center">
            <Ionicons name="time" size={12} color={Colors.textMuted} />
            <Txt variant="caption" color={Colors.textMuted}>{formatDateTime(ticket.timestamp)}</Txt>
          </Row>
        </Row>
      </Card>

      {/* Photo attachment — when present */}
      {ticket.mediaUri ? (
        <>
          <Spacer size={14} />
          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Row gap={8} align="center">
              <Ionicons name="attach" size={16} color={Colors.primary} />
              <Txt variant="body" weight="700" color={Colors.textPrimary}>Photo attachment</Txt>
            </Row>
            <Spacer size={8} />
            <Image source={{ uri: ticket.mediaUri }} style={styles.attachmentImage} resizeMode="cover" />
          </Card>
        </>
      ) : null}

      {/* Admin response — when present */}
      {ticket.adminResponse ? (
        <>
          <Spacer size={14} />
          <Card containerColor={Colors.surfaceElevated} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Row gap={8} align="center">
              <Ionicons name="chatbubble-ellipses" size={16} color={Colors.primary} />
              <Txt variant="body" weight="700" color={Colors.textPrimary}>Manager response</Txt>
            </Row>
            <Spacer size={8} />
            <Txt variant="caption" color={Colors.textSecondary} style={{ lineHeight: 17 }}>
              {ticket.adminResponse}
            </Txt>
          </Card>
        </>
      ) : null}

      {/* Help / what next */}
      <Spacer size={14} />
      <Card
        containerColor={Colors.surfaceMuted}
        borderRadius={Radii.card}
        borderWidth={1}
        borderColor={Colors.borderMuted}
        padding={[14, 14]}
      >
        <Row gap={10} align="flex-start">
          <Ionicons name="information-circle" size={18} color={Colors.info} />
          <Col style={{ flex: 1 }}>
            <Txt variant="caption" weight="700" color={Colors.textPrimary}>What happens next?</Txt>
            <Txt variant="caption" color={Colors.textMuted} style={{ lineHeight: 16, marginTop: 2 }}>
              Your ticket has been routed to the property manager. You will receive a notification when a staff member is assigned and again when the issue is resolved.
            </Txt>
          </Col>
        </Row>
      </Card>

      {canCancel ? (
        <>
          <Spacer size={14} />
          <OutlinedBtn onPress={handleCancel} disabled={cancelling} borderColor={Colors.danger} textColor={Colors.danger}>
            <Txt variant="body" weight="700" color={Colors.danger}>
              {cancelling ? 'Withdrawing…' : 'Withdraw Ticket'}
            </Txt>
          </OutlinedBtn>
        </>
      ) : null}

      <PGowDialog
        visible={confirmingWithdraw}
        title="Withdraw this ticket?"
        message="This closes it — your manager will no longer act on it. You can always file a new one if the issue comes back."
        confirmLabel="Withdraw"
        cancelLabel="Keep it open"
        tone="destructive"
        busy={cancelling}
        onConfirm={confirmWithdraw}
        onCancel={() => setConfirmingWithdraw(false)}
      />
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  stageWrap: {
    flex: 1, alignItems: 'center', position: 'relative',
  },
  stageDot: {
    width: 28, height: 28, borderRadius: Radii.pill,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  stageConnector: {
    position: 'absolute',
    top: 13, // centres on the 28px dot
    left: '50%',
    width: '100%', // stretches to the next dot
    height: 2,
    zIndex: 1,
  },
  ratingDivider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
  },
  attachmentImage: {
    width: '100%',
    height: 180,
    borderRadius: Radii.card,
    backgroundColor: Colors.surfaceMuted,
  },
});
