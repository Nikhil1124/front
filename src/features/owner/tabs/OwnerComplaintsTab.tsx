/**
 * OwnerComplaintsTab — port of Kotlin `OwnerComplaintsTab`.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, Modal, RefreshControl, FlatList } from 'react-native';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn, Chip } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { EmptyState } from '@/components/EmptyState';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';
import type { FeedbackComplaintEntity } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';

export function OwnerComplaintsTab() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: submissions = [] } = useComplaintsQuery(activePgId ?? undefined);
  const respond = usePGowStore((s) => s.respondToFeedbackComplaint);
  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const [active, setActive] = useState<FeedbackComplaintEntity | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState('In Progress');

  const totalReviews = submissions.length;
  const openCount = submissions.filter((s) => s.status === 'Open').length;
  const resolvedCount = submissions.filter((s) => s.status === 'Resolved').length;

  const avg = (key: keyof FeedbackComplaintEntity) => {
    if (submissions.length === 0) return 0;
    const vals = submissions.map((s) => Number(s[key]) || 0);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const avgOverall = avg('overallRating');
  const avgMeals = avg('mealRating');
  const avgClean = avg('cleanlinessRating');
  const avgMgr = avg('managerRating');
  const avgStaff = avg('staffRating');
  const avgOther = avg('otherRating');

  const openResponse = (item: FeedbackComplaintEntity) => {
    hapticSelect();
    setActive(item);
    setResponseText(item.adminResponse ?? '');
    setResponseStatus(item.status);
  };

  const handleSave = async () => {
    if (!active) return;
    if (!responseText.trim()) {
      hapticError();
      Alert.alert('Validation', 'Please write a response reply');
      return;
    }
    try {
      await respond(active.id, responseText, responseStatus);
      hapticSuccess();
      toast('success', 'Workflow updated', `${active.guestName} has been notified of your response.`);
      setActive(null);
    } catch (err: any) {
      hapticError();
      toast('error', 'Could not save response', err?.message ?? 'Please try again.');
    }
  };

  return (
    <>
      {/* Submissions can run to ~200 (refreshAll fetches up to 200) — FlatList instead of
          `.map()` in a ScrollView so only the visible rows mount. */}
      <FlatList
        style={{ flex: 1 }}
        data={submissions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.CyberGreen} colors={[Colors.CyberGreen]} />}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Txt variant="screenTitle" weight="900" color={Colors.CyberGreen} style={{ letterSpacing: -0.3 }}>Grievance Management System</Txt>

            <Row gap={8}>
              <View style={styles.metricBox}>
                <Txt variant="labelSmall" color={Colors.SlateMutedText}>TOTAL REVIEWS</Txt>
                <Txt variant="statValue" weight="900" color={Colors.IvoryWhiteText}>{totalReviews}</Txt>
              </View>
              <View style={styles.metricBox}>
                <Txt variant="labelSmall" color={Colors.SlateMutedText}>OPEN/PENDING</Txt>
                <Txt variant="statValue" weight="900" color="#EF4444">{openCount}</Txt>
              </View>
              <View style={styles.metricBox}>
                <Txt variant="labelSmall" color={Colors.SlateMutedText}>RESOLVED</Txt>
                <Txt variant="statValue" weight="900" color="#10B981">{resolvedCount}</Txt>
              </View>
            </Row>

            <Card containerColor="#111723" borderRadius={18} borderWidth={1} borderColor="#283244" padding={[16, 16]}>
              <Row justify="space-between" align="center">
                <Col>
                  <Txt variant="labelSmall" weight="900" color={Colors.CyberGreen} style={{ letterSpacing: 1 }}>PG SERVICE QUALITY SCORECARD</Txt>
                  <Txt variant="caption" color={Colors.SlateMutedText}>Calculated PG Ratings & Category Metrics</Txt>
                </Col>
                <View style={styles.starBox}>
                  <Txt size={16}>★</Txt>
                  <Txt variant="sectionTitle" weight="900" color="#FFB800">{totalReviews === 0 ? '—' : avgOverall.toFixed(1)}</Txt>
                  <Txt variant="labelSmall" weight="400" color={Colors.SlateMutedText}> / 5.0</Txt>
                </View>
              </Row>
              <Spacer size={14} />
              {totalReviews === 0 ? (
                <Txt variant="caption" color={Colors.SlateMutedText} style={{ paddingVertical: 8 }}>
                  No ratings yet — scores will appear once residents submit feedback.
                </Txt>
              ) : (
                [
                  ['Daily Meals (Mess)', '🍛', avgMeals],
                  ['Cleanliness & Service', '🧹', avgClean],
                  ['Manager Response', '💼', avgMgr],
                  ['Staff Behaviour', '👨‍🍳', avgStaff],
                  ['Others & Facilities', '⚙️', avgOther],
                ].map(([label, icon, score]) => {
                  const s = Number(score);
                  const color = s >= 4.5 ? Colors.CyberGreen : s >= 3.5 ? Colors.CyberAmber : Colors.CyberPink;
                  return (
                    <View key={label as string} style={{ marginVertical: 4 }}>
                      <Row justify="space-between" align="center">
                        <Row gap={6}><Txt variant="caption">{icon as string}</Txt><Txt size={11} weight="500" color={Colors.IvoryWhiteText}>{label as string}</Txt></Row>
                        <Txt variant="caption" weight="700" color="#FFB800">{s.toFixed(1)} ★</Txt>
                      </Row>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${(s / 5) * 100}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                  );
                })
              )}
            </Card>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="No guest feedback or complaints yet"
            subtitle="Resident feedback, complaints, and star ratings will appear here once submitted. Pull down to refresh."
            accent={Colors.CyberAmber}
          />
        }
        renderItem={({ item }) => (
          <AnimatedPress
            scale={0.985}
            hapticPattern="light"
            onPress={() => openResponse(item)}
          >
            <Card containerColor="#111218" borderRadius={14} borderWidth={1} borderColor="#22242D" padding={[16, 16]}>
              <Row justify="space-between" align="center">
                <Txt variant="caption" weight="700" color={Colors.CyberGreen}>Guest: {item.guestName}</Txt>
                <View style={[styles.typePill, { backgroundColor: item.type === 'COMPLAINT' ? '#351A1A' : '#1A2A35' }]}>
                  <Txt size={8} weight="700" color={item.type === 'COMPLAINT' ? '#FF5555' : '#38BDF8'}>{item.type}</Txt>
                </View>
              </Row>
              <Spacer size={8} />
              <Txt variant="cardTitle" color={Colors.IvoryWhiteText}>{item.type === 'COMPLAINT' ? '🚨' : '🌟'} {item.title}</Txt>
              <Txt variant="caption" color={Colors.SlateMutedText} style={{ lineHeight: 16 }}>{item.description}</Txt>
              <Spacer size={8} />
              <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <View style={styles.ratingPill}><Txt variant="labelSmall" color="#FFB800">⭐ Overall: {item.overallRating.toFixed(1)}★</Txt></View>
                <View style={styles.ratingPillAlt}><Txt variant="labelSmall" color={Colors.IvoryWhiteText}>🍛 Meals: {item.mealRating.toFixed(0)}★</Txt></View>
                <View style={styles.ratingPillAlt}><Txt variant="labelSmall" color={Colors.IvoryWhiteText}>🧹 Cleanliness: {item.cleanlinessRating.toFixed(0)}★</Txt></View>
                <View style={styles.ratingPillAlt}><Txt variant="labelSmall" color={Colors.IvoryWhiteText}>💼 Manager: {item.managerRating.toFixed(0)}★</Txt></View>
                <View style={styles.ratingPillAlt}><Txt variant="labelSmall" color={Colors.IvoryWhiteText}>👨‍🍳 Staff: {item.staffRating.toFixed(0)}★</Txt></View>
                <View style={styles.ratingPillAlt}><Txt variant="labelSmall" color={Colors.IvoryWhiteText}>⚙️ Others: {item.otherRating.toFixed(0)}★</Txt></View>
              </FormScroll>
              <Spacer size={10} />
              <Row justify="space-between" align="center">
                <Row gap={6}>
                  <View style={[styles.statusDot, { backgroundColor: item.status === 'Resolved' ? '#10B981' : item.status === 'In Progress' ? '#F59E0B' : '#EF4444' }]} />
                  <Txt variant="caption" weight="700" color={item.status === 'Resolved' ? '#10B981' : item.status === 'In Progress' ? '#F59E0B' : '#EF4444'}>Status: {item.status}</Txt>
                </Row>
                <Row gap={4} align="center">
                  <Txt variant="labelSmall" color={Colors.CyberGreen}>Tap to respond</Txt>
                  <Btn onPress={() => openResponse(item)} containerColor="#1D1F27" textColor={Colors.IvoryWhiteText} borderRadius={8} height={30}>
                    <Txt variant="labelSmall" color={Colors.IvoryWhiteText}>Respond ✍️</Txt>
                  </Btn>
                </Row>
              </Row>
            </Card>
          </AnimatedPress>
        )}
      />

      {/* Response Editor Dialog */}
      <Modal visible={active != null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor="#0C0D12" borderRadius={16} borderWidth={1} borderColor="#2D2E38" padding={[16, 16]} style={{ width: '92%' }}>
            <Row justify="space-between" align="center">
              <Txt variant="labelSmall" weight="800" color={Colors.SlateMutedText}>RESPOND TO GUEST SUBMISSION</Txt>
              <IconBtn onPress={() => setActive(null)} icon="close" size={20} tint="#FFFFFF" />
            </Row>
            <Spacer size={10} />
            {active && (
              <>
                <Txt variant="cardTitle" color={Colors.IvoryWhiteText}>{active.title}</Txt>
                <Txt variant="caption" color={Colors.SlateMutedText}>Submitted by {active.guestName} ({active.category})</Txt>
                <Spacer size={10} />
                <Txt variant="caption" weight="700" color={Colors.SlateMutedText}>Flow Resolution Status</Txt>
                <Row gap={6} style={{ marginTop: 6 }}>
                  {['Open', 'In Progress', 'Resolved'].map((s) => (
                    <Chip key={s} label={s} selected={responseStatus === s} onPress={() => setResponseStatus(s)} selectedColor={Colors.CyberGreen} />
                  ))}
                </Row>
                <Spacer size={14} />
                <OutlinedTextField label="Write reply note (e.g. Electrician scheduled)" value={responseText} onChangeText={setResponseText} testID="admin_reply_input" multiline numberOfLines={3} style={{ marginBottom: 8, minHeight: 90 }} />
                <Spacer size={16} />
                <Row gap={8}>
                  <OutlinedBtn onPress={() => setActive(null)} borderColor="transparent" textColor={Colors.IvoryWhiteText} borderRadius={12} height={42} style={{ flex: 1 }}><Txt variant="body" weight="700" color={Colors.IvoryWhiteText}>Cancel</Txt></OutlinedBtn>
                  <Btn onPress={handleSave} containerColor={Colors.CyberGreen} textColor={Colors.LuxuryPureBlack} borderRadius={12} height={42} style={{ flex: 1.5 }} testID="submit_reply_button"><Txt variant="body" weight="700" color={Colors.LuxuryPureBlack}>Save & Inform Guest</Txt></Btn>
                </Row>
              </>
            )}
          </Card>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  metricBox: { flex: 1, backgroundColor: '#13141A', borderRadius: 12, borderWidth: 1, borderColor: '#22242D', padding: 12, alignItems: 'center' },
  starBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#262010', borderRadius: 12, borderWidth: 1, borderColor: '#FFB800', paddingHorizontal: 10, paddingVertical: 6 },
  progressTrack: { height: 6, backgroundColor: '#1E2533', borderRadius: 3, marginTop: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },
  emptyBox: { height: 160, alignItems: 'center', justifyContent: 'center' },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ratingPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#2B2312', borderWidth: 1, borderColor: '#FFB800' },
  ratingPillAlt: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#181D29', borderWidth: 1, borderColor: '#263246' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
});
