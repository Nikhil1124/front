/**
 * Guest "Home" tab — the light hub: KYC status banner, next-meal hero card with attending
 * toggle, quick-action tile grid, notices carousel.
 */
import { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, Pill } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { KycUploadDialog } from '@/components/dialogs/KycUploadDialog';
import { hapticSelect } from '@/utils/haptics';
import type { MealNotificationEntity } from '@/types';

interface QuickTile { label: string; desc: string; icon: keyof typeof Ionicons.glyphMap; tint: string; href: string; }
const QUICK_TILES: QuickTile[] = [
  { label: 'Rent & Receipts',  desc: 'Pay • Download PDF',    icon: 'card',            tint: '#0D9488', href: '/guest-payments' },
  { label: 'Maintenance',      desc: 'Raise & track tickets',  icon: 'construct',       tint: '#D97706', href: '/support' },
  { label: 'Weekly Menu',      desc: '7-day menu',            icon: 'restaurant',       tint: '#10B981', href: '/meals' },
  { label: 'Profile & KYC',    desc: 'Verify identity',       icon: 'shield-checkmark', tint: '#0284C7', href: '/profile' },
  { label: 'Hub Services',     desc: 'Marketplace & laundry', icon: 'storefront',       tint: '#9333EA', href: '/hub-services' },
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

export default function GuestHomeTab() {
  const [showKycDialog, setShowKycDialog] = useState(false);

  const guest = usePGowStore((s) => s.loggedInGuest);
  const roleNotifs = usePGowStore((s) => s.currentRoleNotifications);
  // `currentPGNotifications` carries the MealNotificationEntity list (the
  // store's name predates the dashboard rewrite — it's the active PG's
  // meal broadcast notifications, not generic notifications).
  const meals = usePGowStore((s) => s.currentPGNotifications);
  const rsvps = usePGowStore((s) => s.currentRSVPs);
  // The RSVP submission lives on the store — same one used by GuestRSVPsTab.
  // Using it here lets the home card's switch stay in sync with the meals tab.
  const submitRSVP = usePGowStore((s) => s.submitRSVP);

  const kycStatus = guest?.kycStatus ?? 'NOT_SUBMITTED';

  // Pick the next upcoming meal — the first whose cutoff hasn't passed.
  // Falls back to the most recent meal so the card never renders blank.
  const upcomingMeal: MealNotificationEntity | null = (() => {
    if (meals.length === 0) return null;
    const withCutoff = meals.map((m) => ({ m, c: nextCutoffMs(m.mealType) ?? 0 }));
    const upcoming = withCutoff.find(({ c }) => c > Date.now());
    return (upcoming?.m ?? meals[0]) ?? null;
  })();
  const cutoff = upcomingMeal ? nextCutoffMs(upcomingMeal.mealType) : null;
  const cutoffPill = countdownPill(cutoff);
  const cutoffPassed = cutoff ? cutoff - Date.now() <= 0 : false;
  // Has the resident already RSVP'd to this meal? The store carries the
  // full RSVP list; we look for a matching notificationId+guestId pair.
  const isAttending = !!(upcomingMeal && rsvps.find((r) => r.notificationId === upcomingMeal.id && r.guestId === guest?.id && r.choice === 'REQUIRED'));

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

  return (
    <>
      <Animated.ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }}
        showsVerticalScrollIndicator={false}
        entering={FadeIn.duration(180)}
      >
        {/* KYC Verification Status Banner */}
        {kycStatus !== 'VERIFIED' && (
          <Card
            containerColor={kycStatus === 'PENDING' ? '#FFFBEB' : '#FEF2F2'}
            borderRadius={Layout.borderRadiusCard}
            borderWidth={1}
            borderColor={kycStatus === 'PENDING' ? '#FDE68A' : '#FECACA'}
            padding={[14, 14]}
          >
            <Row justify="space-between" align="center">
              <Row gap={10} align="center" style={{ flex: 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: kycStatus === 'PENDING' ? '#FEF3C7' : '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={kycStatus === 'PENDING' ? 'time' : 'document-text'} size={18} color={kycStatus === 'PENDING' ? '#D97706' : '#DC2626'} />
                </View>
                <Col style={{ flex: 1 }}>
                  <Txt size={13} weight="800" color={kycStatus === 'PENDING' ? '#B45309' : '#991B1B'}>
                    {kycStatus === 'PENDING' ? 'KYC Under Review' : 'KYC Verification Required'}
                  </Txt>
                  <Txt size={11} color={kycStatus === 'PENDING' ? '#92400E' : '#7F1D1D'} style={{ marginTop: 2 }}>
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
                  contentStyle={{ paddingHorizontal: 10 }}
                >
                  <Txt size={11} weight="800" color={Colors.textInverse}>Upload</Txt>
                </Btn>
              )}
            </Row>
          </Card>
        )}

        {/* Hero next-meal card */}
        <Card
          containerColor={Colors.surface}
          borderRadius={Layout.borderRadiusCard}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
        >
          <Row justify="space-between" align="flex-start">
            <Col style={{ flex: 1 }}>
              <Row gap={6} align="center">
                <View style={[styles.mealIconBubble, { backgroundColor: Colors.surfaceElevated }]}>
                  <Ionicons name="restaurant" size={16} color={Colors.primary} />
                </View>
                <Txt size={11} weight="700" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>NEXT MEAL</Txt>
              </Row>
              <Txt size={16} weight="800" color={Colors.textPrimary} style={{ marginTop: 8 }}>
                {upcomingMeal?.mealType ? `${upcomingMeal.mealType[0]}${upcomingMeal.mealType.slice(1).toLowerCase()}` : 'No meal scheduled'}
              </Txt>
              <Txt size={12} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                {upcomingMeal?.menuItems || 'Menu not announced yet'}
              </Txt>
            </Col>
            {/* Countdown pill — amber when approaching, red when passed */}
            {cutoff ? (
              <Pill label={cutoffPill.label} color={cutoffPill.color} bg={`${cutoffPill.color}1A`} />
            ) : null}
          </Row>

          <Spacer size={14} />
          {/* Attending toggle */}
          <Row gap={10}>
            <Btn
              onPress={toggleAttending}
              containerColor={isAttending ? Colors.success : Colors.surfaceMuted}
              textColor={isAttending ? Colors.textInverse : Colors.textSecondary}
              borderRadius={Layout.borderRadiusButton}
              height={42}
              style={{ flex: 1 }}
              disabled={!upcomingMeal || cutoffPassed}
              testID="guest_attending_toggle"
            >
              <Ionicons name={isAttending ? 'checkmark-circle' : 'radio-button-off'} size={16} color={isAttending ? Colors.textInverse : Colors.textSecondary} />
              <Txt size={13} weight="700" color={isAttending ? Colors.textInverse : Colors.textSecondary} style={{ marginLeft: 6 }}>
                {isAttending ? 'Attending' : 'Not Attending'}
              </Txt>
            </Btn>
            <OutlinedBtn
              onPress={() => router.push('/meals')} // jumps to the Meals tab for full RSVP / menu list
              borderColor={Colors.borderMuted}
              textColor={Colors.primary}
              borderRadius={Layout.borderRadiusButton}
              height={42}
            >
              <Ionicons name="list" size={14} color={Colors.primary} />
              <Txt size={11} weight="700" color={Colors.primary} style={{ marginLeft: 4 }}>All Meals</Txt>
            </OutlinedBtn>
          </Row>
        </Card>

        {/* Quick tiles grid (2×2) */}
        <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginTop: 4 }}>QUICK ACTIONS</Txt>
        <View style={styles.tileGrid}>
          {QUICK_TILES.map((tile) => (
            <AnimatedPress
              key={tile.label}
              scale={0.96}
              hapticPattern="light"
              onPress={() => handleTilePress(tile)}
              style={{ flex: 1 }}
            >
              <Card
                containerColor={Colors.surface}
                borderRadius={Layout.borderRadiusCard}
                borderWidth={1}
                borderColor={Colors.borderSubtle}
                padding={[14, 14]}
              >
                <View style={[styles.tileIcon, { backgroundColor: `${tile.tint}1A` }]}>
                  <Ionicons name={tile.icon} size={20} color={tile.tint} />
                </View>
                <Txt size={13} weight="800" color={Colors.textPrimary} style={{ marginTop: 10 }}>{tile.label}</Txt>
                <Txt size={10} color={Colors.textMuted} style={{ marginTop: 2 }}>{tile.desc}</Txt>
              </Card>
            </AnimatedPress>
          ))}
        </View>

        {/* Notices carousel */}
        <Txt size={12} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginTop: 6 }}>PROPERTY NOTICES</Txt>
        {notices.length === 0 ? (
          <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Row gap={8} align="center">
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Txt size={12} color={Colors.textMuted}>No new notices right now.</Txt>
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
                padding={[12, 14]}
                style={{ width: 260 }}
              >
                <Row gap={8} align="center">
                  <View style={[styles.noticeIconBubble, { backgroundColor: `${Colors.primary}1A` }]}>
                    <Ionicons name="megaphone" size={14} color={Colors.primary} />
                  </View>
                  <Col style={{ flex: 1 }}>
                    <Txt size={12} weight="800" color={Colors.textPrimary} numberOfLines={1}>{n.title}</Txt>
                    <Txt size={10} color={Colors.textMuted} numberOfLines={1}>{n.message}</Txt>
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
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  noticeIconBubble: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
});
