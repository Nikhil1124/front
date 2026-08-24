import { useState, useMemo } from 'react';
import { View, StyleSheet, Alert, Modal, Pressable, RefreshControl, ScrollView, TextInput, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import type { FeedbackComplaintEntity } from '@/types';

const GREEN = '#176B3A';
const BG = '#F7FAF7';
const CHARCOAL = '#17201A';
const MUTED = '#66736B';
const BORDER = '#DDE8E0';
const WHITE = '#FFFFFF';
const LIGHT_GREEN = '#EEF8F1';
const RADIUS = 16;

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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Highest Rated' | 'Needs Attention' | 'No Reviews'>('All');

  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [activeItem, setActiveItem] = useState<FeedbackComplaintEntity | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState('In Progress');

  // Calculations
  const totalReviews = submissions.length;
  
  const avgOverall = useMemo(() => {
    const ratings = submissions.map((s) => s.overallRating).filter((r) => r > 0);
    return ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
  }, [submissions]);

  const ratingSummary = useMemo(() => {
    // `overallRating` is 0 (unrated, not "1 star") on every submission until a real ratings
    // API exists — dividing by `totalReviews` (which counts unrated ones too) used to show a
    // confident 0%/0%/0% breakdown for properties that do have real submissions, which reads
    // as "no feedback is positive" rather than the true "no star ratings exist yet".
    const pos = submissions.filter((s) => s.overallRating >= 4).length;
    const neu = submissions.filter((s) => s.overallRating === 3).length;
    const neg = submissions.filter((s) => s.overallRating > 0 && s.overallRating <= 2).length;
    const rated = pos + neu + neg;
    if (rated === 0) return null;
    return {
      positive: { count: pos, pct: Math.round((pos / rated) * 100) },
      neutral: { count: neu, pct: Math.round((neu / rated) * 100) },
      negative: { count: neg, pct: Math.round((neg / rated) * 100) },
    };
  }, [submissions]);

  // Guest Issues (Complaints)
  const activeIssues = useMemo(() => {
    return submissions.filter((s) => s.type === 'COMPLAINT' && s.status !== 'Resolved');
  }, [submissions]);

  // Role feedback maps
  const managerReviews = useMemo(() => submissions.filter((s) => (s.category || '').toLowerCase().includes('manager') || s.managerRating > 0), [submissions]);
  const chefReviews = useMemo(() => submissions.filter((s) => (s.category || '').toLowerCase().includes('food') || (s.category || '').toLowerCase().includes('meal') || s.mealRating > 0), [submissions]);
  const staffReviews = useMemo(() => submissions.filter((s) => (s.category || '').toLowerCase().includes('staff') || (s.category || '').toLowerCase().includes('clean') || s.staffRating > 0), [submissions]);

  const avgMgr = useMemo(() => {
    const r = managerReviews.map((s) => s.managerRating).filter((v) => v > 0);
    return r.length > 0 ? r.reduce((a, b) => a + b, 0) / r.length : 0;
  }, [managerReviews]);

  const avgMeals = useMemo(() => {
    const r = chefReviews.map((s) => s.mealRating).filter((v) => v > 0);
    return r.length > 0 ? r.reduce((a, b) => a + b, 0) / r.length : 0;
  }, [chefReviews]);

  const avgClean = useMemo(() => {
    const r = staffReviews.map((s) => s.cleanlinessRating).filter((v) => v > 0);
    return r.length > 0 ? r.reduce((a, b) => a + b, 0) / r.length : 0;
  }, [staffReviews]);

  // Dynamic Actual Staff Performance Mapping
  const staffPerformanceList = useMemo(() => {
    return staffList.map((s) => {
      const role = s.role.toLowerCase();
      let rating = 0;
      let reviewCount = 0;
      let icon: keyof typeof Ionicons.glyphMap = 'person-outline';

      // `reviewCount` counts only submissions that actually carry a star rating for this
      // metric — not every category-matched complaint/feedback row, most of which have
      // `rating === 0` (unrated, since there's no real ratings API yet, see mappers.ts).
      // Counting those as reviews made a staff member with zero real ratings but a couple of
      // unrelated complaints filed under their category show "★0.0 (2)" and get flagged
      // "Needs attention" for a performance signal that doesn't exist.
      if (role === 'manager') {
        rating = avgMgr;
        reviewCount = managerReviews.filter((s) => s.managerRating > 0).length;
        icon = 'person-circle-outline';
      } else if (role === 'chef' || role === 'kitchen_staff') {
        rating = avgMeals;
        reviewCount = chefReviews.filter((s) => s.mealRating > 0).length;
        icon = 'restaurant-outline';
      } else if (role.includes('maintenance') || role.includes('clean') || role.includes('housekeeping')) {
        rating = avgClean;
        reviewCount = staffReviews.filter((s) => s.cleanlinessRating > 0).length;
        icon = 'sparkles-outline';
      } else {
        rating = avgOverall;
        reviewCount = submissions.filter((s) => s.overallRating > 0).length;
        icon = 'shield-outline';
      }

      const needsAttention = reviewCount > 0 && rating < 3.5;

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        rating,
        reviewCount,
        icon,
        needsAttention,
      };
    });
  }, [staffList, avgMgr, avgMeals, avgClean, avgOverall, managerReviews, chefReviews, staffReviews, totalReviews]);

  // Filtered actual staff members
  const displayedStaff = useMemo(() => {
    return staffPerformanceList.filter((staff) => {
      const matchesSearch = !searchQuery.trim() || staff.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFilter = true;
      if (filterType === 'Highest Rated') {
        matchesFilter = staff.rating >= 4.0 && staff.reviewCount > 0;
      } else if (filterType === 'Needs Attention') {
        matchesFilter = staff.needsAttention;
      } else if (filterType === 'No Reviews') {
        matchesFilter = staff.reviewCount === 0;
      }

      return matchesSearch && matchesFilter;
    });
  }, [staffPerformanceList, searchQuery, filterType]);

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
    } catch (err: any) {
      hapticError();
      toast('error', 'Failed to save response', err?.message ?? 'Please try again.');
    }
  };

  const getFilteredReviewsForStaff = (staff: any) => {
    const role = staff.role.toLowerCase();
    if (role === 'manager') return managerReviews;
    if (role === 'chef' || role === 'kitchen_staff') return chefReviews;
    return staffReviews;
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />
      }
    >
      {/* ── Reviews Title Header ── */}
      <Row justify="space-between" align="center">
        <Col>
          <Text style={styles.bodyTitle}>Reviews</Text>
          <Text style={styles.bodySub}>Guest feedback and staff performance</Text>
        </Col>
        {totalReviews > 0 ? (
          <View style={styles.headerRatingBox}>
            <Text style={styles.headerRatingText}>★ {avgOverall.toFixed(1)}</Text>
            <Text style={styles.headerRatingCount}>{totalReviews} reviews</Text>
          </View>
        ) : (
          <Text style={styles.noRatingText}>No rating yet</Text>
        )}
      </Row>

      <Spacer size={16} />

      {/* ── Rating Summary Component ── */}
      {ratingSummary ? (
        <View style={styles.summaryBox}>
          <Row justify="space-between" align="center" style={{ width: '100%' }}>
            <Col style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: BORDER }}>
              <Text style={styles.summaryValueText}>{ratingSummary.positive.pct}%</Text>
              <Text style={[styles.summaryLabel, { color: GREEN }]}>Positive</Text>
              <Text style={styles.summaryCountSub}>{ratingSummary.positive.count} reviews</Text>
            </Col>
            <Col style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: BORDER }}>
              <Text style={styles.summaryValueText}>{ratingSummary.neutral.pct}%</Text>
              <Text style={[styles.summaryLabel, { color: '#D97706' }]}>Neutral</Text>
              <Text style={styles.summaryCountSub}>{ratingSummary.neutral.count} reviews</Text>
            </Col>
            <Col style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.summaryValueText}>{ratingSummary.negative.pct}%</Text>
              <Text style={[styles.summaryLabel, { color: '#DC2626' }]}>Negative</Text>
              <Text style={styles.summaryCountSub}>{ratingSummary.negative.count} reviews</Text>
            </Col>
          </Row>
        </View>
      ) : (
        <View style={styles.emptySummaryBox}>
          <Ionicons name="chatbox-ellipses-outline" size={24} color={MUTED} />
          <Text style={styles.emptySummaryTitle}>No reviews yet</Text>
          <Text style={styles.emptySummaryDesc}>
            Guest feedback will appear here once residents submit reviews.
          </Text>
        </View>
      )}

      <Spacer size={20} />

      {/* ── Guest Issues Section ── */}
      <Row justify="space-between" align="center">
        <Text style={styles.sectionHeader}>Guest Issues</Text>
        {activeIssues.length > 0 ? (
          <View style={styles.issuesBadge}>
            <Text style={styles.issuesBadgeText}>{activeIssues.length} open</Text>
          </View>
        ) : null}
      </Row>
      
      <Spacer size={8} />

      {activeIssues.length === 0 ? (
        <View style={styles.noIssuesRow}>
          <Ionicons name="checkmark-circle" size={18} color={GREEN} />
          <Text style={styles.noIssuesText}>No open guest issues</Text>
          <Text style={styles.noIssuesSub}>Everything looks good right now.</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {activeIssues.map((item) => (
            <Card key={item.id} containerColor={WHITE} borderRadius={RADIUS} borderWidth={1} borderColor={BORDER} padding={[12, 14]}>
              <Row justify="space-between" align="flex-start">
                <Col style={{ flex: 1 }}>
                  <Row gap={6} align="center">
                    {item.overallRating <= 2 && (
                      <View style={styles.urgentDot} />
                    )}
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
              <Text style={styles.issueDescText} numberOfLines={2}>
                "{item.description}"
              </Text>
              <Spacer size={8} />
              <TouchableOpacity style={styles.viewIssueActionBtn} onPress={() => openReply(item)} activeOpacity={0.75}>
                <Text style={styles.viewIssueActionText}>View Issue →</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      )}

      <Spacer size={24} />

      {/* ── Staff Performance ── */}
      <Text style={styles.sectionHeader}>Staff Performance</Text>
      <Spacer size={8} />

      {staffPerformanceList.length > 0 ? (
        <>
          {/* Search & Filter */}
          <TextInput
            style={styles.searchBar}
            placeholder="Search staff..."
            placeholderTextColor={MUTED}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Spacer size={8} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <Row gap={6}>
              {(['All', 'Highest Rated', 'Needs Attention', 'No Reviews'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.filterChip, filterType === opt && styles.filterChipActive]}
                  onPress={() => setFilterType(opt)}
                >
                  <Text style={[styles.filterChipText, filterType === opt && styles.filterChipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </Row>
          </ScrollView>

          {/* Actual Staff List */}
          <View style={styles.staffListBox}>
            {displayedStaff.map((staff) => (
              <TouchableOpacity
                key={staff.id}
                style={styles.staffItemRow}
                onPress={() => {
                  hapticSelect();
                  setSelectedStaff(staff);
                }}
                activeOpacity={0.8}
              >
                <Row justify="space-between" align="center" style={{ width: '100%' }}>
                  <Row gap={12} align="center" style={{ flex: 1 }}>
                    <View style={styles.staffAvatarCircle}>
                      <Ionicons name={staff.icon} size={18} color={GREEN} />
                    </View>
                    <Col style={{ flex: 1 }}>
                      <Text style={styles.staffNameText}>{staff.name}</Text>
                      <Text style={styles.staffRoleSub}>{staff.role}</Text>
                    </Col>
                  </Row>

                  <Row gap={6} align="center">
                    {staff.needsAttention && (
                      <View style={styles.attentionBadge}>
                        <Text style={styles.attentionBadgeText}>Needs attention</Text>
                      </View>
                    )}
                    {staff.reviewCount > 0 ? (
                      <Text style={styles.staffRatingScore}>
                        ★ {staff.rating.toFixed(1)} ({staff.reviewCount})
                      </Text>
                    ) : (
                      <Text style={styles.staffNoReviewsText}>No reviews yet</Text>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={MUTED} />
                  </Row>
                </Row>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.noStaffBox}>
          <Text style={styles.noStaffText}>No staff members registered</Text>
        </View>
      )}

      {/* ── Staff Performance Detail Modal ── */}
      {selectedStaff && (
        <Modal visible transparent animationType="none" onRequestClose={() => setSelectedStaff(null)}>
          <Animated.View entering={FadeIn.duration(180)} style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedStaff(null)} />
            
            <Animated.View entering={SlideInDown.duration(160)} style={styles.drillDownSheet}>
              <View style={styles.sheetHandle} />

              <Row gap={12} align="center" style={{ marginBottom: 16 }}>
                <View style={styles.staffAvatarCircle}>
                  <Ionicons name={selectedStaff.icon} size={20} color={GREEN} />
                </View>
                <Col>
                  <Text style={styles.sheetStaffName}>{selectedStaff.name}</Text>
                  <Text style={styles.sheetStaffRole}>{selectedStaff.role}</Text>
                </Col>
              </Row>

              <Text style={styles.detailSecTitle}>Performance Ratings</Text>

              <Row gap={8} style={{ marginBottom: 16 }}>
                <View style={styles.sheetKpiCard}>
                  <Text style={styles.sheetKpiVal}>
                    {selectedStaff.reviewCount > 0 ? `★ ${selectedStaff.rating.toFixed(1)}` : '—'}
                  </Text>
                  <Text style={styles.sheetKpiLabel}>Overall Rating</Text>
                </View>
                <View style={styles.sheetKpiCard}>
                  <Text style={styles.sheetKpiVal}>{selectedStaff.reviewCount}</Text>
                  <Text style={styles.sheetKpiLabel}>Reviews Count</Text>
                </View>
              </Row>

              <Text style={styles.detailSecTitle}>Recent Feedback History</Text>
              <ScrollView style={{ maxHeight: 220, marginBottom: 12 }}>
                {getFilteredReviewsForStaff(selectedStaff).length === 0 ? (
                  <Text style={styles.noReviewsAvailableText}>No reviews available</Text>
                ) : (
                  getFilteredReviewsForStaff(selectedStaff).map((rev) => (
                    <View key={rev.id} style={styles.feedbackHistoryItem}>
                      <Row justify="space-between">
                        <Text style={styles.revGuestName}>{rev.guestName}</Text>
                        <Text style={styles.revRating}>★ {rev.overallRating}</Text>
                      </Row>
                      <Text style={styles.revDesc}>"{rev.description}"</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setSelectedStaff(null)}>
                <Text style={styles.sheetCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}

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
                    <Text style={[styles.smallChipText, responseStatus === st && styles.smallChipTextActive]}>
                      {st}
                    </Text>
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

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, backgroundColor: BG },
  bodyTitle: { fontSize: 18, fontWeight: '700', color: CHARCOAL },
  bodySub: { fontSize: 13, color: MUTED, marginTop: 2 },

  // Header Rating
  headerRatingBox: { alignItems: 'flex-end' },
  headerRatingText: { fontSize: 16, fontWeight: '800', color: GREEN },
  headerRatingCount: { fontSize: 11, color: MUTED, marginTop: 1 },
  noRatingText: { fontSize: 12, color: MUTED },

  // Summary box
  summaryBox: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryValueText: { fontSize: 18, fontWeight: '800', color: CHARCOAL },
  summaryLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  summaryCountSub: { fontSize: 9, color: MUTED, marginTop: 2 },

  // Empty summary
  emptySummaryBox: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySummaryTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL, marginTop: 8 },
  emptySummaryDesc: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 2, lineHeight: 16 },

  // Guest Issues list
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
  
  // No issues row
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

  // Issue card items
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

  // Staff Performance items
  searchBar: {
    height: 44,
    backgroundColor: WHITE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    fontSize: 13,
    color: CHARCOAL,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  filterChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  filterChipText: { fontSize: 12, color: CHARCOAL, fontWeight: '600' },
  filterChipTextActive: { color: WHITE, fontWeight: '700' },

  staffListBox: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  staffItemRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BG,
  },
  staffAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffNameText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },
  staffRoleSub: { fontSize: 10, color: MUTED, marginTop: 1 },
  staffRatingScore: { fontSize: 11, fontWeight: '700', color: CHARCOAL },
  staffNoReviewsText: { fontSize: 10, color: MUTED },
  attentionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FEF2F2',
  },
  attentionBadgeText: { fontSize: 8, fontWeight: '700', color: '#B91C1C' },
  noStaffBox: { padding: 16, alignItems: 'center' },
  noStaffText: { fontSize: 12, color: MUTED },

  // Drill down staff profile sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drillDownSheet: {
    width: '100%',
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    alignSelf: 'flex-end',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetStaffName: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  sheetStaffRole: { fontSize: 12, color: MUTED, marginTop: 1 },
  detailSecTitle: { fontSize: 11, fontWeight: '800', color: MUTED, letterSpacing: 0.5, marginBottom: 8 },
  sheetKpiCard: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  sheetKpiVal: { fontSize: 18, fontWeight: '800', color: CHARCOAL },
  sheetKpiLabel: { fontSize: 10, color: MUTED, marginTop: 2 },
  noReviewsAvailableText: { fontSize: 12, color: MUTED, fontStyle: 'italic', paddingVertical: 12 },
  feedbackHistoryItem: {
    backgroundColor: BG,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  revGuestName: { fontSize: 11, fontWeight: '700', color: CHARCOAL },
  revRating: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  revDesc: { fontSize: 11, color: MUTED, marginTop: 4, fontStyle: 'italic' },
  sheetCloseBtn: {
    height: 44,
    backgroundColor: BG,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL },

  // Dialog styles
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
});
