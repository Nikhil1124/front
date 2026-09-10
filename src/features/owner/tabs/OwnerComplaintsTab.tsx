/**
 * OwnerComplaintsTab — split out of OwnerReviewsTab, which used to bury actionable guest
 * issues inside a "Guest Issues" section of the ratings-focused Reviews screen. Complaints
 * need a resolve/respond/escalate action a resident is waiting on; reviews are read-only
 * sentiment. Same underlying query (`useComplaintsQuery`), two different jobs.
 */
import { useState, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, FlatList, BackHandler } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import type { FeedbackComplaintEntity } from '@/types';
import { KycDocumentsCard } from '@/components/KycDocumentsCard';
import { useComplaintsQuery, useComplaintQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';
import { isRequestOpen } from '@/data/mappers';
import { formatTimeAgo } from '@/utils/format';
import { Colors, Palette, Radii } from '@/theme';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { useResponsivePadding } from '@/utils/responsive';
import { AnimatedPress, Col, ErrorState, ListRow, LoadingState, OutlinedTextField, Row, Sheet, Spacer, StatusChip, Txt, toneFor } from '@/components/ui';

const GREEN = '#176B3A';
const BG = '#F7FAF7';
const CHARCOAL = '#17201A';
const MUTED = '#66736B';
const BORDER = '#DDE8E0';
const WHITE = Colors.surface;
const LIGHT_GREEN = Palette.TintGreen;

export function OwnerComplaintsTab() {
  const dockScroll = useDockScroll();
  const responsivePadding = useResponsivePadding();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: submissions = [], isLoading, error, refetch } = useComplaintsQuery(activePgId ?? undefined);
  const respond = usePGowStore((s) => s.respondToFeedbackComplaint);
  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const [activeItem, setActiveItem] = useState<FeedbackComplaintEntity | null>(null);
  const [responseText, setResponseText] = useState('');
  const [replyError, setReplyError] = useState<string | undefined>();
  const [responseStatus, setResponseStatus] = useState('In Progress');

  const openIssues = submissions.filter((s) => s.type === 'COMPLAINT' && isRequestOpen(s.status));
  const closedIssues = submissions.filter((s) => s.type === 'COMPLAINT' && !isRequestOpen(s.status));

  const openReply = (item: FeedbackComplaintEntity) => {
    setActiveItem(item);
    setResponseText(item.adminResponse ?? '');
    setResponseStatus(item.status);
  };

  // Back-press override: replace ghost tab state with overview
  useEffect(() => {
    const onBack = () => { router.replace('/overview'); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  const handleSaveReply = async () => {
    if (!activeItem) return;
    if (!responseText.trim()) {
      setReplyError('Write a reply before saving');
      return;
    }
    try {
      await respond(activeItem.id, responseText, responseStatus);
      toast('success', 'Issue response saved', `Resident ${activeItem.guestName} notified.`);
      setActiveItem(null);
    } catch {
      toast('error', 'Failed to save response', 'Try again.');
    }
  };

  // `closedIssues` is the archive and only grows — the query fetches up to 200 and this used
  // to `.map()` all of them into a plain ScrollView, mounting every card at once. It is the
  // FlatList's data now so only the visible rows exist. `openIssues` stays in the header: a
  // property has a handful open at a time, and keeping it there avoids a SectionList for
  // what is really one growing list with a preamble.
  const listHeader = (
    <>
      <Row justify="space-between" align="center">
        <Col>
          <Txt maxFontSizeMultiplier={1.3} style={styles.bodyTitle}>Complaints</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.bodySub}>Resident-raised issues awaiting action</Txt>
        </Col>
        {openIssues.length > 0 ? (
          <View style={styles.issuesBadge}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.issuesBadgeText}>{openIssues.length} open</Txt>
          </View>
        ) : null}
      </Row>

      <Spacer size={16} />

      {isLoading ? (
        <LoadingState label="Loading complaints…" fill={false} />
      ) : error ? (
        <ErrorState error={error} title="Could not load complaints" onRetry={refetch} fill={false} />
      ) : openIssues.length === 0 ? (
        <View style={styles.noIssuesRow}>
          <Ionicons name="checkmark-circle" size={18} color={GREEN} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.noIssuesText}>No open complaints</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.noIssuesSub}>Everything looks good right now.</Txt>
        </View>
      ) : (
        <View>
          {openIssues.map((item, i) => (
            <ListRow
              key={item.id}
              title={item.title || 'Guest Request'}
              meta={`Room ${item.roomNo || 'N/A'} · ${new Date(item.timestamp).toLocaleDateString('en-IN')}`}
              leading={<Ionicons name="alert-circle-outline" size={18} color={item.overallRating <= 2 ? Colors.danger : Colors.primary} />}
              status={{ label: item.status, tone: toneFor(item.status) }}
              onPress={() => openReply(item)}
              first={i === 0}
              last={i === openIssues.length - 1}
            />
          ))}
        </View>
      )}

      {closedIssues.length > 0 ? (
        <>
          <Spacer size={24} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.sectionHeader}>Resolved</Txt>
          <Spacer size={8} />
        </>
      ) : null}
    </>
  );

  return (
    <>
      <FlatList
        {...dockScroll}
        data={closedIssues}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: responsivePadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />}
        renderItem={({ item, index }) => (
          <ListRow
            title={item.title || 'Guest Request'}
            meta={`Room ${item.roomNo || 'N/A'} · ${new Date(item.timestamp).toLocaleDateString('en-IN')}`}
            leading={<Ionicons name="checkmark" size={17} color={Colors.success} />}
            status={{ label: item.status, tone: toneFor(item.status) }}
            onPress={() => openReply(item)}
            first={index === 0}
            last={index === closedIssues.length - 1}
          />
        )}
      />

      {/* ── Guest Issue Response Modal ── */}
      {activeItem && (
        <Sheet
          visible
          title="Review response"
          subtitle={`${activeItem.guestName} · Room ${activeItem.roomNo}`}
          icon="construct-outline"
          // One shape for every complaint, however long its description — see `Sheet`'s
          // `size` prop. Kushal's fix for OWN-01/OWN-05.
          size="3/4"
          onDismiss={() => setActiveItem(null)}
          footer={
            <Row gap={10}>
              <AnimatedPress accessibilityRole="button" style={styles.dialogSaveBtn} onPress={handleSaveReply}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.dialogSaveBtnText}>Save response</Txt>
              </AnimatedPress>
              <AnimatedPress accessibilityRole="button" style={styles.dialogCancelBtn} onPress={() => setActiveItem(null)}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.dialogCancelBtnText}>Cancel</Txt>
              </AnimatedPress>
            </Row>
          }
        >

                {/* What the complaint actually says.
                    This sheet opened straight onto the evidence photo and then the reply box
                    — so the one thing an owner needs in order to write that reply, the
                    resident's own description of the problem, was the one thing missing.
                    Every field here was already on the row that opened this sheet; none of
                    it needed fetching. Title, category and when it was raised come with it,
                    because "Tap dripping" and "Tap dripping, reported 9 days ago" are
                    different situations. */}
                <Col gap={6}>
                  <Row justify="space-between" align="center" gap={8}>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.detailTitle} numberOfLines={2}>
                      {activeItem.title}
                    </Txt>
                    <StatusChip label={activeItem.status} tone={toneFor(activeItem.status)} />
                  </Row>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.detailMeta}>
                    {[
                      activeItem.type === 'COMPLAINT' ? 'Complaint' : 'Feedback',
                      activeItem.category,
                      formatTimeAgo(activeItem.timestamp),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Txt>
                  {activeItem.description?.trim() ? (
                    <Txt maxFontSizeMultiplier={1.3} style={styles.detailBody}>
                      {activeItem.description}
                    </Txt>
                  ) : (
                    <Txt maxFontSizeMultiplier={1.3} style={styles.detailBodyMuted}>
                      The resident did not add a description.
                    </Txt>
                  )}
                  {activeItem.adminResponse?.trim() ? (
                    <Txt maxFontSizeMultiplier={1.3} style={styles.detailMeta}>
                      Previous reply: {activeItem.adminResponse}
                    </Txt>
                  ) : null}
                </Col>

                <Spacer size={12} />

                {/* The list row this modal opens from never carries an attachment — the list
                    endpoint's response shape omits attachments entirely; only the per-ticket
                    detail endpoint hydrates them. So the photo is fetched here, once, only
                    when a ticket is actually open. */}
                <ActiveItemEvidence id={activeItem.id} pgId={activePgId} />

                {activeItem.type === 'COMPLAINT' && activeItem.status !== 'Resolved' && (
                  <>
                    <Spacer size={12} />
                    <AnimatedPress accessibilityRole="button"
                      style={styles.bookTechBtn}
                      onPress={() => { setActiveItem(null); router.push(`/book-technician/${activeItem.id}`); }}
                    >
                      <Ionicons name="build-outline" size={16} color={GREEN} />
                      <Txt maxFontSizeMultiplier={1.3} style={styles.bookTechBtnText}>Book a technician for this issue</Txt>
                    </AnimatedPress>
                  </>
                )}

                <Spacer size={16} />

                <OutlinedTextField
                  label="Your reply"
                  placeholder="Write resolution notes or replies"
                  value={responseText}
                  onChangeText={(v) => { setResponseText(v); if (replyError) setReplyError(undefined); }}
                  multiline
                  numberOfLines={4}
                  error={replyError}
                  helper="The resident is notified and sees this on their ticket"
                />

                <Spacer size={14} />

                <Txt maxFontSizeMultiplier={1.3} style={styles.inputLabelStyle}>Set Status:</Txt>
                <Row gap={6} style={{ marginTop: 4 }}>
                  {['Open', 'In Progress', 'Resolved'].map((st) => (
                    <AnimatedPress accessibilityRole="button"
                      key={st}
                      style={[styles.smallChip, responseStatus === st && styles.smallChipActive]}
                      onPress={() => setResponseStatus(st)}
                    >
                      <Txt maxFontSizeMultiplier={1.3} style={[styles.smallChipText, responseStatus === st && styles.smallChipTextActive]}>{st}</Txt>
                    </AnimatedPress>
                  ))}
                </Row>

        </Sheet>
      )}

    </>
  );
}

/** The one image fetch this screen makes, scoped to whichever ticket is actually open. */
function ActiveItemEvidence({ id, pgId }: { id: string; pgId: string | null }) {
  const { data: full, isLoading } = useComplaintQuery(id, pgId ?? undefined);
  if (isLoading) {
    return (
      <>
        <Spacer size={10} />
        <Txt maxFontSizeMultiplier={1.3} style={{ fontSize: 11, color: MUTED }}>Loading attachment…</Txt>
      </>
    );
  }
  if (!full?.mediaUri) return null;
  return (
    <>
      <Spacer size={12} />
      <Txt maxFontSizeMultiplier={1.3} style={{ fontSize: 11, fontWeight: '700', color: MUTED, letterSpacing: 0.4 }}>ATTACHED EVIDENCE</Txt>
      <Spacer size={6} />
      <KycDocumentsCard idPhotoUri={full.mediaUri} selfieUri={null} />
    </>
  );
}

const styles = StyleSheet.create({
  detailTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: CHARCOAL },
  detailMeta: { fontSize: 11, color: MUTED },
  detailBody: { fontSize: 13, color: CHARCOAL, lineHeight: 19 },
  detailBodyMuted: { fontSize: 13, color: MUTED, fontStyle: 'italic' },
  // Side padding comes from `useResponsivePadding` (16 / 20 / 24 by screen width), same as
  // the overview — this was a fixed 20 while every guest tab used a fixed 16, so the content
  // edge visibly jumped when moving between an owner tab and a resident one, and neither
  // adapted to a narrow or a large phone.
  scrollContent: { paddingTop: 16, paddingBottom: 110, backgroundColor: BG },
  bodyTitle: { fontSize: 18, fontWeight: '700', color: CHARCOAL },
  bodySub: { fontSize: 13, color: MUTED, marginTop: 2 },

  sectionHeader: { fontSize: 15, fontWeight: '700', color: CHARCOAL },
  issuesBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.control,
    backgroundColor: Palette.TintRed,
    borderWidth: 1,
    borderColor: '#FECACA' },
  issuesBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.danger },

  noIssuesRow: {
    height: 52,
    backgroundColor: LIGHT_GREEN,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16 },
  noIssuesText: { fontSize: 12, fontWeight: '700', color: GREEN, marginLeft: 8 },
  noIssuesSub: { fontSize: 11, color: MUTED, marginLeft: 6 },



  inputLabelStyle: { fontSize: 11, fontWeight: '700', color: MUTED },
  smallChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER },
  smallChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN },
  smallChipText: { fontSize: 11, color: CHARCOAL, fontWeight: '600' },
  smallChipTextActive: { color: WHITE, fontWeight: '700' },

  dialogSaveBtn: {
    flex: 1,
    height: 44,
    backgroundColor: GREEN,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center' },
  dialogSaveBtnText: { fontSize: 13, fontWeight: '700', color: WHITE },
  dialogCancelBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE },
  dialogCancelBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  bookTechBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: GREEN, borderRadius: Radii.card, paddingVertical: 12,
    backgroundColor: `${GREEN}0D` },
  bookTechBtnText: { fontSize: 13, fontWeight: '700', color: GREEN } });
