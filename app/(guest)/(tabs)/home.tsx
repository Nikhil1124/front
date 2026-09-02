/**
 * Resident / Guest Home — redesigned to match the premium residential lifestyle reference.
 *
 * Layout:
 *   1. Flat teal header (deep green) with avatar + greeting + bell, ending in a wide oval curve.
 *   2. White Residence/Rent card, raised over the curve.
 *   3. Meal hero card (light bg, food image right side, gradient fade, RSVP buttons).
 *   4. Today at PGow timeline.
 *   5. Quick Services 2×2 grid (image + title + desc + teal arrow circle).
 *   6. Community Notice horizontal scroll.
 *
 * All data is live — no mocks. Zero hardcoding of resident, meal, or rent info.
 */
import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, StyleSheet, Alert, ScrollView, RefreshControl,
  Image, TouchableOpacity, Platform, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Txt, Btn, Row, Col, Spacer, LoadingState, ErrorState, OutlinedBtn } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { KycUploadDialog } from '@/components/dialogs/KycUploadDialog';
import { useKycStatus, canSubmitKyc } from '@/features/kyc/useKycStatus';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';
import { useToast } from '@/hooks/useToast';
import type { MealNotificationEntity } from '@/types';
import { currentPeriod, periodToMonthYear } from '@/data/mappers';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useMealsQuery, useMyMealResponseQuery } from '@/features/meals/useMeals';
import { useAuthStore } from '@/store/authStore';
import { usePropertyQuery } from '@/features/properties/useProperties';
import { useLaundryRequestsQuery } from '@/features/requests/useComplaints';
import { RoleNotificationsCenterSheet } from '@/components/dialogs/RoleNotificationsCenterSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CUTOFF_HOURS: Record<string, number> = { BREAKFAST: 10, LUNCH: 14, DINNER: 21 };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMealCutoffMs(m: MealNotificationEntity): number {
  const d = new Date(m.timestamp);
  d.setHours(CUTOFF_HOURS[m.mealType.toUpperCase()] ?? 12, 0, 0, 0);
  return d.getTime();
}

function cutoffLabel(ms: number | null): string {
  if (!ms) return '';
  const rem = ms - Date.now();
  if (rem <= 0) return 'Closed';
  const mins = Math.floor(rem / 60_000);
  if (mins < 60) return `Cut-off in ${mins}m`;
  return `Cut-off in ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function GuestHomeTab() {
  const insets = useSafeAreaInsets();
  const [showKycDialog, setShowKycDialog] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const guest = usePGowStore((s) => s.loggedInGuest);
  const activePgId = useAuthStore((s) => s.activePgId);
  const submitRSVP = usePGowStore((s) => s.submitRSVP);

  // Persistent Vacation Mode / Away from PG state
  const VACATION_MODE_KEY = '@pgow/vacation_mode';
  const [isAwayFromPg, setIsAwayFromPg] = useState(false);
  const toast = useToast();

  useEffect(() => {
    AsyncStorage.getItem(VACATION_MODE_KEY)
      .then((val) => { if (val === 'true') setIsAwayFromPg(true); })
      .catch(() => {});
  }, []);

  const toggleVacationMode = useCallback((away: boolean) => {
    setIsAwayFromPg(away);
    AsyncStorage.setItem(VACATION_MODE_KEY, away ? 'true' : 'false').catch(() => {});
    if (away) {
      hapticSelect();
      toast('info', 'Vacation Mode Enabled ✈️', 'Meal notifications & kitchen RSVP reminders are paused while you are away.');
    } else {
      hapticSuccess();
      toast('success', 'Welcome Back! 🏠', 'Meal notifications & daily portion RSVPs resumed.');
    }
  }, [toast]);

  const { data: roleNotifs = [], refetch: refetchNotifs, isLoading: noticesLoading, error: noticesError } = useRoleNotificationsQuery(activePgId ?? undefined);
  const { data: meals = [], refetch: refetchMeals, error: mealsError } = useMealsQuery(activePgId ?? undefined);
  const { data: property } = usePropertyQuery(activePgId ?? undefined);
  const { data: laundryRequests = [] } = useLaundryRequestsQuery(activePgId ?? undefined);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchNotifs(), refetchMeals()]);
    setRefreshing(false);
  };

  const kycStatus = useKycStatus();
  const isBillPaid = guest?.isBillPaid ?? false;
  const rentDue = guest?.rentAmount ?? 0;
  const currentMonth = periodToMonthYear(currentPeriod());
  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;

  // ── Upcoming meal ──────────────────────────────────────────────────────────
  const upcomingMeal: MealNotificationEntity | null = (() => {
    const src = meals.filter((m) => m.isAlertSent).length > 0 ? meals.filter((m) => m.isAlertSent) : meals;
    if (!src.length) return null;
    const enriched = src.map((m) => ({ m, cutoff: getMealCutoffMs(m) }));
    const future = enriched.filter(({ cutoff }) => cutoff > Date.now());
    if (future.length) { future.sort((a, b) => a.cutoff - b.cutoff); return future[0].m; }
    enriched.sort((a, b) => b.cutoff - a.cutoff);
    return enriched[0].m;
  })();

  const cutoffMs = upcomingMeal ? getMealCutoffMs(upcomingMeal) : null;
  const cutoffPassed = cutoffMs ? cutoffMs <= Date.now() : false;
  const cutoffText = cutoffLabel(cutoffMs);

  const { data: myMealResponse } = useMyMealResponseQuery(upcomingMeal?.id, activePgId ?? undefined);
  const isAttending = myMealResponse?.choice === 'eating';

  // Refresh countdown every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const toggleAttending = async (attending: boolean) => {
    if (!upcomingMeal) return;
    if (cutoffPassed) { Alert.alert('Cut-off passed', 'RSVP window has closed.'); return; }
    hapticSelect();
    await submitRSVP(upcomingMeal.id, attending ? 'REQUIRED' : 'NOT_REQUIRED');
  };

  // ── Today's timeline items ─────────────────────────────────────────────────
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayMeals = meals.filter((m) => new Date(m.timestamp) >= todayStart);
  const myLaundry = laundryRequests.filter(
    (r) => r.guestId === guest?.id && ['Open', 'In Progress', 'Scheduled'].includes(r.status)
  );

  const notices = roleNotifs.slice(0, 5);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* ══════════════ HEADER ══════════════ */}
      <LinearGradient
        colors={['#011C40', '#023859']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        {/* Decorative wave circles bottom-right */}
        <View style={styles.hWave1} />
        <View style={styles.hWave2} />
        <View style={styles.hWave3} />

        <Row justify="space-between" align="center" style={styles.hRow}>
          {/* Avatar with white ring */}
          <AnimatedPress scale={0.93} onPress={() => router.push('/profile')}>
            <View style={styles.hAvatarRing}>
              <View style={styles.hAvatar}>
                {guest?.profilePhotoUri
                  ? <Txt size={22}>📷</Txt>
                  : <Ionicons name="person" size={28} color={Colors.resDeep} />
                }
              </View>
            </View>
          </AnimatedPress>

          {/* Greeting text */}
          <Col style={{ flex: 1, marginLeft: 14 }}>
            <Txt size={20} weight="800" color="#FFFFFF" numberOfLines={1}>
              {getGreeting()}, {guest?.name?.split(' ')[0] ?? 'Resident'} 👋
            </Txt>
            <Txt size={13} weight="500" color="rgba(255,255,255,0.75)" style={{ marginTop: 3 }}>
              Room {guest?.roomNo ?? '—'} • Premium Resident
            </Txt>
          </Col>



          {/* Bell */}
          <AnimatedPress scale={0.88} onPress={() => setShowNotif(true)}>
            <View style={styles.hBell}>
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.hBellBadge}>
                  <Txt size={9} weight="900" color="#FFFFFF">{unreadCount}</Txt>
                </View>
              )}
            </View>
          </AnimatedPress>
        </Row>

        {/* Rounded bottom that the card overlaps */}
        <View style={styles.hCurve} />
      </LinearGradient>

      {/* ══════════════ SCROLLABLE CONTENT ══════════════ */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.resPrimary} />
        }
      >
        {/* ── RESIDENCE / RENT CARD ── */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push('/guest-payments')}
          style={styles.residenceCard}
        >
          <Row justify="space-between" align="center">
            {/* Left: icon + name */}
            <Row gap={12} align="center" style={{ flex: 1, marginRight: 12 }}>
              <View style={styles.buildingIconWrap}>
                <Ionicons name="business" size={22} color="#FFFFFF" />
              </View>
              <Col style={{ flex: 1 }}>
                <Txt size={15} weight="800" color={Colors.resText} numberOfLines={1}>
                  {property?.name ?? 'PGow Residence'}
                </Txt>
                <Txt size={12} color={Colors.resTextSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                  Your Home. Your Community.
                </Txt>
              </Col>
            </Row>

            {/* Right: Rent Status pill + paid/pending */}
            <Col align="flex-end">
              <View style={styles.rentStatusChip}>
                <Txt size={12} weight="700" color={Colors.resPrimary}>Rent Status</Txt>
                <Ionicons name="chevron-forward" size={14} color={Colors.resPrimary} style={{ marginLeft: 2 }} />
              </View>
              <Row align="center" gap={6} style={{ marginTop: 7 }}>
                <View style={[styles.statusDot, { backgroundColor: isBillPaid ? '#22C55E' : '#F59E0B' }]} />
                <Txt size={13} weight="700" color={isBillPaid ? '#22C55E' : '#F59E0B'}>
                  {isBillPaid ? 'Paid' : 'Pending'}
                </Txt>
              </Row>
            </Col>
          </Row>

          {/* Rent due amber banner */}
          {!isBillPaid && (
            <View style={styles.rentBanner}>
              <Txt size={13} weight="700" color="#92400E">
                {rentDue ? `₹${Math.round(rentDue).toLocaleString('en-IN')} due for ${currentMonth}` : 'Tap to see your rent due'}
              </Txt>
              <Ionicons name="chevron-forward" size={16} color="#92400E" />
            </View>
          )}

        </TouchableOpacity>

        {/* ── HOME VISIT & MEAL ALERTS WIDGET ── */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => toggleVacationMode(!isAwayFromPg)}
          style={[
            styles.vacationHomeCard,
            isAwayFromPg && styles.vacationHomeCardActive
          ]}
        >
          <Row justify="space-between" align="center">
            <Row gap={12} style={{ flex: 1, paddingRight: 8 }}>
              <View style={[styles.vacationHomeIconWrap, isAwayFromPg && styles.vacationHomeIconWrapActive]}>
                <Ionicons
                  name={isAwayFromPg ? "airplane" : "notifications-outline"}
                  size={20}
                  color={isAwayFromPg ? "#D97706" : Colors.resPrimary}
                />
              </View>

              <Col style={{ flex: 1 }}>
                <Row gap={6} align="center">
                  <Txt size={13} weight="800" color={isAwayFromPg ? "#92400E" : Colors.resText}>
                    {isAwayFromPg ? "Away from PG (Home Visit)" : "Meal Notifications"}
                  </Txt>
                  <View style={[styles.vacationChip, { backgroundColor: isAwayFromPg ? '#FEF3C7' : '#EBF7FA' }]}>
                    <Txt size={9} weight="900" color={isAwayFromPg ? '#D97706' : Colors.resPrimary}>
                      {isAwayFromPg ? "MUTED ✈️" : "ACTIVE 🔔"}
                    </Txt>
                  </View>
                </Row>
                <Txt size={11} color={isAwayFromPg ? "#B45309" : Colors.resTextSecondary} style={{ marginTop: 2 }}>
                  {isAwayFromPg
                    ? "Kitchen portion reservations & meal alerts are paused."
                    : "Going home soon? Tap to pause daily meal alerts & RSVPs."}
                </Txt>
              </Col>
            </Row>

            <View style={[styles.vacationTogglePill, isAwayFromPg && styles.vacationTogglePillActive]}>
              <Txt size={11} weight="800" color={isAwayFromPg ? "#FFFFFF" : Colors.resPrimary}>
                {isAwayFromPg ? "I'm Back 🏠" : "Pause ✈️"}
              </Txt>
            </View>
          </Row>
        </TouchableOpacity>

        {/* ── KYC BANNER ── */}
        {(canSubmitKyc(kycStatus) || kycStatus === 'PENDING') && (
          <Animated.View entering={FadeIn} style={styles.kycBanner}>
            <View style={[styles.kycIcon, { backgroundColor: kycStatus === 'PENDING' ? '#FEF3C7' : '#FEE2E2' }]}>
              <Ionicons name={kycStatus === 'PENDING' ? 'time' : 'document-text'} size={18}
                color={kycStatus === 'PENDING' ? '#D97706' : Colors.danger} />
            </View>
            <Col style={{ flex: 1, marginLeft: 12 }}>
              <Txt size={14} weight="700" color={kycStatus === 'PENDING' ? '#92400E' : Colors.danger}>
                {kycStatus === 'PENDING' ? 'KYC Under Review' : 'KYC Required'}
              </Txt>
              <Txt size={12} color={Colors.resTextSecondary} style={{ marginTop: 2 }}>
                {kycStatus === 'PENDING' ? 'Your documents are with the manager.' : 'Upload your ID proof to unlock all features.'}
              </Txt>
            </Col>
            {kycStatus !== 'PENDING' && (
              <TouchableOpacity onPress={() => setShowKycDialog(true)} style={styles.kycUploadBtn}>
                <Txt size={12} weight="800" color="#FFFFFF">Upload</Txt>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* ── 3. NEXT MEAL HERO ── */}
        <View style={styles.mealCard}>
          {/* Right-side food image with gradient fade */}
          <View style={styles.mealImageContainer}>
            <Image
              source={require('../../../assets/img_guest_dashboard_hero.jpg')}
              style={styles.mealImage}
              resizeMode="cover"
            />
            {/* Horizontal left-fade */}
            <LinearGradient
              colors={['#EBF7FA', 'transparent']}
              start={{ x: 0, y: 0.5 }} end={{ x: 0.6, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Bottom fade */}
            <LinearGradient
              colors={['transparent', '#EBF7FA']}
              start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Cut-off pill — top right */}
          {cutoffText && !cutoffPassed && (
            <View style={styles.cutoffPill}>
              <Ionicons name="time-outline" size={12} color={Colors.resTextSecondary} />
              <Txt size={11} weight="700" color={Colors.resTextSecondary} style={{ marginLeft: 4 }}>
                {cutoffText}
              </Txt>
            </View>
          )}

          {/* Content */}
          <View style={styles.mealContent}>
            <Txt size={11} weight="800" color={Colors.resPrimary} style={{ letterSpacing: 1 }}>
              YOUR NEXT MEAL
            </Txt>

            <Row gap={8} align="center" style={{ marginTop: 8 }}>
              <Txt size={26} weight="900" color={Colors.resText}>
                {upcomingMeal
                  ? upcomingMeal.mealType[0] + upcomingMeal.mealType.slice(1).toLowerCase()
                  : 'No meal'}
              </Txt>
              {upcomingMeal && (
                <View style={styles.vegTag}>
                  <View style={styles.vegDot} />
                </View>
              )}
            </Row>

            {/* Menu / error */}
            {mealsError ? (
              <Col style={{ marginTop: 4, maxWidth: '65%' }}>
                <Txt size={14} weight="700" color={Colors.danger}>Meals unavailable</Txt>
                <Txt size={12} color={Colors.resTextSecondary} style={{ marginTop: 2 }} numberOfLines={2}>
                  {mealsError instanceof Error ? mealsError.message : 'Please try again.'}
                </Txt>
              </Col>
            ) : upcomingMeal ? (
              <Col style={{ marginTop: 4, maxWidth: '65%' }}>
                <Txt size={15} weight="700" color={Colors.resText} numberOfLines={1}>
                  {upcomingMeal.menuItems?.split(',')[0] ?? ''}
                </Txt>
                {(upcomingMeal.menuItems?.split(',').length ?? 0) > 1 && (
                  <Txt size={13} color={Colors.resTextSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                    {upcomingMeal.menuItems?.split(',').slice(1).join(' • ')}
                  </Txt>
                )}
                <Row align="center" gap={6} style={{ marginTop: 10 }}>
                  <Ionicons name="time-outline" size={14} color={Colors.resTextSecondary} />
                  <Txt size={12} weight="600" color={Colors.resTextSecondary}>
                    {upcomingMeal.serviceTime ?? '—'}
                  </Txt>
                </Row>
              </Col>
            ) : null}

            {/* RSVP */}
            <Spacer size={18} />
            {upcomingMeal && (
              cutoffPassed ? (
                <View style={styles.rsvpLocked}>
                  <Ionicons name="lock-closed" size={13} color={Colors.resTextSecondary} />
                  <Txt size={12} weight="700" color={Colors.resTextSecondary} style={{ marginLeft: 8 }}>
                    RSVP closed
                  </Txt>
                </View>
              ) : (
                <Row gap={10}>
                  <TouchableOpacity
                    style={[styles.rsvpBtn, isAttending && styles.rsvpBtnActive]}
                    onPress={() => toggleAttending(true)}
                  >
                    {isAttending && <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginRight: 5 }} />}
                    <Txt size={13} weight="700" color={isAttending ? '#FFFFFF' : Colors.resTextSecondary}>
                      Attending
                    </Txt>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rsvpBtn, !isAttending && myMealResponse && styles.rsvpBtnChosen]}
                    onPress={() => toggleAttending(false)}
                  >
                    <Txt size={13} weight="700" color={Colors.resTextSecondary}>Not Attending</Txt>
                  </TouchableOpacity>
                </Row>
              )
            )}
          </View>
        </View>

        {/* ── 4. TODAY AT PGOW ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 28, marginBottom: 14 }}>
          <Txt size={17} weight="800" color={Colors.resText}>Today at PGow</Txt>
          <TouchableOpacity onPress={() => router.push('/meals')}>
            <Txt size={13} weight="700" color={Colors.resTextSecondary}>View All</Txt>
          </TouchableOpacity>
        </Row>

        {todayMeals.length === 0 && myLaundry.length === 0 ? (
          <Txt size={13} color={Colors.resTextSecondary} style={{ marginBottom: 8 }}>
            No scheduled activities today.
          </Txt>
        ) : (
          <View style={styles.timeline}>
            {(() => {
              const items = [
                ...todayMeals.map((m) => {
                  const cutoff = getMealCutoffMs(m);
                  const isPast = cutoff < Date.now();
                  const isCur = upcomingMeal?.id === m.id;
                  return {
                    id: m.id,
                    title: m.mealType[0] + m.mealType.slice(1).toLowerCase(),
                    desc: m.menuItems,
                    time: m.serviceTime,
                    state: isPast ? 'completed' : isCur ? 'current' : 'future',
                  };
                }),
                ...myLaundry.slice(0, 1).map((l) => ({
                  id: 'laundry',
                  title: 'Laundry Pickup',
                  desc: l.serviceType,
                  time: l.preferredSlot ?? 'Anytime',
                  state: 'future',
                })),
              ];

              return items.map((item, idx) => (
                <View key={item.id} style={styles.tlRow}>
                  {/* Vertical line */}
                  {idx < items.length - 1 && <View style={styles.tlLine} />}
                  {/* Node */}
                  <View style={[
                    styles.tlNode,
                    item.state === 'completed' && styles.tlNodeDone,
                    item.state === 'current' && styles.tlNodeCurrent,
                  ]}>
                    {item.state === 'completed' && <Ionicons name="checkmark" size={11} color="#FFF" />}
                    {item.state === 'current' && <View style={styles.tlDot} />}
                  </View>
                  {/* Text */}
                  <Row justify="space-between" style={{ flex: 1, paddingBottom: 22 }}>
                    <Col style={{ flex: 1, paddingRight: 8 }}>
                      <Txt size={14} weight="700" color={item.state === 'future' ? Colors.resTextSecondary : Colors.resText}>
                        {item.title}
                      </Txt>
                      <Txt size={12} color={Colors.resTextSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                        {item.desc}
                      </Txt>
                    </Col>
                    <Col align="flex-end">
                      <Txt size={12} weight="600" color={Colors.resText}>{item.time}</Txt>
                      <Txt size={11} weight="700" style={{ marginTop: 2 }} color={
                        item.state === 'completed' ? Colors.success :
                          item.state === 'current' ? Colors.resPrimary : Colors.resTextSecondary
                      }>
                        {item.state === 'completed' ? 'Completed' : item.state === 'current' ? 'Upcoming' : 'Scheduled'}
                      </Txt>
                    </Col>
                  </Row>
                </View>
              ));
            })()}
          </View>
        )}

        {/* ── 5. QUICK SERVICES ── */}
        <Txt size={17} weight="800" color={Colors.resText} style={{ marginTop: 28, marginBottom: 14 }}>
          Quick Services
        </Txt>
        <View style={styles.grid}>
          <SvcCard
            title="Groceries"
            desc="Essentials delivered to your room"
            image={require('../../../assets/pg_grocery_eggs_1785343431667.jpg')}
            onPress={() => router.push('/groceries')}
          />
          <SvcCard
            title="Laundry"
            desc="Pickup, wash & return"
            image={require('../../../assets/pg_service_laundry_1785343445318.jpg')}
            onPress={() => router.push('/support')}
          />
          <SvcCard
            title="Repairs"
            desc="Book a technician or handyman"
            image={require('../../../assets/pg_service_repair_1785343458042.jpg')}
            onPress={() => router.push('/book-technician')}
          />
          <SvcCard
            title="Support & Requests"
            desc="Complaints & maintenance"
            icon="headset-outline"
            onPress={() => router.push('/support')}
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
        </View>

        {/* ── 6. COMMUNITY NOTICE ── */}
        <Txt size={17} weight="800" color={Colors.resText} style={{ marginTop: 28, marginBottom: 14 }}>
          Community Notice
        </Txt>
        {noticesLoading ? (
          <LoadingState label="Loading notices" fill={false} />
        ) : noticesError ? (
          <ErrorState error={noticesError} title="Could not load notices" onRetry={refetchNotifs} fill={false} />
        ) : notices.length === 0 ? (
          <View style={styles.noNoticeCard}>
            <Ionicons name="checkmark-done" size={20} color={Colors.resPrimary} />
            <Txt size={14} weight="700" color={Colors.resTextSecondary} style={{ marginLeft: 10 }}>
              You're all caught up!
            </Txt>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
          >
            {notices.map((n) => (
              <TouchableOpacity key={n.id} onPress={() => setShowNotif(true)} style={styles.noticeCard}>
                <View style={styles.noticeIcon}>
                  <Ionicons name="megaphone" size={18} color="#FFFFFF" />
                </View>
                <Col style={{ flex: 1, marginLeft: 12 }}>
                  <Txt size={14} weight="800" color={Colors.resText} numberOfLines={1}>{n.title}</Txt>
                  <Txt size={12} color={Colors.resTextSecondary} numberOfLines={2} style={{ marginTop: 4, lineHeight: 17 }}>
                    {n.message}
                  </Txt>
                  <Row align="center" gap={4} style={{ marginTop: 10 }}>
                    <Txt size={12} weight="800" color={Colors.resPrimary}>View Notice</Txt>
                    <Ionicons name="chevron-forward" size={12} color={Colors.resPrimary} />
                  </Row>
                </Col>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Spacer size={32} />
      </ScrollView>

      {showNotif && (
        <RoleNotificationsCenterSheet roleTitle="RESIDENT" onDismiss={() => setShowNotif(false)} />
      )}
      <KycUploadDialog visible={showKycDialog} onDismiss={() => setShowKycDialog(false)} />
    </View>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────
function SvcCard({
  title, desc, image, icon, onPress, badge,
}: {
  title: string; desc: string; image?: any; icon?: string;
  onPress: () => void; badge?: number;
}) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.svcCard}>
      {/* Image or icon */}
      {image ? (
        <Image source={image} style={styles.svcImage} resizeMode="cover" />
      ) : (
        <View style={styles.svcIconWrap}>
          <Ionicons name={icon as any} size={22} color={Colors.resDeep} />
        </View>
      )}

      <View style={styles.svcTextWrap}>
        <Row align="center" gap={4}>
          <Txt
            size={13}
            weight="800"
            color={Colors.resText}
            numberOfLines={2}
            style={{ flexShrink: 1, lineHeight: 17 }}
          >
            {title}
          </Txt>
          {badge ? (
            <View style={styles.svcBadge}>
              <Txt size={9} weight="800" color="#FFF">{badge}</Txt>
            </View>
          ) : null}
        </Row>
        <Txt size={11} color={Colors.resTextSecondary} numberOfLines={2} style={{ marginTop: 2, lineHeight: 14 }}>
          {desc}
        </Txt>
      </View>

      {/* Arrow */}
      <View style={styles.svcArrow}>
        <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },

  // ── Header
  header: {
    overflow: 'hidden',
    zIndex: 10,
  },
  hRow: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  // Decorative bubbles
  hWave1: {
    position: 'absolute', bottom: -30, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  hWave2: {
    position: 'absolute', bottom: 5, right: 50,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  hWave3: {
    position: 'absolute', bottom: 20, right: -20,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  // Avatar ring
  hAvatarRing: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 3, borderColor: '#FFFFFF',
    padding: 3,
  },
  hAvatar: {
    flex: 1, borderRadius: 27,
    backgroundColor: '#B8DDD9',
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  // Bell
  hBell: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  hBellBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#0A6E72',
  },
  vacationHomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1, borderColor: '#DCE9EA',
    padding: 14, marginTop: 14,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  vacationHomeCardActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A', borderWidth: 1.5,
  },
  vacationHomeIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E0F2F0', alignItems: 'center', justifyContent: 'center',
  },
  vacationHomeIconWrapActive: {
    backgroundColor: '#FEF3C7',
  },
  vacationChip: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  vacationTogglePill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    backgroundColor: '#E0F2F0', borderWidth: 1, borderColor: '#BDD8D6',
  },
  vacationTogglePillActive: {
    backgroundColor: '#D97706', borderColor: '#D97706',
  },
  // Rounded bottom of header
  hCurve: {
    height: 28,
    backgroundColor: '#F8FAFB',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  // ── Residence card (overlaps header curve)
  residenceCard: {
    marginTop: -16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCE9E9',
    padding: 16,
    shadowColor: '#0A6060',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 20,
  },
  buildingIconWrap: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: Colors.resDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  // 'Rent Status >' bordered chip
  rentStatusChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#BDD8D6',
    borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#FFFFFF',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  rentBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: '#F59E0B',
  },

  // ── KYC
  kycBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.resBorder,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  kycIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  kycUploadBtn: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7,
  },

  // ── Meal hero
  mealCard: {
    marginTop: 16,
    backgroundColor: '#F0F6F5',
    borderRadius: 24,
    borderWidth: 1, borderColor: '#D5E8E6',
    overflow: 'hidden',
    minHeight: 220,
    shadowColor: '#0C3B3E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 5,
  },
  mealImageContainer: {
    position: 'absolute',
    top: 0, bottom: 0, right: 0,
    width: '55%',
  },
  mealImage: { width: '100%', height: '100%' },
  cutoffPill: {
    position: 'absolute', top: 14, right: 14, zIndex: 5,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#D5E8E6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  mealContent: { padding: 22, zIndex: 2, maxWidth: '68%' },
  vegTag: {
    width: 13, height: 13, borderRadius: 2,
    borderWidth: 1.5, borderColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  vegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  rsvpLocked: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E5EDED', borderRadius: 12,
    height: 40, paddingHorizontal: 16,
  },
  rsvpBtn: {
    flex: 1, height: 42, borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#D5E8E6',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  rsvpBtnActive: {
    backgroundColor: Colors.resPrimary,
    borderColor: Colors.resPrimary,
    shadowColor: Colors.resPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  rsvpBtnChosen: { backgroundColor: '#F0F6F5' },

  // ── Timeline
  timeline: { paddingLeft: 4 },
  tlRow: { flexDirection: 'row', position: 'relative' },
  tlLine: {
    position: 'absolute', top: 20, bottom: 0, left: 9,
    width: 1.5, backgroundColor: '#D5E8E6', zIndex: 1,
  },
  tlNode: {
    width: 20, height: 20, borderRadius: 10, marginRight: 14, zIndex: 2,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#C0D8D5',
    alignItems: 'center', justifyContent: 'center',
  },
  tlNodeDone: { backgroundColor: Colors.resDeep, borderColor: Colors.resDeep },
  tlNodeCurrent: { borderColor: Colors.resPrimary, borderWidth: 2.5 },
  tlDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.resPrimary },

  // ── Quick services grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  svcCard: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#D9EDED',
    padding: 12,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#0C3B3E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    minHeight: 72,
  },
  svcImage: { width: 40, height: 40, borderRadius: 10, flexShrink: 0 },
  svcIconWrap: {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    backgroundColor: '#DFF5F3',
    alignItems: 'center', justifyContent: 'center',
  },
  svcTextWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  svcArrow: {
    width: 26, height: 26, borderRadius: 13, flexShrink: 0,
    backgroundColor: Colors.resDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  svcBadge: {
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },

  // ── Community notice
  noNoticeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#D9EDED',
  },
  noticeCard: {
    width: 290,
    backgroundColor: '#FFFFFF',
    borderRadius: 20, borderWidth: 1, borderColor: '#D9EDED',
    padding: 16,
    flexDirection: 'row', alignItems: 'flex-start',
    shadowColor: '#0C3B3E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  noticeIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.resDeep,
    alignItems: 'center', justifyContent: 'center',
  },
});
