/**
 * "Book a technician" — the owner/manager end of a complaint that needs an outside trade.
 *
 * Reached from the complaint itself or from the push that announced it. Posts to
 * `POST /v1/requests/{id}/escalate`, which hands the ticket to the area manager covering this
 * property. Owner and manager both qualify: the server's bar is `principal.manages(pg_id)`.
 *
 * The note is the whole brief. Ops see this ticket through `GET /v1/requests/escalated` and
 * cannot see its photos, so the draft is pre-filled from the complaint's category, room,
 * title and the resident's own words — editable, because the person booking usually knows
 * something the form does not.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { KycDocumentsCard } from '@/components/KycDocumentsCard';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { useComplaintQuery, useEscalateComplaintMutation } from '@/features/requests/useComplaints';
import { tradeForComplaint, draftNoteFor } from '@/features/requests/technicianTrades';
import { useAuthStore } from '@/store/authStore';
import { PGowApiError } from '@/data/apiClient';
import { Radii, Colors } from '@/theme';
import { Btn, Card, Col, ErrorState, LoadingState, Row, Spacer, Txt } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { FormScroll } from '@/components/ui/FormScroll';

export function BookTechnicianScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: ticket, isLoading, error, refetch } = useComplaintQuery(id, activePgId ?? undefined);
  const escalate = useEscalateComplaintMutation(activePgId ?? undefined);

  const spec = useMemo(
    () => tradeForComplaint(ticket?.category, ticket?.title),
    [ticket?.category, ticket?.title]
  );

  const [note, setNote] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | undefined>();
  const toast = useToast();
  // Draft on first render that has a ticket, then leave whatever the user typed alone.
  const value = note ?? (ticket ? draftNoteFor(spec, ticket) : '');

  const alreadyBooked = ticket?.status === 'Resolved';

  const submit = async () => {
    if (!id) return;
    if (!value.trim()) {
      setNoteError('Describe the job so the area manager can dispatch the right person');
      return;
    }
    try {
      await escalate.mutateAsync({ id, note: value });
      toast(
        'success',
        'Sent to PGow support',
        'The area manager has the ticket and will arrange a technician. The resident has been told.'
      );
      router.back();
    } catch (err) {
      // The server has three distinct refusals here and they mean different things to the
      // person pressing the button — a generic "could not book" would send them round again.
      const message =
        err instanceof PGowApiError
          ? err.code === 'AREA_NOT_SERVICED'
            ? 'No PGow support team covers this property yet. Assign it to your own staff, or contact PGow to get an area manager allocated.'
            : err.message
          : 'Could not send this to PGow support. Check your connection and try again.';
      toast('error', 'Not booked', message);
    }
  };

  return (
    <HubScreenWrapper title="Book a technician">
      {isLoading ? (
        <LoadingState label="Loading the ticket…" />
      ) : error || !ticket ? (
        <ErrorState error={error} title="Could not load this ticket" onRetry={refetch} />
      ) : (
        <FormScroll contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* What is being booked, and for whom */}
          <Card
            containerColor={Colors.surface}
            borderRadius={Radii.card}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[16, 16]}
          >
            <Row gap={10} align="center">
              <View style={styles.tradeBubble}>
                <Ionicons name={spec.icon as any} size={20} color={Colors.primary} />
              </View>
              <Col style={{ flex: 1 }}>
                <Txt size={15} weight="700" color={Colors.textPrimary}>{ticket.title}</Txt>
                <Txt size={12} color={Colors.textMuted} style={{ marginTop: 2 }}>
                  {ticket.roomNo ? `Room ${ticket.roomNo}` : 'Room not recorded'}
                  {ticket.guestName ? ` • ${ticket.guestName}` : ''}
                  {ticket.category ? ` • ${ticket.category}` : ''}
                </Txt>
              </Col>
            </Row>
            {ticket.description ? (
              <>
                <Spacer size={10} />
                <Txt size={12} color={Colors.textSecondary} style={{ lineHeight: 18 }}>
                  {ticket.description}
                </Txt>
              </>
            ) : null}
          </Card>

          {/* The resident's evidence. Only reachable here because this screen reads the
              DETAIL endpoint — the list rows carry no attachments at all. */}
          {ticket.mediaUri ? (
            <Card
              containerColor={Colors.surface}
              borderRadius={Radii.card}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[16, 16]}
            >
              <Txt size={12} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
                RESIDENT'S PHOTO
              </Txt>
              <Spacer size={10} />
              <KycDocumentsCard idPhotoUri={ticket.mediaUri} selfieUri={null} />
            </Card>
          ) : null}

          {/* The brief */}
          <Card
            containerColor={Colors.surface}
            borderRadius={Radii.card}
            borderWidth={1}
            borderColor={Colors.borderSubtle}
            padding={[16, 16]}
          >
            <Txt size={13} weight="700" color={Colors.textPrimary}>Brief for the area manager</Txt>
            <Txt size={11} color={Colors.textMuted} style={{ marginTop: 2, lineHeight: 16 }}>
              They cannot see this ticket's photos — what you write here is what they dispatch from.
            </Txt>
            <Spacer size={12} />
            <OutlinedTextField
              label="Job description"
              value={value}
              onChangeText={(v) => { setNote(v); if (noteError) setNoteError(undefined); }}
              error={noteError}
              multiline
              numberOfLines={7}
              testID="book_technician_note"
            />
          </Card>

          <Btn
            onPress={submit}
            disabled={escalate.isPending || alreadyBooked}
            loading={escalate.isPending}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={Radii.control}
            height={50}
            testID="book_technician_submit"
          >
            <Ionicons name={spec.icon as any} size={18} color={Colors.textInverse} />
            <Txt size={14} weight="700" color={Colors.textInverse} style={{ marginLeft: 8 }}>
              {escalate.isPending ? 'Sending…' : spec.label}
            </Txt>
          </Btn>
          <Txt size={11} color={Colors.textMuted} style={{ textAlign: 'center' }}>
            This hands the ticket to PGow support for your area. Your own staff will be unassigned from it.
          </Txt>
        </FormScroll>
      )}
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  tradeBubble: {
    width: 40, height: 40, borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default BookTechnicianScreen;
