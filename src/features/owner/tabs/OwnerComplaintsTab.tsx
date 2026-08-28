/**
 * OwnerComplaintsTab — split out of OwnerReviewsTab, which used to bury actionable guest
 * issues inside a "Guest Issues" section of the ratings-focused Reviews screen. Complaints
 * need a resolve/respond/escalate action a resident is waiting on; reviews are read-only
 * sentiment. Same underlying query (`useComplaintsQuery`), two different jobs.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, Modal, Pressable, RefreshControl, ScrollView, TextInput, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Card, Row, Col, Spacer, LoadingState, ErrorState } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { FeedbackComplaintEntity } from '@/types';
import { KycDocumentsCard } from '@/components/KycDocumentsCard';
import { useComplaintsQuery, useComplaintQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';
import { isRequestOpen } from '@/data/mappers';

const GREEN = '#176B3A';
const BG = '#F7FAF7';
const CHARCOAL = '#17201A';
const MUTED = '#66736B';
const BORDER = '#DDE8E0';
const WHITE = '#FFFFFF';
const LIGHT_GREEN = '#EEF8F1';
const RADIUS = 16;

export function OwnerComplaintsTab() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: submissions = [], isLoading, error, refetch } = useComplaintsQuery(activePgId ?? undefined);
  const respond = usePGowStore((s) => s.respondToFeedbackComplaint);
  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const [activeItem, setActiveItem] = useState<FeedbackComplaintEntity | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState('In Progress');

  const openIssues = submissions.filter((s) => s.type === 'COMPLAINT' && isRequestOpen(s.status));
  const closedIssues = submissions.filter((s) => s.type === 'COMPLAINT' && !isRequestOpen(s.status));

  const openReply = (item: FeedbackComplaintEntity) => {
    hapticSelect();
    setActiveItem(item);
    setResponseText(item.adminResponse ?? '');
    setResponseStatus(item.status);
  };

  const handleSaveReply = async () => {
    if (!activeItem) return;
    if (!responseText.trim()) {
      hapticError();
      Alert.alert('Validation', 'Please enter a reply.');
      return;
    }
    try {
      await respond(activeItem.id, responseText, responseStatus);
      hapticSuccess();
      toast('success', 'Issue response saved', `Resident ${activeItem.guestName} notified.`);
      setActiveItem(null);
    } catch {
      hapticError();
      toast('error', 'Failed to save response', 'Try again.');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />}
    >
      <Row justify="space-between" align="center">
        <Col>
          <Text style={styles.bodyTitle}>Complaints</Text>
          <Text style={styles.bodySub}>Resident-raised issues awaiting action</Text>
        </Col>
        {openIssues.length > 0 ? (
          <View style={styles.issuesBadge}>
            <Text style={styles.issuesBadgeText}>{openIssues.length} open</Text>
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
          <Text style={styles.noIssuesText}>No open complaints</Text>
          <Text style={styles.noIssuesSub}>Everything looks good right now.</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {openIssues.map((item) => (
            <Card key={item.id} containerColor={WHITE} borderRadius={RADIUS} borderWidth={1} borderColor={BORDER} padding={[12, 14]}>
              <Row justify="space-between" align="flex-start">
                <Col style={{ flex: 1 }}>
                  <Row gap={6} align="center">
                    {item.overallRating <= 2 && <View style={styles.urgentDot} />}
                    <Text style={styles.issueTitleText}>{item.title || 'Guest Request'}</Text>
                  </Row>
                  <Text style={styles.issueMetaText}>
                    Room {item.roomNo || 'N/A'} · {new Date(item.timestamp).toLocaleDateString('en-IN')}
                  </Text>
                </Col>
                <View style={styles.issueStatusBadge}>
                  <Text style={styles.issueStatusText}>{item.status}</Text>
                </View>
              </Row>
              <Text style={styles.issueDescText} numberOfLines={2}>"{item.description}"</Text>
              <Spacer size={8} />
              <TouchableOpacity style={styles.viewIssueActionBtn} onPress={() => openReply(item)} activeOpacity={0.75}>
                <Text style={styles.viewIssueActionText}>View Issue →</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      )}

      {closedIssues.length > 0 ? (
        <>
          <Spacer size={24} />
          <Text style={styles.sectionHeader}>Resolved</Text>
          <Spacer size={8} />
          <View style={{ gap: 8 }}>
            {closedIssues.map((item) => (
              <Card key={item.id} containerColor={WHITE} borderRadius={RADIUS} borderWidth={1} borderColor={BORDER} padding={[12, 14]}>
                <Row justify="space-between" align="flex-start">
                  <Col style={{ flex: 1 }}>
                    <Text style={styles.issueTitleText}>{item.title || 'Guest Request'}</Text>
                    <Text style={styles.issueMetaText}>
                      Room {item.roomNo || 'N/A'} · {new Date(item.timestamp).toLocaleDateString('en-IN')}
                    </Text>
                  </Col>
                  <View style={styles.issueStatusBadge}>
                    <Text style={styles.issueStatusText}>{item.status}</Text>
                  </View>
                </Row>
                <Text style={styles.issueDescText} numberOfLines={2}>"{item.description}"</Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {/* ── Guest Issue Response Modal ── */}
      {activeItem && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setActiveItem(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveItem(null)} />
            <Card containerColor={WHITE} borderRadius={20} borderWidth={1} borderColor={BORDER} padding={[20, 20]} style={{ width: '90%' }}>
              <Text style={styles.dialogTitle}>Review Response & Action</Text>
              <Text style={styles.dialogSub}>
                Resident: {activeItem.guestName} (Room {activeItem.roomNo})
              </Text>

              {/* The list row this modal opens from never carries an attachment — the list
                  endpoint's response shape omits attachments entirely; only the per-ticket
                  detail endpoint hydrates them. So the photo is fetched here, once, only
                  when a ticket is actually open. */}
              <ActiveItemEvidence id={activeItem.id} pgId={activePgId} />

              {activeItem.type === 'COMPLAINT' && activeItem.status !== 'Resolved' && (
                <>
                  <Spacer size={12} />
                  <TouchableOpacity
                    style={styles.bookTechBtn}
                    onPress={() => { setActiveItem(null); router.push(`/book-technician/${activeItem.id}`); }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="build-outline" size={16} color={GREEN} />
                    <Text style={styles.bookTechBtnText}>Book a technician for this issue</Text>
                  </TouchableOpacity>
                </>
              )}

              <Spacer size={16} />

              <TextInput
                style={styles.dialogInput}
                placeholder="Write resolution notes or replies..."
                placeholderTextColor={MUTED}
                value={responseText}
                onChangeText={setResponseText}
                multiline
                numberOfLines={4}
              />

              <Spacer size={14} />

              <Text style={styles.inputLabelStyle}>Set Status:</Text>
              <Row gap={6} style={{ marginTop: 4 }}>
                {['Open', 'In Progress', 'Resolved'].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.smallChip, responseStatus === st && styles.smallChipActive]}
                    onPress={() => setResponseStatus(st)}
                  >
                    <Text style={[styles.smallChipText, responseStatus === st && styles.smallChipTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </Row>

              <Spacer size={20} />

              <Row gap={10}>
                <TouchableOpacity style={styles.dialogSaveBtn} onPress={handleSaveReply} activeOpacity={0.8}>
                  <Text style={styles.dialogSaveBtnText}>Save Response</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setActiveItem(null)} activeOpacity={0.8}>
                  <Text style={styles.dialogCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </Row>
            </Card>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

/** The one image fetch this screen makes, scoped to whichever ticket is actually open. */
function ActiveItemEvidence({ id, pgId }: { id: string; pgId: string | null }) {
  const { data: full, isLoading } = useComplaintQuery(id, pgId ?? undefined);
  if (isLoading) {
    return (
      <>
        <Spacer size={10} />
        <Text style={{ fontSize: 11, color: MUTED }}>Loading attachment…</Text>
      </>
    );
  }
  if (!full?.mediaUri) return null;
  return (
    <>
      <Spacer size={12} />
      <Text style={{ fontSize: 11, fontWeight: '800', color: MUTED, letterSpacing: 0.4 }}>ATTACHED EVIDENCE</Text>
      <Spacer size={6} />
      <KycDocumentsCard idPhotoUri={full.mediaUri} selfieUri={null} />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, backgroundColor: BG },
  bodyTitle: { fontSize: 18, fontWeight: '700', color: CHARCOAL },
  bodySub: { fontSize: 13, color: MUTED, marginTop: 2 },

  sectionHeader: { fontSize: 15, fontWeight: '700', color: CHARCOAL },
  issuesBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  issuesBadgeText: { fontSize: 10, fontWeight: '700', color: '#B91C1C' },

  noIssuesRow: {
    height: 52,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  noIssuesText: { fontSize: 12, fontWeight: '700', color: GREEN, marginLeft: 8 },
  noIssuesSub: { fontSize: 11, color: MUTED, marginLeft: 6 },

  urgentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginRight: 4 },
  issueTitleText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  issueMetaText: { fontSize: 10, color: MUTED, marginTop: 2 },
  issueStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: BG,
  },
  issueStatusText: { fontSize: 9, fontWeight: '700', color: MUTED },
  issueDescText: { fontSize: 12, color: CHARCOAL, marginTop: 6, fontStyle: 'italic' },
  viewIssueActionBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  viewIssueActionText: { fontSize: 12, fontWeight: '700', color: GREEN },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  dialogTitle: { fontSize: 16, fontWeight: '800', color: CHARCOAL },
  dialogSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  dialogInput: {
    height: 90,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: CHARCOAL,
    textAlignVertical: 'top',
  },
  inputLabelStyle: { fontSize: 11, fontWeight: '700', color: MUTED },
  smallChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  smallChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  smallChipText: { fontSize: 11, color: CHARCOAL, fontWeight: '600' },
  smallChipTextActive: { color: WHITE, fontWeight: '700' },

  dialogSaveBtn: {
    flex: 1,
    height: 44,
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSaveBtnText: { fontSize: 13, fontWeight: '800', color: WHITE },
  dialogCancelBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  dialogCancelBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  bookTechBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: GREEN, borderRadius: 12, paddingVertical: 12,
    backgroundColor: `${GREEN}0D`,
  },
  bookTechBtnText: { fontSize: 13, fontWeight: '800', color: GREEN },
});
