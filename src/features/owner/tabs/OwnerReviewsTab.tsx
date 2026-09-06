import { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, RefreshControl, ScrollView, Text, BackHandler } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Row, Col, Spacer, LoadingState, ErrorState, ListRow, SearchField, AnimatedPress } from '@/components/ui';
import { Colors, Radii } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
const GREEN = Colors.primary;        // Deep Ocean Blue
const BG = Colors.canvas;            // Light Ice Canvas
const CHARCOAL = Colors.textPrimary; // Obsidian Navy
const MUTED = Colors.textMuted;      // Ocean Muted
const BORDER = Colors.borderSubtle;  // Ice Subtle Border
const WHITE = Colors.surface;
const LIGHT_GREEN = Colors.surfaceElevated; // Soft Ice Cyan Tint
const RADIUS = 20;

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
  const {
    data: staffList = [],
    isLoading: staffLoading,
    error: staffError,
    refetch: refetchStaff } = useStaffQuery(activePgId ?? undefined);
  const { data: submissions = [] } = useComplaintsQuery(activePgId ?? undefined);
  const { refreshing, onRefresh } = usePullToRefresh();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Highest Rated' | 'Needs Attention' | 'No Reviews'>('All');

  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);

  // Override back navigation — reviews is a hidden tab, not a stack screen,
  // so native back would leave ghost tab state. Force-replace with overview.
  useEffect(() => {
    const onBack = () => { router.replace('/overview'); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  // Calculations
  const totalReviews = submissions.length;
  
  const avgOverall = useMemo(() => {
    const ratings = submissions.map((s) => s.overallRating).filter((r) => r > 0);
    return ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
  }, [submissions]);

  const ratingSummary = useMemo(() => {
    if (totalReviews === 0) return null;
    const pos = submissions.filter((s) => s.overallRating >= 4).length;
    const neu = submissions.filter((s) => s.overallRating === 3).length;
    const neg = submissions.filter((s) => s.overallRating > 0 && s.overallRating <= 2).length;
    return {
      positive: { count: pos, pct: Math.round((pos / totalReviews) * 100) },
      neutral: { count: neu, pct: Math.round((neu / totalReviews) * 100) },
      negative: { count: neg, pct: Math.round((neg / totalReviews) * 100) } };
  }, [submissions, totalReviews]);

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

  // Dynamic Actual Staff Performance Mapping — grouped by role, not by person. Feedback is
  // captured per role (manager / kitchen / cleaning), never tied to an individual staff id,
  // so when 2+ people share a role there is no way to tell them apart. Showing the same
  // role-wide number on separate per-person cards — each with its own "Needs attention" badge
  // and identical "Recent Feedback History" — implied a precision the data doesn't have. One
  // card per role instead; the card names everyone who shares it.
  const staffPerformanceList = useMemo(() => {
    const byRole = new Map<string, { id: string; name: string }[]>();
    staffList.forEach((s) => {
      if (!byRole.has(s.role)) byRole.set(s.role, []);
      byRole.get(s.role)!.push({ id: s.id, name: s.name });
    });

    return Array.from(byRole.entries()).map(([role, members]) => {
      const roleLower = role.toLowerCase();
      let rating = 0;
      let reviewCount = 0;
      let icon: keyof typeof Ionicons.glyphMap = 'person-outline';
      let reviews = submissions;

      if (roleLower === 'manager') {
        rating = avgMgr;
        reviewCount = managerReviews.length;
        icon = 'person-circle-outline';
        reviews = managerReviews;
      } else if (roleLower === 'chef' || roleLower === 'kitchen staff') {
        rating = avgMeals;
        reviewCount = chefReviews.length;
        icon = 'restaurant-outline';
        reviews = chefReviews;
      } else if (roleLower.includes('maintenance') || roleLower.includes('clean') || roleLower.includes('housekeeping')) {
        rating = avgClean;
        reviewCount = staffReviews.length;
        icon = 'sparkles-outline';
        reviews = staffReviews;
      } else {
        rating = avgOverall;
        reviewCount = totalReviews;
        icon = 'shield-outline';
        reviews = submissions;
      }

      const needsAttention = reviewCount > 0 && rating < 3.5;
      const isShared = members.length > 1;

      return {
        id: members.map((m) => m.id).join('-'),
        name: isShared ? `${role} Team (${members.length})` : members[0].name,
        subtitle: isShared ? members.map((m) => m.name).join(', ') : role,
        role,
        isShared,
        rating,
        reviewCount,
        icon,
        reviews,
        needsAttention };
    });
  }, [staffList, avgMgr, avgMeals, avgClean, avgOverall, managerReviews, chefReviews, staffReviews, totalReviews, submissions]);

  // Filtered actual staff members
  const displayedStaff = useMemo(() => {
    return staffPerformanceList.filter((staff) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery.trim() || staff.name.toLowerCase().includes(q) || staff.subtitle.toLowerCase().includes(q);

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
          <Text maxFontSizeMultiplier={1.3} style={styles.bodyTitle}>Reviews</Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.bodySub}>Guest feedback and staff performance</Text>
        </Col>
        {totalReviews > 0 ? (
          <View style={styles.headerRatingBox}>
            <Text maxFontSizeMultiplier={1.3} style={styles.headerRatingText}>★ {avgOverall.toFixed(1)}</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.headerRatingCount}>{totalReviews} reviews</Text>
          </View>
        ) : (
          <Text maxFontSizeMultiplier={1.3} style={styles.noRatingText}>No rating yet</Text>
        )}
      </Row>

      <Spacer size={16} />

      {/* ── Rating Summary Component ── */}
      {ratingSummary ? (
        <View style={styles.summaryBox}>
          <Row justify="space-between" align="center" style={{ width: '100%' }}>
            <Col style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: BORDER }}>
              <Text maxFontSizeMultiplier={1.3} style={styles.summaryValueText}>{ratingSummary.positive.pct}%</Text>
              <Text maxFontSizeMultiplier={1.3} style={[styles.summaryLabel, { color: GREEN }]}>Positive</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.summaryCountSub}>{ratingSummary.positive.count} reviews</Text>
            </Col>
            <Col style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: BORDER }}>
              <Text maxFontSizeMultiplier={1.3} style={styles.summaryValueText}>{ratingSummary.neutral.pct}%</Text>
              <Text maxFontSizeMultiplier={1.3} style={[styles.summaryLabel, { color: Colors.warning }]}>Neutral</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.summaryCountSub}>{ratingSummary.neutral.count} reviews</Text>
            </Col>
            <Col style={{ flex: 1, alignItems: 'center' }}>
              <Text maxFontSizeMultiplier={1.3} style={styles.summaryValueText}>{ratingSummary.negative.pct}%</Text>
              <Text maxFontSizeMultiplier={1.3} style={[styles.summaryLabel, { color: Colors.danger }]}>Negative</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.summaryCountSub}>{ratingSummary.negative.count} reviews</Text>
            </Col>
          </Row>
        </View>
      ) : (
        <View style={styles.emptySummaryBox}>
          <Ionicons name="chatbox-ellipses-outline" size={24} color={MUTED} />
          <Text maxFontSizeMultiplier={1.3} style={styles.emptySummaryTitle}>No reviews yet</Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.emptySummaryDesc}>
            Guest feedback will appear here once residents submit reviews.
          </Text>
        </View>
      )}

      <Spacer size={20} />

      {/* ── Staff Performance ── */}
      <Text maxFontSizeMultiplier={1.3} style={styles.sectionHeader}>Staff Performance</Text>
      <Spacer size={8} />

      {/* Without these, a failed or in-flight staff fetch fell straight through to the
          "no reviews yet" branch — an owner whose roster simply hadn't loaded was told there
          was nothing to review, with no retry. */}
      {staffLoading ? (
        <LoadingState label="Loading staff performance…" fill={false} />
      ) : staffError ? (
        <ErrorState
          error={staffError}
          title="Could not load staff performance"
          onRetry={refetchStaff}
          fill={false}
        />
      ) : staffPerformanceList.length > 0 ? (
        <>
          {/* Search & Filter */}
          <SearchField
            placeholder="Search staff"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Spacer size={8} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <Row gap={6}>
              {(['All', 'Highest Rated', 'Needs Attention', 'No Reviews'] as const).map((opt) => (
                <AnimatedPress accessibilityRole="button"
                  key={opt}
                  style={[styles.filterChip, filterType === opt && styles.filterChipActive]}
                  onPress={() => setFilterType(opt)}
                >
                  <Text maxFontSizeMultiplier={1.3} style={[styles.filterChipText, filterType === opt && styles.filterChipTextActive]}>
                    {opt}
                  </Text>
                </AnimatedPress>
              ))}
            </Row>
          </ScrollView>

          {/* Actual Staff List */}
          <View style={styles.staffListBox}>
            {displayedStaff.map((staff, i) => (
              <ListRow
                key={staff.id}
                title={staff.name}
                meta={staff.subtitle}
                leading={<Ionicons name={staff.icon} size={17} color={GREEN} />}
                amount={staff.reviewCount > 0 ? `★ ${staff.rating.toFixed(1)} (${staff.reviewCount})` : undefined}
                status={
                  staff.needsAttention ? { label: 'Needs attention', tone: 'warn' }
                  : staff.reviewCount === 0 ? { label: 'No reviews yet', tone: 'neutral' }
                  : undefined
                }
                onPress={() => setSelectedStaff(staff)}
                first={i === 0}
                last={i === displayedStaff.length - 1}
                testID={`staff_review_${staff.id}`}
              />
            ))}
          </View>
        </>
      ) : (
        <View style={styles.noStaffBox}>
          <Text maxFontSizeMultiplier={1.3} style={styles.noStaffText}>No staff members registered</Text>
        </View>
      )}

      {/* ── Staff Performance Detail Modal ── */}
      {selectedStaff && (
        <Modal visible transparent animationType="none" onRequestClose={() => setSelectedStaff(null)}>
          <Animated.View entering={FadeIn.duration(180)} style={styles.modalBackdrop}>
            <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setSelectedStaff(null)} />
            
            <Animated.View entering={SlideInDown.springify(160).dampingRatio(0.85)} style={styles.drillDownSheet}>
              <View style={styles.sheetHandle} />

              <Row gap={12} align="center" style={{ marginBottom: 16 }}>
                <View style={styles.staffAvatarCircle}>
                  <Ionicons name={selectedStaff.icon} size={20} color={GREEN} />
                </View>
                <Col>
                  <Text maxFontSizeMultiplier={1.3} style={styles.sheetStaffName}>{selectedStaff.name}</Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.sheetStaffRole}>{selectedStaff.subtitle}</Text>
                </Col>
              </Row>

              <Text maxFontSizeMultiplier={1.3} style={styles.detailSecTitle}>Performance Ratings</Text>
              
              <Row gap={8} style={{ marginBottom: 16 }}>
                <View style={styles.sheetKpiCard}>
                  <Text maxFontSizeMultiplier={1.3} style={styles.sheetKpiVal}>
                    {selectedStaff.reviewCount > 0 ? `★ ${selectedStaff.rating.toFixed(1)}` : '—'}
                  </Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.sheetKpiLabel}>Overall Rating</Text>
                </View>
                <View style={styles.sheetKpiCard}>
                  <Text maxFontSizeMultiplier={1.3} style={styles.sheetKpiVal}>{selectedStaff.reviewCount}</Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.sheetKpiLabel}>Reviews Count</Text>
                </View>
              </Row>

              {selectedStaff.isShared ? (
                <>
                  <Text maxFontSizeMultiplier={1.3} style={styles.sharedNoticeText}>
                    Feedback is logged per role, not per person — this rating and history are shared across everyone in {selectedStaff.role}.
                  </Text>
                  <Spacer size={12} />
                </>
              ) : null}

              <Text maxFontSizeMultiplier={1.3} style={styles.detailSecTitle}>Recent Feedback History</Text>
              <ScrollView style={{ maxHeight: 220, marginBottom: 12 }}>
                {selectedStaff.reviews.length === 0 ? (
                  <Text maxFontSizeMultiplier={1.3} style={styles.noReviewsAvailableText}>No reviews available</Text>
                ) : (
                  selectedStaff.reviews.map((rev: any) => (
                    <View key={rev.id} style={styles.feedbackHistoryItem}>
                      <Row justify="space-between">
                        <Text maxFontSizeMultiplier={1.3} style={styles.revGuestName}>{rev.guestName}</Text>
                        <Text maxFontSizeMultiplier={1.3} style={styles.revRating}>★ {rev.overallRating}</Text>
                      </Row>
                      <Text maxFontSizeMultiplier={1.3} style={styles.revDesc}>"{rev.description}"</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <AnimatedPress accessibilityRole="button" style={styles.sheetCloseBtn} onPress={() => setSelectedStaff(null)}>
                <Text maxFontSizeMultiplier={1.3} style={styles.sheetCloseBtnText}>Close</Text>
              </AnimatedPress>
            </Animated.View>
          </Animated.View>
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
    alignItems: 'center' },
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
    justifyContent: 'center' },
  emptySummaryTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL, marginTop: 8 },
  emptySummaryDesc: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 2, lineHeight: 16 },

  sectionHeader: { fontSize: 15, fontWeight: '700', color: CHARCOAL },

  // Staff Performance items
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.control,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER },
  filterChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN },
  filterChipText: { fontSize: 12, color: CHARCOAL, fontWeight: '600' },
  filterChipTextActive: { color: WHITE, fontWeight: '700' },

  staffListBox: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden' },
  staffAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: Radii.control,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center' },
  noStaffBox: { padding: 16, alignItems: 'center' },
  noStaffText: { fontSize: 12, color: MUTED },

  // Drill down staff profile sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 13, 0.45)',
    justifyContent: 'center',
    alignItems: 'center' },
  drillDownSheet: {
    width: '100%',
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    alignSelf: 'flex-end' },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: Radii.badge,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 16 },
  sheetStaffName: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  sheetStaffRole: { fontSize: 12, color: MUTED, marginTop: 1 },
  detailSecTitle: { fontSize: 11, fontWeight: '800', color: MUTED, letterSpacing: 0.5, marginBottom: 8 },
  sheetKpiCard: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: Radii.card,
    padding: 12,
    alignItems: 'center' },
  sheetKpiVal: { fontSize: 18, fontWeight: '800', color: CHARCOAL },
  sheetKpiLabel: { fontSize: 10, color: MUTED, marginTop: 2 },
  noReviewsAvailableText: { fontSize: 12, color: MUTED, fontStyle: 'italic', paddingVertical: 12 },
  sharedNoticeText: { fontSize: 11, color: MUTED, lineHeight: 16, backgroundColor: BG, borderRadius: Radii.control, padding: 10 },
  feedbackHistoryItem: {
    backgroundColor: BG,
    borderRadius: Radii.control,
    padding: 10,
    marginBottom: 8 },
  revGuestName: { fontSize: 11, fontWeight: '700', color: CHARCOAL },
  revRating: { fontSize: 11, fontWeight: '700', color: Colors.warning },
  revDesc: { fontSize: 11, color: MUTED, marginTop: 4, fontStyle: 'italic' },
  sheetCloseBtn: {
    height: 44,
    backgroundColor: BG,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center' },
  sheetCloseBtnText: { fontSize: 13, fontWeight: '700', color: CHARCOAL } });
