/**
 * Guest "Home" tab — the light hub: KYC status banner, next-meal hero card with attending
 * toggle, quick-action tile grid, notices carousel.
 */
import { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Pill, LoadingState, ErrorState } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { KycUploadDialog } from '@/components/dialogs/KycUploadDialog';
import { useKycStatus, canSubmitKyc } from '@/features/kyc/useKycStatus';
import { hapticSelect } from '@/utils/haptics';
import type { MealNotificationEntity } from '@/types';
import { currentPeriod, periodToMonthYear } from '@/data/mappers';

interface QuickTile { label: string; desc: string; icon: keyof typeof Ionicons.glyphMap; tint: string; href: string; }
const QUICK_TILES: QuickTile[] = [
  { label: 'Rent & Receipts',  desc: 'Pay & download PDF',    icon: 'card',            tint: Colors.primary, href: '/guest-payments' },
  { label: 'Maintenance',      desc: 'Raise & track tickets',  icon: 'construct',       tint: Colors.danger,  href: '/support' },
  { label: 'Weekly Menu',      desc: '7-day meal plan',        icon: 'restaurant',       tint: Colors.warning, href: '/meals' },
  { label: 'Profile & KYC',    desc: 'Verify identity',        icon: 'shield-checkmark', tint: Colors.info,    href: '/profile' },
  { label: 'Hub Services',     desc: 'Marketplace & laundry',  icon: 'storefront',       tint: '#9333EA',      href: '/hub-services' },
  { label: 'Groceries',        desc: 'Order fresh essentials', icon: 'cart',             tint: Colors.primary, href: '/groceries' },
  { label: 'Book a Technician', desc: 'Get help with repairs',  icon: 'hammer',           tint: Colors.warning, href: '/book-technician' },
];

// Countdown formatter — returns "⏰ Cut-off in 1h 15m" or "Closed" based on
// the meal's cutoff time. The cutoff hour is hard-coded per meal type, the
// same convention as GuestRSVPsTab.tsx (Breakfast=10, Lunch=14, Dinner=21).
const CUTOFF_HOURS: Record<string, number> = { BREAKFAST: 10, LUNCH: 14, DINNER: 21 };

function nextCutoffMs(mealType: string): number | null {
  const hour = CUTOFF_HOURS[(mealType ?? '').toUpperCase()];
  if (!hour) return null;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(hour, 0, 0, 0);
  // If the cutoff has already passed today, the next one is tomorrow's.
  return cutoff.getTime() < now.getTime() ? cutoff.getTime() + 24 * 60 * 60 * 1000 : cutoff.getTime();
}

function countdownPill(cutoffMs: number | null): { label: string; color: string } {
  if (!cutoffMs) return { label: '', color: Colors.textMuted };
  const remaining = cutoffMs - Date.now();
  if (remaining <= 0) return { label: 'Closed', color: Colors.danger };
  const mins = Math.floor(remaining / 60_000);
  if (mins < 60) return { label: `⏰ Cut-off in ${mins}m`, color: Colors.tertiary };
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return { label: `⏰ Cut-off in ${hrs}h ${remMins}m`, color: Colors.warning };
}

import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useMealsQuery, useMyMealResponseQuery } from '@/features/meals/useMeals';
import { useAuthStore } from '@/store/authStore';

export default function GuestHomeTab() {
  const [showKycDialog, setShowKycDialog] = useState(false);

  const guest = usePGowStore((s) => s.loggedInGuest);
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: roleNotifs = [], refetch: refetchNotifs, isLoading: noticesLoading, error: noticesError } = useRoleNotificationsQuery(activePgId ?? undefined);
  const { data: meals = [], refetch: refetchMeals, error: mealsError } = useMealsQuery(activePgId ?? undefined);
  const submitRSVP = usePGowStore((s) => s.submitRSVP);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchNotifs(), refetchMeals()]);
    setRefreshing(false);
  };

  const kycStatus = useKycStatus();
  const isBillPaid = guest?.isBillPaid ?? false;
  const rentDue = guest?.rentAmount ?? 0;
  const currentMonth = periodToMonthYear(currentPeriod());

  // Pick the next upcoming meal — the first whose specific cutoff hasn't passed yet.
  // Falls back to the most recent meal so the card never renders blank.
  const upcomingMeal: MealNotificationEntity | null = (() => {
    const announced = meals.filter((m) => m.isAlertSent);
    const targetMeals = announced.length > 0 ? announced : meals;
    if (targetMeals.length === 0) return null;

    const withCutoff = targetMeals.map((m) => {
      const serviceDate = new Date(m.timestamp);
      const cutoffHour = CUTOFF_HOURS[m.mealType.toUpperCase()] || 12;
      const cutoffDate = new Date(serviceDate);
      cutoffDate.setHours(cutoffHour, 0, 0, 0);
      return { m, cutoffMs: cutoffDate.getTime() };
    });

    const upcoming = withCutoff.filter(({ cutoffMs }) => cutoffMs > Date.now());
    if (upcoming.length > 0) {
      upcoming.sort((a, b) => a.cutoffMs - b.cutoffMs);
      return upcoming[0].m;
    }

    withCutoff.sort((a, b) => b.cutoffMs - a.cutoffMs);
    return withCutoff[0].m;
  })();

  const getMealCutoffMs = (m: MealNotificationEntity | null): number | null => {
    if (!m) return null;
    const serviceDate = new Date(m.timestamp);
    const cutoffHour = CUTOFF_HOURS[m.mealType.toUpperCase()] || 12;
    const cutoffDate = new Date(serviceDate);
    cutoffDate.setHours(cutoffHour, 0, 0, 0);
    return cutoffDate.getTime();
  };

  const cutoff = getMealCutoffMs(upcomingMeal);
  const cutoffPill = countdownPill(cutoff);
  const cutoffPassed = cutoff ? cutoff - Date.now() <= 0 : false;
  const { data: myMealResponse } = useMyMealResponseQuery(upcomingMeal?.id, activePgId ?? undefined);
  const isAttending = myMealResponse?.choice === 'eating';

  // Re-render every 30s so the countdown pill stays fresh without a
  // background timer. (Lightweight — the component is mounted at all times
  // while the user is on the home tab.)
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleTilePress = (tile: QuickTile) => {
    hapticSelect();
    router.push(tile.href as any);
  };

  const toggleAttending = async () => {
    if (!upcomingMeal) return;
    if (cutoffPassed) {
      Alert.alert('Cut-off passed', 'The cut-off for this meal has passed. Please contact your manager directly.');
      return;
    }
    hapticSelect();
    // The store accepts 'REQUIRED' / 'NOT_REQUIRED' choice values.
    await submitRSVP(upcomingMeal.id, isAttending ? 'NOT_REQUIRED' : 'REQUIRED');
  };

  // Property notices carousel — top 3 notifications rendered as horizontal cards.
  const notices = roleNotifs.slice(0, 3);

  const renderTile = (tile: QuickTile) => (
    <AnimatedPress
      key={tile.label}
      scale={0.96}
      hapticPattern="light"
      onPress={() => handleTilePress(tile)}
      style={styles.tileWrap}
    >
      <View style={styles.tileCard}>
        {/* Icon */}
        <View style={[styles.tileIconBox, { backgroundColor: `${tile.tint}1A` }]}>
          <Ionicons name={tile.icon} size={22} color={tile.tint} />
        </View>
        {/* Text */}
        <View style={{ flex: 1, marginTop: 12 }}>
          <Txt size={14} weight="700" color={Colors.textPrimary} style={styles.tileLabel}>{tile.label}</Txt>
          <Txt size={11} color={Colors.textMuted} style={styles.tileDesc}>{tile.desc}</Txt>
        </View>
        {/* Arrow */}
        <View style={styles.tileArrow}>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </View>
      </View>
    </AnimatedPress>
  );

  return (
    <>
      <Animated.ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, paddingBottom: 32, gap: 20 }}
        showsVerticalScrollIndicator={false}
        entering={FadeIn.duration(180)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Rent status — moved off the header, where it was a third stacked line with no
            tap target. Only shown when something is owed: a resident who is paid up does not
            need a banner telling them so, and the quiet state is the point. */}
        {!isBillPaid && (
          <AnimatedPress
            scale={0.98}
            hapticPattern="light"
            accessibilityLabel="Rent pending — open payments"
            onPress={() => router.push('/guest-payments')}
          >
            <Card
              containerColor={Colors.alertGradientStart}
              borderRadius={Layout.borderRadiusCard}
              borderWidth={1}
              borderColor={Colors.warning}
              padding={[16, 16]}
            >
              <Row justify="space-between" align="center">
                <Row gap={10} align="center" style={{ flex: 1 }}>
                  <View style={styles.bannerIcon}>
                    <Ionicons name="wallet" size={18} color={Colors.warning} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="800" color="#B45309">Rent pending</Txt>
                    <Txt size={11} color="#92400E" style={{ marginTop: 2 }}>
                      {rentDue ? `₹${Math.round(rentDue).toLocaleString('en-IN')} due for ${currentMonth}` : 'Tap to view what you owe this month.'}
                    </Txt>
                  </Col>
                </Row>
                <Ionicons name="chevron-forward" size={18} color="#B45309" />
              </Row>
            </Card>
          </AnimatedPress>
        )}

        {/* KYC Verification Status Banner */}
        {canSubmitKyc(kycStatus) || kycStatus === 'PENDING' ? (
          <Card
            containerColor={kycStatus === 'PENDING' ? Colors.alertGradientStart : '#FEF2F2'}
            borderRadius={Layout.borderRadiusCard}
            borderWidth={1}
            borderColor={kycStatus === 'PENDING' ? Colors.warning : Colors.danger}
            padding={[16, 16]}
          >
            <Row justify="space-between" align="center">
              <Row gap={10} align="center" style={{ flex: 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: kycStatus === 'PENDING' ? '#FEF3C7' : '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={kycStatus === 'PENDING' ? 'time' : 'document-text'} size={18} color={kycStatus === 'PENDING' ? Colors.warning : Colors.danger} />
                </View>
                <Col style={{ flex: 1 }}>
                  <Txt size={16} weight="700" color={kycStatus === 'PENDING' ? Colors.tertiary : Colors.danger}>
                    {kycStatus === 'PENDING' ? 'KYC Under Review' : 'KYC Verification Required'}
                  </Txt>
                  <Txt size={13} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                    {kycStatus === 'PENDING'
                      ? 'Your KYC documents are with the Manager for approval.'
                      : 'Upload ID proof & selfie to get full dashboard access.'}
                  </Txt>
                </Col>
              </Row>
              {kycStatus !== 'PENDING' && (
                <Btn
                  onPress={() => { hapticSelect(); setShowKycDialog(true); }}
                  containerColor={Colors.danger}
                  textColor={Colors.textInverse}
                  borderRadius={8}
                  height={32}
                  contentStyle={{ paddingHorizontal: 12 }}
                >
                  <Txt size={11} weight="800" color={Colors.textInverse}>Upload</Txt>
                </Btn>
              )}
            </Row>
          </Card>
        ) : null}

        {/* Hero next-meal card */}
        <Card
          containerColor={Colors.surface}
          borderRadius={Layout.borderRadiusCard}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
        >
          <Row justify="space-between" align="center">
            <Row gap={8} align="center" style={{ flex: 1 }}>
              <View style={[styles.mealIconBubble, { backgroundColor: Colors.surfaceElevated }]}>
                <Ionicons name="restaurant" size={16} color={Colors.primary} />
              </View>
              <Col style={{ flex: 1 }}>
                <Txt size={12} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>NEXT MEAL</Txt>
                {mealsError ? (
                  // `useMealsQuery` used to fail silently here — `data` defaults to `[]` on
                  // any error, so a guest gated on KYC or unpaid rent (the backend's own
                  // guest_access_state, meal/service.py) saw "No meal scheduled / Menu not
                  // announced yet", indistinguishable from a property with no meals posted.
                  // The Meals tab already surfaces this correctly (GuestRSVPsTab passes the
                  // same error into EmptyState); Home just never looked at it.
                  <>
                    <Txt size={14} weight="700" color={Colors.danger} style={{ marginTop: 4 }}>
                      Meals unavailable
                    </Txt>
                    <Txt size={12} color={Colors.textSecondary} numberOfLines={2} style={{ marginTop: 2 }}>
                      {mealsError instanceof Error ? mealsError.message : 'Please try again.'}
                    </Txt>
                  </>
                ) : (
                  <>
                    <Txt size={16} weight="700" color={Colors.textPrimary} style={{ marginTop: 4 }}>
                      {upcomingMeal?.mealType ? `${upcomingMeal.mealType[0]}${upcomingMeal.mealType.slice(1).toLowerCase()}` : 'No meal scheduled'}
                    </Txt>
                    <Txt size={13} color={Colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                      {upcomingMeal?.menuItems || 'Menu not announced yet'}
                    </Txt>
                  </>
                )}
              </Col>
            </Row>
            {/* Countdown pill — amber when approaching, red when passed */}
            {cutoff ? (
              <Pill label={cutoffPill.label} color={cutoffPill.color} bg={`${cutoffPill.color}1A`} />
            ) : null}
          </Row>

          <Spacer size={12} />
          {/* Attending toggle */}
          <Row gap={10}>
            <Btn
              onPress={toggleAttending}
              containerColor={isAttending ? Colors.success : Colors.surfaceMuted}
              textColor={isAttending ? Colors.textInverse : Colors.textSecondary}
              borderRadius={Layout.borderRadiusButton}
              height={38}
              style={{ flex: 1 }}
              disabled={!upcomingMeal || cutoffPassed}
              testID="guest_attending_toggle"
            >
              <Ionicons name={isAttending ? 'checkmark-circle' : 'radio-button-off'} size={14} color={isAttending ? Colors.textInverse : Colors.textSecondary} />
              <Txt size={12} weight="800" color={isAttending ? Colors.textInverse : Colors.textSecondary} style={{ marginLeft: 6 }}>
                {isAttending ? 'Attending' : 'Not Attending'}
              </Txt>
            </Btn>
            <OutlinedBtn
              onPress={() => router.push('/meals')} // jumps to the Meals tab for full RSVP / menu list
              borderColor={Colors.borderMuted}
              textColor={Colors.primary}
              borderRadius={Layout.borderRadiusButton}
              height={38}
            >
              <Ionicons name="list" size={14} color={Colors.primary} />
              <Txt size={12} weight="800" color={Colors.primary} style={{ marginLeft: 4 }}>All Meals</Txt>
            </OutlinedBtn>
          </Row>
        </Card>

        {/* Quick actions grid (2-column layout using wrap) */}
        <Txt size={17} weight="700" color={Colors.textPrimary} style={{ marginTop: 4 }}>Quick Actions</Txt>
        <View style={styles.tileGrid}>
          {QUICK_TILES.map((tile) => renderTile(tile))}
        </View>

        {/* Notices carousel */}
        <Row justify="space-between" align="center" style={{ marginTop: 4 }}>
          <Txt size={17} weight="700" color={Colors.textPrimary}>Property Notices</Txt>
          <AnimatedPress scale={0.95} onPress={() => router.push('/support')}>
            <Txt size={13} weight="700" color={Colors.primary}>{"View All >"}</Txt>
          </AnimatedPress>
        </Row>
        <Spacer size={2} />
        {noticesLoading ? (
          <LoadingState label="Loading notices…" fill={false} />
        ) : noticesError ? (
          <ErrorState error={noticesError} title="Could not load notices" onRetry={refetchNotifs} fill={false} />
        ) : notices.length === 0 ? (
          <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Row gap={10} align="center">
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Col style={{ flex: 1 }}>
                <Txt size={14} weight="700" color={Colors.textPrimary}>No new notices right now.</Txt>
                <Txt size={13} color={Colors.textSecondary} style={{ marginTop: 2 }}>We'll notify you when there's an update.</Txt>
              </Col>
            </Row>
          </Card>
        ) : (
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
            {notices.map((n) => (
              <Card
                key={n.id}
                containerColor={Colors.surface}
                borderRadius={Layout.borderRadiusCard}
                borderWidth={1}
                borderColor={Colors.borderSubtle}
                padding={[16, 16]}
                style={{ width: 260 }}
              >
                <Row gap={10} align="center">
                  <View style={[styles.noticeIconBubble, { backgroundColor: `${Colors.primary}1A` }]}>
                    <Ionicons name="megaphone" size={14} color={Colors.primary} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={14} weight="700" color={Colors.textPrimary} numberOfLines={1}>{n.title}</Txt>
                    <Txt size={13} color={Colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>{n.message}</Txt>
                  </Col>
                </Row>
              </Card>
            ))}
          </Animated.ScrollView>
        )}
      </Animated.ScrollView>

      <KycUploadDialog
        visible={showKycDialog}
        onDismiss={() => setShowKycDialog(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  mealIconBubble: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileWrap: {
    width: '48.5%',
    marginBottom: 12,
  },
  tileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    minHeight: 120,
  },
  tileIconBox: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  tileLabel: {
    marginBottom: 2,
  },
  tileDesc: {
    lineHeight: 15,
  },
  tileArrow: {
    position: 'absolute',
    bottom: 14,
    right: 14,
  },
  bannerIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FEF3C7',
    alignItems: 'center', justifyContent: 'center',
  },
  noticeIconBubble: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
});
