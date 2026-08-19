import { useState } from 'react';
import { View, StyleSheet, Alert, Modal, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Chip, IconBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { FeedbackComplaintEntity } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';

interface StaffProfile {
  id: string;
  roleKey: 'MANAGER' | 'CHEF' | 'STAFF' | 'OVERDUE';
  title: string;
  name: string;
  avatarIcon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bgColor: string;
  rating: number;
  reviewCount: number;
  subtitle: string;
}

/** Real staff members with any of these roles, joined into a display name — or a generic
 *  role label when nobody with that role is registered yet. Never a fabricated person name. */
function staffNameFor(staffList: { name: string; role: string }[], roles: string[], fallback: string): string {
  const names = staffList.filter((s) => roles.includes(s.role)).map((s) => s.name);
  return names.length > 0 ? names.join(' & ') : fallback;
}

import { useStaffQuery } from '@/features/staff/useStaff';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';

export function OwnerReviewsTab() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: staffList = [] } = useStaffQuery(activePgId ?? undefined);
  const { data: submissions = [] } = useComplaintsQuery(activePgId ?? undefined);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const respond = usePGowStore((s) => s.respondToFeedbackComplaint);
  const { refreshing, onRefresh } = usePullToRefresh();
  const toast = useToast();

  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [activeItem, setActiveItem] = useState<FeedbackComplaintEntity | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState('In Progress');

  // Overdue (> 30 days)
  const now = Date.now();
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const overdueIssues = submissions.filter((s) => {
    if (s.status === 'Resolved') return false;
    return (now - s.timestamp) > ONE_MONTH_MS;
  });

  const avg = (key: keyof FeedbackComplaintEntity) => {
    const vals = submissions.map((s) => Number(s[key]) || 0).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const avgOverall = avg('overallRating');
  const avgMeals = avg('mealRating');
  const avgClean = avg('cleanlinessRating');
  const avgMgr = avg('managerRating');

  // Priority order for the inbox below: unresolved before resolved, and within
  // that, oldest first — a complaint sitting unanswered the longest is the one
  // most likely to be forgotten, so it belongs at the top, not the bottom.
  const guestComplaints = submissions
    .filter((s) => s.type === 'COMPLAINT')
    .slice()
    .sort((a, b) => {
      const aOpen = a.status !== 'Resolved';
      const bOpen = b.status !== 'Resolved';
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return a.timestamp - b.timestamp;
    });
  const unresolvedComplaintCount = guestComplaints.filter((s) => s.status !== 'Resolved').length;

  const managerReviews = submissions.filter((s) => (s.category || '').toLowerCase().includes('manager') || s.managerRating > 0);
  const chefReviews = submissions.filter((s) => (s.category || '').toLowerCase().includes('food') || (s.category || '').toLowerCase().includes('meal') || s.mealRating > 0);
  const staffReviews = submissions.filter((s) => (s.category || '').toLowerCase().includes('staff') || (s.category || '').toLowerCase().includes('clean') || s.staffRating > 0);

  const staffProfiles: StaffProfile[] = [
    {
      id: 'staff_mgr',
      roleKey: 'MANAGER',
      title: 'Branch Manager',
      name: owner?.managerName || 'Manager',
      avatarIcon: 'person',
      tint: Colors.primary,
      bgColor: '#F0FDF9',
      rating: avgMgr,
      reviewCount: managerReviews.length,
      subtitle: 'Tenant relations, operations & branch management',
    },
    {
      id: 'staff_chef',
      roleKey: 'CHEF',
      title: 'Head Chef & Mess Team',
      name: staffNameFor(staffList, ['Chef', 'Kitchen Staff'], 'Kitchen Staff'),
      avatarIcon: 'restaurant',
      tint: '#D97706',
      bgColor: '#FFFBEB',
      rating: avgMeals,
      reviewCount: chefReviews.length,
      subtitle: 'Daily meals, food taste, hygiene & mess timings',
    },
    {
      id: 'staff_clean',
      roleKey: 'STAFF',
      title: 'Housekeeping & Maintenance',
      name: staffNameFor(staffList, ['Housekeeping', 'Maintenance Staff'], 'Housekeeping Staff'),
      avatarIcon: 'sparkles',
      tint: '#2563EB',
      bgColor: '#EFF6FF',
      rating: avgClean,
      reviewCount: staffReviews.length,
      subtitle: 'Room cleaning, repairs, electrical & water support',
    },
  ];

  const getFilteredReviewsForStaff = (staff: StaffProfile) => {
    if (staff.roleKey === 'MANAGER') return managerReviews.length > 0 ? managerReviews : submissions;
    if (staff.roleKey === 'CHEF') return chefReviews.length > 0 ? chefReviews : submissions;
    if (staff.roleKey === 'STAFF') return staffReviews.length > 0 ? staffReviews : submissions;
    if (staff.roleKey === 'OVERDUE') return overdueIssues;
    return submissions;
  };

  const openReply = (item: FeedbackComplaintEntity) => {
    hapticSelect();
    setActiveItem(item);
    setResponseText(item.adminResponse ?? '');
    setResponseStatus(item.status);
  };

  const renderComplaintCard = (item: FeedbackComplaintEntity) => {
    const daysOld = Math.floor((now - item.timestamp) / (24 * 60 * 60 * 1000));
    const isOverdue = item.status !== 'Resolved' && daysOld > 30;

    return (
      <Card
        key={item.id}
        containerColor={isOverdue ? '#FFFBEB' : Colors.surfaceElevated}
        borderRadius={14}
        borderWidth={1}
        borderColor={isOverdue ? '#F59E0B' : Colors.borderSubtle}
        padding={[12, 12]}
      >
        <Row justify="space-between" align="flex-start">
          <Col style={{ flex: 1 }}>
            <Row align="center" gap={6}>
              <Txt variant="body" weight="800" color={Colors.textPrimary}>{item.guestName}</Txt>
              <View style={styles.roomPill}>
                <Txt variant="labelSmall" weight="800" color={Colors.primaryDark}>Room {item.roomNo || 'N/A'}</Txt>
              </View>
            </Row>
            <Txt variant="labelSmall" weight="400" color={Colors.textMuted} style={{ marginTop: 2 }}>
              {item.category || 'Feedback'} • {new Date(item.timestamp).toLocaleDateString('en-IN')}
            </Txt>
          </Col>
          <Row gap={2} align="center">
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name="star"
                size={11}
                color={star <= (item.overallRating || 5) ? '#F59E0B' : Colors.borderSubtle}
              />
            ))}
          </Row>
        </Row>

        <Spacer size={8} />
        <Txt variant="caption" color={Colors.textPrimary} style={{ lineHeight: 16 }}>
          "{item.description || 'Everything is great!'}"
        </Txt>

        {item.adminResponse ? (
          <View style={styles.responseBox}>
            <Txt variant="labelSmall" weight="800" color={Colors.primaryDark}>Official Response:</Txt>
            <Txt variant="labelSmall" weight="400" color={Colors.textSecondary} style={{ marginTop: 2 }}>{item.adminResponse}</Txt>
          </View>
        ) : null}

        <Spacer size={8} />
        <Row justify="space-between" align="center">
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'Resolved' ? '#ECFDF5' : '#FEF2F2' }]}>
            <Txt variant="labelSmall" weight="800" color={item.status === 'Resolved' ? '#047857' : '#B91C1C'}>
              {item.status}
            </Txt>
          </View>

          <Btn
            onPress={() => openReply(item)}
            containerColor={Colors.surfaceMuted}
            textColor={Colors.textPrimary}
            borderRadius={8}
            height={28}
            contentStyle={{ paddingHorizontal: 10 }}
          >
            <Txt variant="labelSmall" weight="800" color={Colors.textPrimary}>
              {item.adminResponse ? 'Edit Reply' : 'Respond / Action'}
            </Txt>
          </Btn>
        </Row>
      </Card>
    );
  };

  const handleSaveReply = async () => {
    if (!activeItem) return;
    if (!responseText.trim()) {
      hapticError();
      Alert.alert('Validation', 'Please write a response reply');
      return;
    }
    try {
      await respond(activeItem.id, responseText, responseStatus);
      hapticSuccess();
      toast('success', 'Review updated', `${activeItem.guestName} has been notified of your response.`);
      setActiveItem(null);
    } catch (err: any) {
      hapticError();
      toast('error', 'Could not save response', err?.message ?? 'Please try again.');
    }
  };

  return (
    <FormScroll
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
    >
      {/* Header */}
      <Row justify="space-between" align="center">
        <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary}>Staff Performance & Reviews</Txt>
        <View style={styles.scoreBadge}>
          <Txt size={14}>★</Txt>
          <Txt variant="cardTitle" weight="900" color={Colors.primaryDark} style={{ marginLeft: 3 }}>
            {avgOverall.toFixed(1)}
          </Txt>
        </View>
      </Row>

      {/* ⚠️ Overdue Unresolved Issues Card (> 1 Month) */}
      {overdueIssues.length > 0 && (
        <AnimatedPress
          scale={0.98}
          hapticPattern="light"
          onPress={() => {
            setSelectedStaff({
              id: 'staff_overdue',
              roleKey: 'OVERDUE',
              title: 'Unresolved Issues (> 1 Mo)',
              name: 'Escalations Pending > 30 Days',
              avatarIcon: 'alert-circle',
              tint: '#D97706',
              bgColor: '#FFFBEB',
              rating: 3.2,
              reviewCount: overdueIssues.length,
              subtitle: 'Tenant complaints open for more than 1 month',
            });
          }}
        >
          <Card
            containerColor="#FFFBEB"
            borderRadius={16}
            borderWidth={1.5}
            borderColor="#F59E0B"
            padding={[14, 14]}
          >
            <Row justify="space-between" align="center">
              <Row gap={10} align="center" style={{ flex: 1 }}>
                <View style={styles.warningIconBox}>
                  <Ionicons name="alert-circle" size={22} color="#D97706" />
                </View>
                <Col style={{ flex: 1 }}>
                  <Txt size={13} weight="900" color="#B45309">
                    {overdueIssues.length} Unresolved Issue{overdueIssues.length === 1 ? '' : 's'} &gt; 1 Month Old
                  </Txt>
                  <Txt variant="labelSmall" weight="400" color="#92400E" style={{ marginTop: 2 }}>
                    Tap to review escalated tenant complaints ›
                  </Txt>
                </Col>
              </Row>
              <Ionicons name="chevron-forward" size={18} color="#D97706" />
            </Row>
          </Card>
        </AnimatedPress>
      )}

      {/* Guest Complaints — the actual inbox, front and center instead of buried
          behind a staff-member drill-down. Unresolved + oldest first. */}
      <Row justify="space-between" align="center" style={{ marginTop: 4 }}>
        <Txt variant="caption" weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>
          GUEST COMPLAINTS ({guestComplaints.length})
        </Txt>
        {unresolvedComplaintCount > 0 && (
          <View style={styles.unresolvedBadge}>
            <Txt variant="labelSmall" weight="800" color="#B91C1C">{unresolvedComplaintCount} unresolved</Txt>
          </View>
        )}
      </Row>
      <Spacer size={8} />

      {guestComplaints.length === 0 ? (
        <Card containerColor={Colors.surfaceElevated} borderRadius={12} padding={[18, 16]} style={{ alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
          <Txt variant="caption" weight="700" color={Colors.textMuted} style={{ marginTop: 6 }}>
            No guest complaints right now.
          </Txt>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {guestComplaints.map(renderComplaintCard)}
        </View>
      )}

      {/* Staff Profile Roster Cards */}
      <Txt variant="caption" weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginTop: 4 }}>
        STAFF MEMBERS & RATINGS ({staffProfiles.length})
      </Txt>

      <View style={{ gap: 12 }}>
        {staffProfiles.map((staff) => (
          <AnimatedPress
            key={staff.id}
            scale={0.98}
            hapticPattern="light"
            onPress={() => { hapticSelect(); setSelectedStaff(staff); }}
          >
            <Card
              containerColor={Colors.surface}
              borderRadius={18}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[16, 16]}
            >
              <Row justify="space-between" align="center">
                <Row gap={12} align="center" style={{ flex: 1 }}>
                  <View style={[styles.avatarBox, { backgroundColor: staff.bgColor }]}>
                    <Ionicons name={staff.avatarIcon} size={22} color={staff.tint} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Row align="center" gap={6}>
                      <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>{staff.name}</Txt>
                    </Row>
                    <Txt variant="caption" weight="700" color={staff.tint} style={{ marginTop: 2 }}>{staff.title}</Txt>
                    <Txt variant="labelSmall" weight="400" color={Colors.textMuted} style={{ marginTop: 2 }} numberOfLines={1}>
                      {staff.subtitle}
                    </Txt>
                  </Col>
                </Row>

                <Col align="flex-end" style={{ marginLeft: 10 }}>
                  <View style={[styles.ratingPill, { backgroundColor: staff.bgColor }]}>
                    <Txt size={13} weight="900" color={staff.tint}>
                      {staff.reviewCount === 0 ? 'No reviews' : `★ ${staff.rating.toFixed(1)}`}
                    </Txt>
                  </View>
                  <Txt size={10} weight="600" color={Colors.textMuted} style={{ marginTop: 4 }}>
                    {staff.reviewCount} Reviews ›
                  </Txt>
                </Col>
              </Row>
            </Card>
          </AnimatedPress>
        ))}
      </View>

      {/* Staff Review & Feedback Drill-Down Modal */}
      {selectedStaff && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedStaff(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedStaff(null)} />
            <Card
              containerColor={Colors.surface}
              borderRadius={24}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '92%', maxHeight: '85%', zIndex: 2 }}
            >
              <Row justify="space-between" align="center">
                <Row gap={10} align="center" style={{ flex: 1 }}>
                  <View style={[styles.avatarBox, { backgroundColor: selectedStaff.bgColor }]}>
                    <Ionicons name={selectedStaff.avatarIcon} size={22} color={selectedStaff.tint} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>{selectedStaff.name}</Txt>
                    <Txt variant="caption" color={selectedStaff.tint} weight="700">
                      {selectedStaff.title}{selectedStaff.roleKey !== 'OVERDUE' && selectedStaff.reviewCount > 0 ? ` • ★ ${selectedStaff.rating.toFixed(1)}` : ''}
                    </Txt>
                  </Col>
                </Row>
                <IconBtn onPress={() => setSelectedStaff(null)} icon="close" size={18} tint={Colors.textMuted} />
              </Row>

              <Spacer size={14} />
              <Txt variant="caption" weight="800" color={Colors.textMuted}>TENANT FEEDBACK & MESSAGES</Txt>
              <Spacer size={8} />

              <FormScroll showsVerticalScrollIndicator={false} style={{ flex: 0, maxHeight: 360 }} contentContainerStyle={{ gap: 10 }}>
                {getFilteredReviewsForStaff(selectedStaff).length === 0 ? (
                  <Card containerColor={Colors.surfaceElevated} borderRadius={12} padding={[18, 16]} style={{ alignItems: 'center' }}>
                    <Ionicons name="chatbox-ellipses-outline" size={32} color={Colors.textMuted} />
                    <Txt variant="caption" weight="700" color={Colors.textMuted} style={{ marginTop: 6 }}>
                      No reviews logged specifically for this role yet.
                    </Txt>
                  </Card>
                ) : (
                  getFilteredReviewsForStaff(selectedStaff).map(renderComplaintCard)
                )}
              </FormScroll>
            </Card>
          </View>
        </Modal>
      )}

      {/* Reply Modal */}
      {activeItem && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setActiveItem(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveItem(null)} />
            <Card
              containerColor={Colors.surface}
              borderRadius={24}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[20, 20]}
              style={{ width: '90%', zIndex: 3 }}
            >
              <Txt variant="sectionTitle" weight="900" color={Colors.textPrimary}>Review Response & Triage</Txt>
              <Txt variant="caption" color={Colors.textMuted} style={{ marginTop: 2 }}>
                Tenant: {activeItem.guestName} (Room {activeItem.roomNo})
              </Txt>

              <Spacer size={12} />
              <OutlinedTextField
                label="Owner / Manager Reply"
                placeholder="Write resolution notes or instructions to manager..."
                value={responseText}
                onChangeText={setResponseText}
                multiline
                numberOfLines={3}
                containerColor={Colors.surfaceMuted}
                style={{ minHeight: 90 }}
              />

              <Spacer size={10} />
              <Txt variant="caption" weight="800" color={Colors.textMuted}>Set Status:</Txt>
              <Row gap={6} style={{ marginTop: 6 }}>
                {['Open', 'In Progress', 'Resolved'].map((st) => (
                  <Chip
                    key={st}
                    label={st}
                    selected={responseStatus === st}
                    onPress={() => setResponseStatus(st)}
                  />
                ))}
              </Row>

              <Spacer size={16} />
              <Row gap={8}>
                <Btn
                  onPress={handleSaveReply}
                  containerColor={Colors.primary}
                  textColor={Colors.textInverse}
                  borderRadius={12}
                  height={44}
                  style={{ flex: 1 }}
                >
                  <Txt variant="body" weight="800" color={Colors.textInverse}>Save & Notify</Txt>
                </Btn>
                <OutlinedBtn
                  onPress={() => setActiveItem(null)}
                  borderColor={Colors.borderSubtle}
                  textColor={Colors.textPrimary}
                  borderRadius={12}
                  height={44}
                  style={{ flex: 1 }}
                >
                  <Txt variant="body" weight="800" color={Colors.textPrimary}>Cancel</Txt>
                </OutlinedBtn>
              </Row>
            </Card>
          </View>
        </Modal>
      )}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  warningIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarBox: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  ratingPill: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  roomPill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: '#F0FDF9',
  },
  unresolvedBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  responseBox: {
    backgroundColor: '#F0FDF9',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
