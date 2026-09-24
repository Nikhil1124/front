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
import { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Txt, Row, Col, Spacer, LoadingState, ErrorState, StatusChip } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Palette, Radii, DeckTints } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { KycUploadDialog } from '@/components/dialogs/KycUploadDialog';
import { useKycStatus, canSubmitKyc } from '@/features/kyc/useKycStatus';
import { loadKycDraft } from '@/features/kyc/kycDraft';
import { serviceImage, useHubServices, useServiceTap } from '@/features/hubServices/useHubServices';
import { ServiceRequestSheet } from '@/features/hubServices/ServiceRequestSheet';
import { useToast } from '@/hooks/useToast';
import { useSetAwayMutation } from '@/features/auth/useAuth';
import type { MealNotificationEntity } from '@/types';
import { currentPeriod, periodToMonthYear } from '@/data/mappers';
import { getGreeting } from '@/utils/format';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useMealsQuery, useMyMealResponseQuery } from '@/features/meals/useMeals';
import { MealAdNotificationCard } from '@/components/NotificationCard/MealAdNotificationCard';
import { useNotificationAdQuery } from '@/features/ads/useAds';
import { useAdReporter } from '@/features/notifications/useMealAdNotifications';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import type { MealNotificationData } from '@/types/notification';
import { useAuthStore } from '@/store/authStore';
import { usePropertyQuery } from '@/features/properties/useProperties';
import { useLaundryRequestsQuery } from '@/features/requests/useComplaints';
import { GateNotice, gateCodeOf } from '@/components/GateNotice';
import { AppHeader, HeaderChip } from '@/components/AppHeader';
import { useDockScroll } from '@/components/HeadlessDockTabButton';

const CUTOFF_HOURS: Record<string, number> = { BREAKFAST: 10, LUNCH: 14, DINNER: 21 };

/** "Cut-off in 2h 15m", or nothing once it has passed — the card shows "RSVP closed" then,
 *  and a countdown next to it would be two ways of saying the same thing. */
function cutoffLabel(ms: number | null): string {
  if (!ms) return '';
  const rem = ms - Date.now();
  if (rem <= 0) return '';
  const mins = Math.floor(rem / 60_000);
  if (mins < 60) return `Cut-off in ${mins}m`;
  return `Cut-off in ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function getMealCutoffMs(m: MealNotificationEntity): number {
  // The server's deadline is what the backend enforces, so it is what the countdown shows.
  // Deriving one locally is what made this screen and the Meals tab disagree by ~2 hours on
  // the same meal — they used different base dates for the same hardcoded hour.
  if (m.responseClosesAt) return m.responseClosesAt;
  const d = new Date(m.timestamp);
  d.setHours(CUTOFF_HOURS[m.mealType.toUpperCase()] ?? 12, 0, 0, 0);
  return d.getTime();
}



export default function GuestHomeTab() {
  const dockScroll = useDockScroll();
  const [showKycDialog, setShowKycDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const guest = usePGowStore((s) => s.loggedInGuest);
  const activePgId = useAuthStore((s) => s.activePgId);
  const submitRSVP = usePGowStore((s) => s.submitRSVP);

  // Away/vacation mode — real, server-side (PATCH /v1/me/away): persists across devices and
  // shows up to staff reading a meal's roster (response.service.roster's `is_away`), not
  // just a flag this one phone remembers.
  const user = useAuthStore((s) => s.user);
  const guestGrant = user?.memberships.find((m) => m.pg_id === activePgId && m.role === 'guest');
  const isAwayFromPg = guestGrant?.is_away ?? false;
  const setAwayMutation = useSetAwayMutation();
  const toast = useToast();

  const toggleVacationMode = useCallback((away: boolean) => {
    setAwayMutation.mutate(away, {
      onSuccess: () => {
        if (away) {
          toast('info', 'Marked as Away ✈️', 'Staff can see you’re away. RSVP "Not Attending" yourself on each meal — this does not do that automatically.');
        } else {
          toast('success', 'Welcome Back! 🏠', "You're marked as home again.");
        }
      },
      onError: () => toast('error', 'Could not update', 'Please try again.') });
  }, [setAwayMutation, toast]);

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

  // Quick Services: the first three live services from PGow's catalog.
  const hubServices = useHubServices();
  const serviceTap = useServiceTap();
  const [leadService, ...sideServices] = hubServices.slice(0, 3);

  // Back on the KYC form if Android killed the app while its camera was open — the app
  // restarts here, and the form's draft says a photo was in progress (see kycDraft.ts).
  const kycSubmittable = canSubmitKyc(kycStatus);
  useEffect(() => {
    if (!kycSubmittable) return;
    loadKycDraft().then((d) => { if (d.pendingSlot) setShowKycDialog(true); }).catch(() => {});
  }, [kycSubmittable]);
  // `guest` is undefined until the profile loads, and `?? false` made that indistinguishable
  // from "not paid" — so every single login flashed "Rent Status: Pending" and a "₹X due"
  // banner before the real (often Paid) status arrived. A wrong financial status, however
  // briefly, is the one thing this card must never show: a resident who glances at it and
  // sees Pending pays twice. `rentKnown` separates "we do not know yet" from "unpaid".
  const rentKnown = guest != null;
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

  const { data: myMealResponse } = useMyMealResponseQuery(upcomingMeal?.id, activePgId ?? undefined);

  // The card's own shape, built from the meal this screen already resolved plus PGow's ad.
  //
  // PGow's, not the property owner's. The owner's sponsor is a banner on the meals tab and
  // earns that owner a share; this is PGow's own inventory, rotated server-side, and it is
  // the only ad that rides a notification. Putting one brand in both places was the bug.
  //
  // Null when there is no meal — the card IS the meal, so there is nothing to render around.
  // The rotation cursor. One number, bumped by anything the resident deliberately does to
  // the card — answering the meal, tapping the sponsor, copying a code, dismissing it — so
  // the next ad arrives between actions rather than swapping under a reader mid-glance.
  const [adSeq, setAdSeq] = useState(0);
  const nextAd = () => setAdSeq((n) => n + 1);
  const { data: sponsor } = useNotificationAdQuery(adSeq);
  const reportAd = useAdReporter();
  const mealCard: MealNotificationData | null = upcomingMeal
    ? {
        id: upcomingMeal.id,
        appLabel: 'PGow',
        mealType: upcomingMeal.mealType.toLowerCase() as MealNotificationData['mealType'],
        title: `Your next meal · ${upcomingMeal.mealType[0]}${upcomingMeal.mealType.slice(1).toLowerCase()}`,
        chefName: upcomingMeal.chefName ?? 'The kitchen',
        menuItems: (upcomingMeal.menuItems ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        createdAt: new Date(upcomingMeal.timestamp).toISOString(),
        dietaryType: upcomingMeal.dietaryType,
        serviceTime: upcomingMeal.serviceTime ?? undefined,
        cutoffLabel: cutoffLabel(cutoffMs) || undefined,
        ad: sponsor
          ? {
              id: sponsor.id,
              brandName: sponsor.brand_name,
              tagline: sponsor.tagline,
              ctaLabel: sponsor.cta_label || undefined,
              imageUrl: sponsor.image_url ?? undefined,
              accentColor: sponsor.accent_color ?? undefined,
              deepLink: sponsor.online_url ?? undefined,
              discountCode: sponsor.discount_code || undefined,
              discountPercent: sponsor.discount_percent || undefined,
              description: sponsor.description || undefined,
              cuisines: sponsor.cuisines || undefined,
              deliveryTime: sponsor.delivery_time || undefined,
            }
          : undefined,
      }
    : null;

  // Refresh countdown every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);


  // ── Today's timeline items ─────────────────────────────────────────────────
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayMeals = meals.filter((m) => new Date(m.timestamp) >= todayStart);
  // These are the labels `mappers.HUB_STATUS.laundry` produces. The filter used to look for
  // 'Open' / 'In Progress' / 'Scheduled', which that table never emits for laundry, so this
  // list was always empty and no laundry pickup ever appeared on the home timeline.
  const myLaundry = laundryRequests.filter(
    (r) => r.guestId === guest?.id && r.status !== 'Delivered' && r.status !== 'Cancelled'
  );

  const notices = roleNotifs.slice(0, 5);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* ══════════════ HEADER ══════════════ */}
      <AppHeader
        eyebrow={`${getGreeting()}, ${guest?.name?.split(' ')[0] ?? 'Resident'}`}
        title={`Room ${guest?.roomNo ?? '—'}`}
        subtitle="Premium Resident"
        leading={
          <AnimatedPress accessibilityLabel="Profile" scale={0.93} onPress={() => router.push('/profile')}>
            <View style={styles.hAvatar}>
              {guest?.profilePhotoUri
                ? <Image source={{ uri: guest.profilePhotoUri }} style={{ width: '100%', height: '100%' }} />
                : <Ionicons name="person" size={20} color={Colors.primary} />
              }
            </View>
          </AnimatedPress>
        }
        actions={
          <Row align="center" gap={8}>
            <HeaderChip
              icon={isAwayFromPg ? "airplane" : "airplane-outline"}
              label={isAwayFromPg ? "Away" : "Home"}
              color={isAwayFromPg ? Colors.warning : Colors.primary}
              bgColor={isAwayFromPg ? Palette.TintAmber : Colors.surfaceElevated}
              onPress={() => toggleVacationMode(!isAwayFromPg)}
            />
            <HeaderChip
              icon="notifications-outline"
              label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              badge={unreadCount > 0}
              onPress={() => router.push('/notifications')}
            />
          </Row>
        }
      />


      {/* ══════════════ SCROLLABLE CONTENT ══════════════ */}
      <ScrollView
        {...dockScroll}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── RESIDENCE / RENT CARD ── */}
        <AnimatedPress accessibilityRole="button"
          onPress={() => router.push('/guest-payments')}
          style={styles.residenceCard}
        >
          <Row justify="space-between" align="center">
            {/* Left: icon + name */}
            <Row gap={12} align="center" style={{ flex: 1, marginRight: 12 }}>
              <View style={styles.buildingIconWrap}>
                <Ionicons name="business" size={22} color={Colors.textInverse} />
              </View>
              <Col style={{ flex: 1 }}>
                <Txt size={15} weight="700" color={Colors.textPrimary} numberOfLines={1}>
                  {property?.name ?? 'PGow Residence'}
                </Txt>
                <Txt size={12} color={Colors.textSecondary} numberOfLines={2} style={{ marginTop: 2 }}>
                  Your Home. Your Community.
                </Txt>
              </Col>
            </Row>

            {/* Right: Rent Status pill + paid/pending */}
            <Col align="flex-end">
              <View style={styles.rentStatusChip}>
                <Txt size={12} weight="700" color={Colors.primary}>Rent Status</Txt>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 2 }} />
              </View>
              <View style={{ marginTop: 7 }}>
                {rentKnown ? (
                  <StatusChip label={isBillPaid ? 'Paid' : 'Pending'} tone={isBillPaid ? 'ok' : 'warn'} />
                ) : (
                  // A neutral placeholder while the real status is in flight — no claim either way.
                  <View style={styles.rentStatusSkeleton} />
                )}
              </View>
            </Col>
          </Row>

          {/* Rent due amber banner — only once the status is actually known. */}
          {rentKnown && !isBillPaid && (
            <View style={styles.rentBanner}>
              <Txt size={13} weight="700" color="#92400E">
                {rentDue ? `₹${Math.round(rentDue).toLocaleString('en-IN')} due for ${currentMonth}` : 'Tap to see your rent due'}
              </Txt>
              <Ionicons name="chevron-forward" size={16} color="#92400E" />
            </View>
          )}

        </AnimatedPress>



        {/* ── KYC BANNER ── */}
        {(canSubmitKyc(kycStatus) || kycStatus === 'PENDING') && (
          <Animated.View entering={FadeIn} style={styles.kycBanner}>
            <View style={[styles.kycIcon, { backgroundColor: kycStatus === 'PENDING' ? Palette.TintAmber : Palette.TintRed }]}>
              <Ionicons name={kycStatus === 'PENDING' ? 'time' : 'document-text'} size={18}
                color={kycStatus === 'PENDING' ? Colors.warning : Colors.danger} />
            </View>
            <Col style={{ flex: 1, marginLeft: 12 }}>
              <Txt size={14} weight="700" color={kycStatus === 'PENDING' ? '#92400E' : Colors.danger}>
                {kycStatus === 'PENDING' ? 'KYC Under Review' : 'KYC Required'}
              </Txt>
              <Txt size={12} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                {kycStatus === 'PENDING' ? 'Your documents are with the manager.' : 'Upload your ID proof to unlock all features.'}
              </Txt>
            </Col>
            {kycStatus !== 'PENDING' && (
              <AnimatedPress accessibilityRole="button" onPress={() => setShowKycDialog(true)} style={styles.kycUploadBtn}>
                <Txt size={12} weight="700" color={Colors.textInverse}>Upload</Txt>
              </AnimatedPress>
            )}
          </Animated.View>
        )}

        {/* ── 3. NEXT MEAL ── */}
        {/* One card, one implementation. This screen and the meals tab each had their own
            hand-rolled meal card with their own Eat/Skip, which is two places to fix a bug
            and two answers that could disagree. `MealAdNotificationCard` is the single one,
            and it carries the property's sponsor in a labelled slot below the decision —
            which is also what retired the standalone ad card that used to sit further down.

            It is seeded from `myMealResponse` rather than assuming unanswered, so it agrees
            with the server on first paint instead of offering a choice already made. */}
        {gateCodeOf(mealsError) ? (
          // A gate is not a failure, it is a step the resident can take — and with the meal
          // card gone there is nothing else on this screen that would say so.
          <View style={{ marginTop: 12, marginBottom: 4 }}>
            <GateNotice error={mealsError} />
          </View>
        ) : null}
        {mealCard && (
          <View style={{ marginTop: 12, marginBottom: 4 }}>
            <MealAdNotificationCard
              data={mealCard}
              currentResponse={
                myMealResponse?.choice === 'eating'
                  ? 'eat'
                  : myMealResponse?.choice === 'skipping'
                    ? 'skip'
                    : null
              }
              rsvpClosed={cutoffPassed}
              onRespond={(payload) => {
                submitRSVP(payload.notificationId, payload.response === 'eat' ? 'REQUIRED' : 'NOT_REQUIRED');
                nextAd();
              }}
              onAdImpression={(ad) => reportAd('impression', ad.id)}
              onAdPress={(ad) => {
                reportAd('click', ad.id);
                if (ad.deepLink) Linking.openURL(ad.deepLink).catch(() => {});
                nextAd();
              }}
              onAdCouponCopy={(ad) => {
                if (!ad.discountCode) return;
                reportAd('coupon_copy', ad.id);
                void Clipboard.setStringAsync(ad.discountCode);
                toast('success', 'Code copied', `${ad.discountCode} is on your clipboard.`);
                nextAd();
              }}
              onAdDismiss={nextAd}
            />
          </View>
        )}

        {/* ── 5. QUICK SERVICES ── */}
        <Txt size={17} weight="700" color={Colors.textPrimary} style={{ marginTop: 28, marginBottom: 14 }}>
          Quick Services
        </Txt>
        {/* The first three live services, in the order the super admin set in the portal —
            the tall tile first. They were hard-coded here; the colours stay by position, and
            a service without an uploaded picture keeps the one it always had. */}
        <View style={styles.bentoGrid}>
          {leadService && (
            <View style={styles.bentoCol}>
              <AnimatedPress
                accessibilityRole="button"
                accessibilityLabel={leadService.title}
                onPress={() => serviceTap.open(leadService)}
                style={[styles.bentoTile, styles.bentoTileTall, { backgroundColor: BENTO_TINTS[0].fill, borderColor: BENTO_TINTS[0].ink }]}
              >
                <Txt style={styles.bentoTileTitleGroceries}>{leadService.title}</Txt>
                {leadService.subtitle ? (
                  <Txt size={13} color={Colors.textSecondary} style={{ marginTop: 4, width: '90%', zIndex: 10, lineHeight: 18 }}>
                    {leadService.subtitle}
                  </Txt>
                ) : null}
                {serviceImage(leadService) && (
                  <Image source={serviceImage(leadService)!} style={[styles.bentoTileImageBg, { width: 240, height: 240, bottom: -45, right: -30 }]} />
                )}
              </AnimatedPress>
            </View>
          )}

          {sideServices.length > 0 && (
            <View style={styles.bentoCol}>
              {sideServices.map((svc, i) => (
                <AnimatedPress
                  key={svc.id}
                  accessibilityRole="button"
                  accessibilityLabel={svc.title}
                  onPress={() => serviceTap.open(svc)}
                  style={[styles.bentoTile, { backgroundColor: BENTO_TINTS[i + 1].fill, borderColor: BENTO_TINTS[i + 1].ink }]}
                >
                  <Txt style={styles.bentoTileTitle}>{svc.title}</Txt>
                  {svc.action === 'laundry' && myLaundry.length > 0 ? (
                    <Txt size={12} weight="700" color={Colors.primary} style={{ marginTop: 2, zIndex: 10, width: '60%' }}>
                      {`${myLaundry.length} active order${myLaundry.length === 1 ? '' : 's'}`}
                    </Txt>
                  ) : svc.action === 'request' && svc.subtitle ? (
                    <Txt size={12} color={Colors.textSecondary} numberOfLines={2} style={{ marginTop: 2, zIndex: 10, width: '60%' }}>
                      {svc.subtitle}
                    </Txt>
                  ) : null}
                  {svc.action === 'support' && unreadCount > 0 && (
                    <View style={styles.bentoBadge}>
                      <Txt size={11} weight="700" color={Colors.textInverse}>{unreadCount}</Txt>
                    </View>
                  )}
                  {serviceImage(svc) && (
                    <Image source={serviceImage(svc)!} style={[styles.bentoTileImageBg, { bottom: -12, right: -15, width: 105, height: 105 }]} />
                  )}
                </AnimatedPress>
              ))}
            </View>
          )}
        </View>

        {/* ── 4. TODAY AT PGOW ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 28, marginBottom: 14 }}>
          <Txt size={17} weight="700" color={Colors.textPrimary}>Today at PGow</Txt>
          <AnimatedPress accessibilityRole="button" onPress={() => router.push('/meals')}>
            <Txt size={13} weight="700" color={Colors.textSecondary}>View All</Txt>
          </AnimatedPress>
        </Row>

        {todayMeals.length === 0 && myLaundry.length === 0 ? (
          <Txt size={13} color={Colors.textSecondary} style={{ marginBottom: 8 }}>
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
                    state: isPast ? 'completed' : isCur ? 'current' : 'future' };
                }),
                ...myLaundry.slice(0, 1).map((l) => ({
                  id: 'laundry',
                  title: 'Laundry Pickup',
                  desc: l.serviceType,
                  time: l.preferredSlot ?? 'Anytime',
                  state: 'future' })),
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
                    {item.state === 'completed' && <Ionicons name="checkmark" size={11} color={Colors.textInverse} />}
                    {item.state === 'current' && <View style={styles.tlDot} />}
                  </View>
                  {/* Text */}
                  <Row justify="space-between" style={{ flex: 1, paddingBottom: 22 }}>
                    <Col style={{ flex: 1, paddingRight: 8 }}>
                      <Txt size={14} weight="700" color={item.state === 'future' ? Colors.textSecondary : Colors.textPrimary}>
                        {item.title}
                      </Txt>
                      <Txt size={12} color={Colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                        {item.desc}
                      </Txt>
                    </Col>
                    <Col align="flex-end">
                      <Txt size={12} weight="600" color={Colors.textPrimary}>{item.time}</Txt>
                      <View style={{ marginTop: 3 }}>
                        <StatusChip
                          variant="dot"
                          label={item.state === 'completed' ? 'Completed' : item.state === 'current' ? 'Upcoming' : 'Scheduled'}
                          tone={item.state === 'completed' ? 'ok' : item.state === 'current' ? 'info' : 'neutral'}
                        />
                      </View>
                    </Col>
                  </Row>
                </View>
              ));
            })()}
          </View>
        )}



        {/* ── 6. COMMUNITY NOTICE ── */}
        <Txt size={17} weight="700" color={Colors.textPrimary} style={{ marginTop: 28, marginBottom: 14 }}>
          Community Notice
        </Txt>
        {noticesLoading ? (
          <LoadingState label="Loading notices" fill={false} />
        ) : noticesError ? (
          <ErrorState error={noticesError} title="Could not load notices" onRetry={refetchNotifs} fill={false} />
        ) : notices.length === 0 ? (
          <View style={styles.noNoticeCard}>
            <Ionicons name="checkmark-done" size={20} color={Colors.primary} />
            <Txt size={14} weight="700" color={Colors.textSecondary} style={{ marginLeft: 10 }}>
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
              <AnimatedPress accessibilityRole="button" key={n.id} onPress={() => router.push('/notifications')} style={styles.noticeCard}>
                <View style={styles.noticeIcon}>
                  <Ionicons name="megaphone" size={18} color={Colors.textInverse} />
                </View>
                <Col style={{ flex: 1, marginLeft: 12 }}>
                  <Txt size={14} weight="700" color={Colors.textPrimary} numberOfLines={1}>{n.title}</Txt>
                  <Txt size={12} color={Colors.textSecondary} numberOfLines={2} style={{ marginTop: 4, lineHeight: 17 }}>
                    {n.message}
                  </Txt>
                  <Row align="center" gap={4} style={{ marginTop: 10 }}>
                    <Txt size={12} weight="700" color={Colors.primary}>View Notice</Txt>
                    <Ionicons name="chevron-forward" size={12} color={Colors.textMuted} />
                  </Row>
                </Col>
              </AnimatedPress>
            ))}
          </ScrollView>
        )}

        <Spacer size={32} />
      </ScrollView>

      <KycUploadDialog visible={showKycDialog} onDismiss={() => setShowKycDialog(false)} />
      <ServiceRequestSheet service={serviceTap.requesting} onDismiss={serviceTap.close} />
    </View>
  );
}



// ─── Styles ───────────────────────────────────────────────────────────────────
/** Quick Services tile colours, by position — the tall tile, then the two beside it. */
const BENTO_TINTS = [DeckTints.amber, DeckTints.slate, DeckTints.green] as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },

  // ── Header
  // Decorative bubbles
  // Avatar ring
  hAvatar: {
    width: 38, height: 38, borderRadius: Radii.pill, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated },
  // Bell
  vacationHomeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1, borderColor: '#DCE9EA',
    padding: 14, marginTop: 14,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  vacationHomeCardActive: {
    backgroundColor: Palette.TintAmber,
    borderColor: Palette.TintAmber, borderWidth: 1.5 },
  vacationHomeIconWrap: {
    width: 40, height: 40, borderRadius: Radii.pill,
    backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center' },
  vacationHomeIconWrapActive: {
    backgroundColor: Palette.TintAmber },
  vacationChip: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.badge },
  vacationTogglePill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.card,
    backgroundColor: Palette.TintGreen, borderWidth: 1, borderColor: '#BDD8D6' },
  vacationTogglePillActive: {
    backgroundColor: Colors.warning, borderColor: Colors.warning },
  // Rounded bottom of header

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  // ── Residence card
  // It used to pull itself up 16px to sit over a curved header. The header is flat now, so
  // that tucked the card's top edge under the header border.
  residenceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    borderWidth: 1,
    borderColor: '#DCE9E9',
    padding: 16,
    shadowColor: '#0A6060',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6 },
  buildingIconWrap: {
    width: 46, height: 46, borderRadius: Radii.card,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center' },
  rentStatusSkeleton: {
    width: 58, height: 20, borderRadius: Radii.badge, backgroundColor: Colors.surfaceElevated },
  // 'Rent Status >' bordered chip
  rentStatusChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#BDD8D6',
    borderRadius: Radii.sheet,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.surface },
  rentBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12,
    backgroundColor: Palette.TintAmber,
    borderRadius: Radii.card,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.warning },

  // ── KYC
  kycBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  kycIcon: { width: 36, height: 36, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center' },
  kycUploadBtn: {
    backgroundColor: Colors.danger,
    borderRadius: Radii.control,
    paddingHorizontal: 14, paddingVertical: 7 },

  // ── Meal hero
  mealCard: {
    marginTop: 16,
    backgroundColor: '#F0F6F5',
    borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#D5E8E6',
    overflow: 'hidden',
    minHeight: 220,
    shadowColor: '#0C3B3E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 5 },
  mealImageContainer: {
    position: 'absolute',
    top: 0, bottom: 0, right: 0,
    width: '55%' },
  mealImage: { width: '100%', height: '100%' },
  cutoffPill: {
    position: 'absolute', top: 14, right: 14, zIndex: 5,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#D5E8E6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  mealContent: { padding: 22, zIndex: 2, maxWidth: '68%' },
  dietTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.control },
  rsvpLocked: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E5EDED', borderRadius: Radii.card,
    height: 40, paddingHorizontal: 16 },
  rsvpBtn: {
    flex: 1, height: 42, borderRadius: Radii.card,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: '#D5E8E6',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rsvpBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  rsvpBtnChosen: { backgroundColor: '#F0F6F5' },

  // ── Timeline
  timeline: { paddingLeft: 4 },
  tlRow: { flexDirection: 'row', position: 'relative' },
  tlLine: {
    position: 'absolute', top: 20, bottom: 0, left: 9,
    width: 1.5, backgroundColor: '#D5E8E6', zIndex: 1 },
  tlNode: {
    width: 20, height: 20, borderRadius: Radii.pill, marginRight: 14, zIndex: 2,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: '#C0D8D5',
    alignItems: 'center', justifyContent: 'center' },
  tlNodeDone: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  tlNodeCurrent: { borderColor: Colors.primary, borderWidth: 2.5 },
  tlDot: { width: 7, height: 7, borderRadius: Radii.pill, backgroundColor: Colors.primary },

  // ── Bento Grid Quick Actions
  bentoGrid: { flexDirection: 'row', gap: 12 },
  bentoCol: { flex: 1, gap: 12 },
  bentoTile: {
    flex: 1, borderRadius: Radii.sheet, padding: 16,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.borderSubtle,
    overflow: 'hidden', position: 'relative', minHeight: 120, justifyContent: 'flex-start'
  },
  bentoTileTall: { flex: 2, minHeight: 180 },
  bentoTileTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, width: '70%', lineHeight: 22, zIndex: 10 },
  bentoTileTitleGroceries: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 4, lineHeight: 28, zIndex: 10 },
  bentoTileImageBg: {
    position: 'absolute', bottom: -47, right: -25, width: 200, height: 200, resizeMode: 'contain',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 16
  },
  bentoBadge: {
    marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radii.pill, backgroundColor: Colors.danger, zIndex: 10
  },

  // ── Community notice
  noNoticeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radii.card,
    padding: 16, borderWidth: 1, borderColor: '#D9EDED' },
  noticeCard: {
    width: 290,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet, borderWidth: 1, borderColor: '#D9EDED',
    padding: 16,
    flexDirection: 'row', alignItems: 'flex-start',
    shadowColor: '#0C3B3E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  noticeIcon: {
    width: 44, height: 44, borderRadius: Radii.card,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center' } });
