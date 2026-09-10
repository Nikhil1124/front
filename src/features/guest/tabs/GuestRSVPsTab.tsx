/**
 * GuestRSVPsTab — redesigned to match the premium Meals screen reference while
 * retaining 100% of existing functionality, persistent meal preferences, ad cards,
 * allergen breakdowns, and state management.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, ScrollView, StyleSheet, Image,
  RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueries } from '@tanstack/react-query';

import { InfoTip } from '@/components/ui/InfoTip';
import { MealToggleWidget } from '@/components/MealToggleWidget';
import { FeaturedMonetizedAdCard } from '@/components/FeaturedMonetizedAdCard';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { formatTime12h } from '@/utils/format';
import type { MealNotificationEntity, MealToggleState } from '@/types';
import { useMealsQuery, getMyResponse } from '@/features/meals/useMeals';
import { useAuthStore } from '@/store/authStore';
import { qk } from '@/data/queryKeys';
import { useSetAwayMutation } from '@/features/auth/useAuth';
import { GateNotice, gateCodeOf } from '@/components/GateNotice';
import { AppHeader, HeaderChip } from '@/components/AppHeader';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { AnimatedPress, Card, Col, Row, Sheet, Spacer, StatusChip, Txt, type StatusTone } from '@/components/ui';


const MEAL_PREF_KEY = '@pgow/meal_preferences';
const CUTOFF_HOURS: Record<'breakfast' | 'lunch' | 'dinner', number> = {
  breakfast: 8,
  lunch: 12,
  dinner: 19 };

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCutoffMs(mealType: string): number {
  const key = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
  const h = CUTOFF_HOURS[key] ?? 12;
  const d = new Date(); d.setHours(h, 0, 0, 0);
  return d.getTime();
}

function cutoffLabel(ms: number): string {
  const rem = ms - Date.now();
  if (rem <= 0) return 'Closed';
  const mins = Math.floor(rem / 60_000);
  if (mins < 60) return `Cut-off ${mins}m`;
  return `Cut-off ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** Chef-confirmed only (`MealNotificationEntity.dietaryType`) — null renders nothing. */
const DIETARY_TAG: Record<'veg' | 'non_veg' | 'pure_veg', { label: string; color: string; bg: string }> = {
  veg: { label: '🥦 VEG', color: '#15803D', bg: '#DCFCE7' },
  non_veg: { label: '🍗 NON-VEG', color: Colors.danger, bg: Palette.TintRed },
  pure_veg: { label: '🥗 PURE VEG', color: Colors.success, bg: '#DCFCE7' } };

function buildWeekDays(): { label: string; short: string; date: number; isToday: boolean; full: Date }[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    result.push({
      label: i === 0 ? 'Today' : days[d.getDay()],
      short: days[d.getDay()],
      date: d.getDate(),
      isToday: i === 0,
      full: d });
  }
  return result;
}

/** "28 Aug – 3 Sep 2026" across a month boundary, "1 – 7 Sep 2026" within one — never a
 *  fixed string, which used to read "Sep 2025" no matter what the real dates were. */
function weekRangeLabel(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const year = end.getFullYear();
  return startMonth === endMonth
    ? `${start.getDate()} – ${end.getDate()} ${endMonth} ${year}`
    : `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${year}`;
}

const MEAL_TABS: { key: string; label: string; icon: any; time: string }[] = [
  { key: 'BREAKFAST', label: 'Breakfast', icon: 'sunny-outline', time: '7:30 AM – 9:00 AM' },
  { key: 'LUNCH',     label: 'Lunch',     icon: 'restaurant-outline', time: '12:30 PM – 2:00 PM' },
  { key: 'DINNER',    label: 'Dinner',    icon: 'moon-outline', time: '8:00 PM – 9:30 PM' },
];

// ── Component ──────────────────────────────────────────────────────────────────
export function GuestRSVPsTab() {
  const dockScroll = useDockScroll();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: notifications = [], isLoading, error: mealsError } = useMealsQuery(activePgId ?? undefined);
  const submitRSVP = usePGowStore((s) => s.submitRSVP);
  const formatServiceTime12h = usePGowStore((s) => s.formatServiceTime12h);
  const getAlertTriggerTime = usePGowStore((s) => s.getAlertTriggerTime);
  const toast = useToast();
  const { refreshing, onRefresh } = usePullToRefresh();

  const [rsvpChoices, setRsvpChoices] = useState<Record<string, 'REQUIRED' | 'NOT_REQUIRED'>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [activeMealTab, setActiveMealTab] = useState('LUNCH');
  const [selectedDay, setSelectedDay] = useState(0);
  const [detailMeal, setDetailMeal] = useState<MealNotificationEntity | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  // The preferences panel renders well below the fold, while the button that opens it lives
  // in the header. Toggling a boolean therefore looked like nothing happening — the panel had
  // appeared, several screens down, with no reason for the reader to scroll and find out.
  // Opening it from the header now takes you to it.
  const scrollRef = useRef<ScrollView>(null);
  const prefsY = useRef(0);
  const openPreferences = () => {
    const next = !showPreferences;
    setShowPreferences(next);
    if (next) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, prefsY.current - 12), animated: true });
      });
    }
  };

  // Persistent B/L/D Opt-In preferences (local-only — see setMealPreference below)
  const [mealPrefs, setMealPrefs] = useState<{ breakfast: boolean; lunch: boolean; dinner: boolean }>({
    breakfast: true,
    lunch: true,
    dinner: true });

  // Away/vacation mode — real, server-side (PATCH /v1/me/away): persists across devices and
  // shows up to staff reading a meal's roster (response.service.roster's `is_away`).
  const user = useAuthStore((s) => s.user);
  const guestGrant = user?.memberships.find((m) => m.pg_id === activePgId && m.role === 'guest');
  const isAwayFromPg = guestGrant?.is_away ?? false;
  const setAwayMutation = useSetAwayMutation();

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

  useEffect(() => {
    AsyncStorage.getItem(MEAL_PREF_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          setMealPrefs({
            breakfast: !!parsed.breakfast,
            lunch: !!parsed.lunch,
            dinner: !!parsed.dinner });
        } catch { /* best-effort */ }
      })
      .catch(() => {});
  }, []);

  const setMealPreference = useCallback(
    (mealType: 'breakfast' | 'lunch' | 'dinner', enabled: boolean) => {
      setMealPrefs((cur) => {
        const next = { ...cur, [mealType]: enabled };
        AsyncStorage.setItem(MEAL_PREF_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      // A personal default only — it is not sent anywhere, so it must not claim the kitchen
      // acts on it. The real signal the kitchen sees is an actual RSVP on a posted meal.
      toast('success', enabled ? `Opted in to ${mealType}` : `Opted out of ${mealType}`, 'Saved as your personal default — RSVP on each meal to actually notify the kitchen.');
    },
    [toast],
  );

  const buildMealToggleState = useCallback(
    (mealType: 'breakfast' | 'lunch' | 'dinner'): MealToggleState => {
      const notif = notifications.find((n) => n.mealType.toUpperCase() === mealType.toUpperCase());
      const cutoffHour = CUTOFF_HOURS[mealType];
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setHours(cutoffHour, 0, 0, 0);
      const nextCutoffMs = cutoff.getTime() < now.getTime() ? cutoff.getTime() + 24 * 60 * 60 * 1000 : cutoff.getTime();
      const cutoffTimeStr = `${String(cutoffHour).padStart(2, '0')}:00`;
      return {
        enabled: mealPrefs[mealType],
        cutoffTime: cutoffTimeStr,
        nextCutoffMs,
        menuSummary: notif?.menuItems ?? '' };
    },
    [mealPrefs, notifications],
  );

  // Tick every 30s to update cut-off countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const weekDays = buildWeekDays();

  // Each meal's REAL response from the server — `rsvpChoices` above is only this-session's
  // optimistic taps, and used to be the sole source of truth, which meant a meal you already
  // RSVP'd to (from the Home tab, or an earlier visit here) showed as "Not Decided" until
  // tapped again in THIS screen. `refreshAll()` (called after every RSVP) invalidates the
  // whole query cache, so these refetch automatically once a response changes.
  const myResponseQueries = useQueries({
    queries: notifications.map((n) => ({
      queryKey: qk.meals.myResponse(activePgId ?? '', n.id),
      queryFn: () => getMyResponse(n.id),
      enabled: !!activePgId })) });
  const serverRsvpChoices = useMemo(() => {
    const map: Record<string, 'REQUIRED' | 'NOT_REQUIRED'> = {};
    notifications.forEach((n, i) => {
      const choice = myResponseQueries[i]?.data?.choice;
      if (choice === 'eating') map[n.id] = 'REQUIRED';
      else if (choice === 'skipping') map[n.id] = 'NOT_REQUIRED';
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, myResponseQueries.map((q) => q.data).join('|')]);
  // This-session taps win immediately (no round trip to wait for); the server view fills in
  // everything else, including meals RSVP'd to before this screen was ever opened.
  const effectiveChoices = { ...serverRsvpChoices, ...rsvpChoices };

  // Active meal for the selected tab
  const activeMealNotif = notifications.find(
    (n) => n.mealType.toUpperCase() === activeMealTab
  ) ?? null;
  // The server's own deadline first. `getCutoffMs` derives one from the meal TYPE against
  // today's date, while home.tsx derived it from the MEAL's date — two different answers for
  // the same meal, roughly two hours apart, and neither was the number the backend enforces.
  // `response_closes_at` is that number. The heuristic remains only for a meal with no
  // deadline set.
  const cutoffMs = activeMealNotif
    ? activeMealNotif.responseClosesAt ?? getCutoffMs(activeMealNotif.mealType)
    : null;
  const cutoffPassed = cutoffMs ? cutoffMs <= Date.now() : false;

  const currentChoice = activeMealNotif ? effectiveChoices[activeMealNotif.id] : undefined;
  const isAttending = currentChoice === 'REQUIRED';
  const isSkipping = currentChoice === 'NOT_REQUIRED';

  const totalMealsCount = notifications.length;
  const answeredMealsCount = notifications.filter((n) => effectiveChoices[n.id] !== undefined).length;

  const handleRSVP = useCallback(
    async (id: string, choice: 'REQUIRED' | 'NOT_REQUIRED') => {
      if (submittingId) return;
      setSubmittingId(id);
      try {
        const result = await submitRSVP(id, choice);
        if (result.ok) {
          setRsvpChoices((prev) => ({ ...prev, [id]: choice }));
          toast('success', choice === 'REQUIRED' ? "You're attending!" : 'Marked as not attending', 'Your portion status updated.');
        } else {
          // A rejected RSVP used to end here in silence: no toast, no button state, and the
          // "N of 3 Decided" counter unmoved — while the request had genuinely reached the
          // server and been refused (a passed cut-off returns an error, and every meal on a
          // test property had one in the past). The resident could not tell the difference
          // between "saved" and "refused", so they tapped again and again.
          toast('error', 'Could not save your answer', result.error ?? 'Please try again.');
        }
      } finally { setSubmittingId(null); }
    },
    [submittingId, submitRSVP, toast],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── 1. HEADER ── */}
      <AppHeader
        title="Meals"
        subtitle="Eat well. Stay healthy."
        actions={
          <Row gap={8}>
            <HeaderChip icon="options-outline" label="Meal preferences" onPress={openPreferences} />
            <HeaderChip icon="calendar-outline" label="Choose a date" onPress={() => { toast('info', 'Not Available Yet', 'A weekly meal calendar is coming soon.'); }} />
          </Row>
        }
      />

      <ScrollView
        ref={scrollRef}
        {...dockScroll}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          style={[styles.dayStrip, { marginHorizontal: -16 }]}
          contentContainerStyle={[styles.dayStripContent, { paddingHorizontal: 16 }]}
        >
          {weekDays.map((d, i) => (
            <AnimatedPress accessibilityRole="button"
              key={i}
              onPress={() => setSelectedDay(i)}
              style={[styles.dayPill, selectedDay === i && styles.dayPillActive]}
            >
              {d.isToday && (
                <Txt size={9} weight="700" color={selectedDay === i ? Colors.textInverse : Colors.primary} style={{ letterSpacing: 0.5 }}>
                  Today
                </Txt>
              )}
              <Txt size={11} weight="600" color={selectedDay === i ? 'rgba(255,255,255,0.75)' : Colors.textSecondary}>
                {d.isToday ? d.short : d.label}
              </Txt>
              <Txt size={17} weight="700" color={selectedDay === i ? Colors.textInverse : Colors.textPrimary}>
                {String(d.date).padStart(2, '0')}
              </Txt>
            </AnimatedPress>
          ))}
          {/* Weekly View button */}
          <AnimatedPress accessibilityRole="button"
            style={styles.weeklyViewBtn}
            onPress={() => { toast('info', 'Not Available Yet', 'A 7-day meal overview is coming soon.'); }}
          >
            <Ionicons name="calendar" size={16} color={Colors.primary} />
            <Txt size={10} weight="700" color={Colors.primary} style={{ marginTop: 4, textAlign: 'center' }}>
              Weekly{'\n'}View
            </Txt>
          </AnimatedPress>
        </ScrollView>

        {/* Optional: Persistent Preferences Widget when toggled or top section */}
        {showPreferences && (
          <View style={styles.prefsWrapper} onLayout={(e) => { prefsY.current = e.nativeEvent.layout.y; }}>
            <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
              <Row gap={6} align="center">
                <Ionicons name="restaurant" size={16} color={Colors.primary} />
                <Txt size={14} weight="700" color={Colors.textPrimary}>Default Daily Meal Preferences</Txt>
              </Row>
              <InfoTip text="Toggle each meal on/off as a personal reminder for today. This is saved on your device only — RSVP on the actual posted meal to let the kitchen know." />
            </Row>
            <MealToggleWidget
              breakfast={buildMealToggleState('breakfast')}
              lunch={buildMealToggleState('lunch')}
              dinner={buildMealToggleState('dinner')}
              onToggle={setMealPreference}
            />
            {/* Vacation Mode / Away from PG toggle */}
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#DCE9EA' }}>
              <Row justify="space-between" align="center">
                <Row gap={10} style={{ flex: 1 }}>
                  <Ionicons name="airplane-outline" size={18} color={Colors.primary} />
                  <Col style={{ flex: 1 }}>
                    <Txt size={13} weight="700" color={Colors.textPrimary}>Away from PG / Vacation Mode</Txt>
                    <Txt size={10} color={Colors.textSecondary} style={{ marginTop: 2 }}>
                      Staff can see this on the roster. It doesn't change your notifications or auto-submit RSVPs.
                    </Txt>
                  </Col>
                </Row>
                <AnimatedPress accessibilityRole="button"
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.card,
                    backgroundColor: isAwayFromPg ? Palette.TintAmber : Palette.TintGreen,
                    borderWidth: 1, borderColor: isAwayFromPg ? Palette.TintAmber : '#BDD8D6' }}
                  onPress={() => toggleVacationMode(!isAwayFromPg)}
                >
                  <Txt size={11} weight="700" color={isAwayFromPg ? Colors.warning : Colors.primary}>
                    {isAwayFromPg ? 'AWAY ✈️' : 'HOME 🏠'}
                  </Txt>
                </AnimatedPress>
              </Row>
            </View>
          </View>
        )}

        {/* Vacation Mode Active Banner */}
        {isAwayFromPg && (
          <Card containerColor={Palette.TintAmber} borderRadius={Radii.card} borderWidth={1.5} borderColor={Palette.TintAmber} padding={[14, 14]} style={{ marginBottom: 14 }}>
            <Row justify="space-between" align="center">
              <Row gap={10} style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: Radii.pill, backgroundColor: Palette.TintAmber, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="airplane" size={20} color={Colors.warning} />
                </View>
                <Col style={{ flex: 1 }}>
                  <Row gap={6} align="center">
                    <Txt size={14} weight="700" color="#92400E">Away from PG (Home Visit)</Txt>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.badge, backgroundColor: Palette.TintAmber }}>
                      <Txt size={9} weight="700" color={Colors.warning}>NOTED</Txt>
                    </View>
                  </Row>
                  <Txt size={11} color={Colors.warning} style={{ marginTop: 2, lineHeight: 15 }}>
                    Staff can see you're away. Notifications keep coming and the kitchen still plans for you — RSVP "Not Attending" on each meal yourself.
                  </Txt>
                </Col>
              </Row>
              <AnimatedPress accessibilityRole="button"
                style={{ backgroundColor: Colors.warning, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.control }}
                onPress={() => toggleVacationMode(false)}
              >
                <Txt size={11} weight="700" color={Colors.textInverse}>I'm Back 🏠</Txt>
              </AnimatedPress>
            </Row>
          </Card>
        )}

        {/* ── 3. RSVP BANNER ── */}
        <View style={styles.rsvpBanner}>
          <View style={styles.rsvpBannerIcon}>
            <Ionicons name="restaurant-outline" size={20} color={Colors.primaryDark} />
          </View>
          <Col style={{ flex: 1, marginLeft: 12 }}>
            <Row gap={4} align="center">
              <Txt size={13} weight="700" color={Colors.textPrimary}>RSVP helps us serve better</Txt>
              <InfoTip text="Chefs prepare meals based on precise responses. Tap a meal card to view nutrition details & RSVP!" />
            </Row>
            <Txt size={11} color={Colors.textSecondary} style={{ marginTop: 2 }}>
              Please confirm your meals before the cut-off time.
            </Txt>
          </Col>
          <AnimatedPress accessibilityRole="button" onPress={() => setShowPreferences(!showPreferences)}>
            <Txt size={12} weight="700" color={Colors.primary}>
              {showPreferences ? 'Hide Prefs' : 'How RSVP works >'}
            </Txt>
          </AnimatedPress>
        </View>

        <FeaturedMonetizedAdCard />
        <Spacer size={12} />

        {/* ── 4. MEAL TYPE TABS ── */}
        <Row style={styles.tabRow} gap={8}>
          {MEAL_TABS.map((tab) => {
            const active = activeMealTab === tab.key;
            return (
              <AnimatedPress accessibilityState={{ selected: !!active }} accessibilityRole="button"
                key={tab.key}
                onPress={() => { setActiveMealTab(tab.key); }}
                style={[styles.tabPill, active && styles.tabPillActive]}
              >
                <Ionicons name={tab.icon} size={15} color={active ? Colors.textInverse : Colors.textSecondary} />
                <Col style={{ marginLeft: 6 }}>
                  <Txt size={12} weight="700" color={active ? Colors.textInverse : Colors.textPrimary}>{tab.label}</Txt>
                  <Txt size={10} color={active ? 'rgba(255,255,255,0.75)' : Colors.textSecondary}>{tab.time}</Txt>
                </Col>
              </AnimatedPress>
            );
          })}
        </Row>

        {/* ── 5. MEAL HERO CARD ── */}
        <AnimatedPress accessibilityRole="button" onPress={() => activeMealNotif && setDetailMeal(activeMealNotif)} style={styles.heroCard}>
          {/* Food image - right */}
          <View style={styles.heroImageWrap}>
            <Image
              source={require('../../../../assets/img_guest_dashboard_hero.webp')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={[Colors.surface, 'transparent']}
              start={{ x: 0, y: 0.5 }} end={{ x: 0.55, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['transparent', Colors.surface]}
              start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Top badges */}
          <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
            <View style={styles.upcomingBadge}>
              <Txt size={11} weight="700" color={Colors.primary}>Upcoming</Txt>
            </View>
            {cutoffMs && !cutoffPassed && (
              <Row align="center" gap={5}>
                <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                <Txt size={12} weight="700" color={Colors.textSecondary}>{cutoffLabel(cutoffMs)}</Txt>
              </Row>
            )}
          </Row>

          {/* Meal name */}
          <Row align="center" gap={8}>
            <Txt size={30} weight="700" color={Colors.textPrimary}>
              {activeMealNotif
                ? activeMealNotif.mealType[0] + activeMealNotif.mealType.slice(1).toLowerCase()
                : 'No meal'}
            </Txt>
            {activeMealNotif && (
              <View style={styles.vegDotWrap}>
                <View style={styles.vegDot} />
              </View>
            )}
          </Row>

          {/* Menu items */}
          {activeMealNotif ? (
            <Col style={{ marginTop: 6, maxWidth: '62%' }}>
              <Txt size={15} weight="700" color={Colors.textPrimary} numberOfLines={1}>
                {activeMealNotif.menuItems?.split(',')[0] ?? ''}
              </Txt>
              {(activeMealNotif.menuItems?.split(',').length ?? 0) > 1 && (
                <Txt size={12} color={Colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                  {activeMealNotif.menuItems?.split(',').slice(1).join(' · ')}
                </Txt>
              )}
              {activeMealNotif.serviceTime && (
                <Row align="center" gap={6} style={{ marginTop: 10 }}>
                  <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                  <Txt size={12} weight="600" color={Colors.textSecondary}>
                    {formatServiceTime12h(activeMealNotif.serviceTime)}
                  </Txt>
                </Row>
              )}
            </Col>
          ) : (
            <Txt size={13} color={Colors.textSecondary} style={{ marginTop: 6, maxWidth: '60%' }}>
              No menu posted yet for this slot.
            </Txt>
          )}

          <Spacer size={16} />

          {/* RSVP buttons */}
          {activeMealNotif && (
            cutoffPassed ? (
              <View style={styles.rsvpClosed}>
                <Ionicons name="lock-closed" size={14} color={Colors.textSecondary} />
                <Txt size={13} weight="700" color={Colors.textSecondary} style={{ marginLeft: 8 }}>RSVP window closed</Txt>
              </View>
            ) : (
              <Row gap={12}>
                <AnimatedPress accessibilityRole="button"
                  style={[styles.attendBtn, isAttending && styles.attendBtnActive]}
                  onPress={() => handleRSVP(activeMealNotif.id, 'REQUIRED')}
                  disabled={!!submittingId}
                >
                  {isAttending && <Ionicons name="checkmark" size={15} color={Colors.textInverse} style={{ marginRight: 5 }} />}
                  <Txt size={13} weight="700" color={isAttending ? Colors.textInverse : Colors.textPrimary}>
                    {isAttending ? "I'll Attend" : "I'll Attend"}
                  </Txt>
                </AnimatedPress>
                <AnimatedPress accessibilityRole="button"
                  style={[styles.skipBtn, isSkipping && styles.skipBtnActive]}
                  onPress={() => handleRSVP(activeMealNotif.id, 'NOT_REQUIRED')}
                  disabled={!!submittingId}
                >
                  <Txt size={13} weight="700" color={isSkipping ? Colors.textInverse : Colors.textSecondary}>
                    Not Attending
                  </Txt>
                </AnimatedPress>
              </Row>
            )
          )}

          {/* Dot indicator */}
          <Row justify="center" gap={6} style={{ marginTop: 16 }}>
            {MEAL_TABS.map((t) => (
              <View key={t.key} style={[styles.dotInd, activeMealTab === t.key && styles.dotIndActive]} />
            ))}
          </Row>
        </AnimatedPress>

        {/* Decision progress */}
        {totalMealsCount > 0 && (
          <View style={styles.progressBox}>
            <Row justify="space-between" align="center">
              <Txt size={12} weight="700" color={Colors.textPrimary}>Decision Progress</Txt>
              <Txt size={12} weight="700" color={answeredMealsCount === totalMealsCount ? Colors.success : Colors.primary}>
                {answeredMealsCount} of {totalMealsCount} Decided
              </Txt>
            </Row>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(answeredMealsCount / totalMealsCount) * 100}%` }]} />
            </View>
          </View>
        )}

        {/* ── 6. WEEKLY MENU ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 24, marginBottom: 16 }}>
          <Txt size={17} weight="700" numberOfLines={1} color={Colors.textPrimary} style={{ flex: 1, minWidth: 0 }}>Weekly Menu</Txt>
          <Row align="center" gap={4}>
            <Txt size={12} color={Colors.textSecondary}>
              {weekRangeLabel(weekDays[0].full, weekDays[6].full)}
            </Txt>
            <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
          </Row>
        </Row>

        {/* Day row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          style={{ marginHorizontal: -16 }}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}
        >
          {weekDays.map((d, i) => (
            <AnimatedPress accessibilityRole="button" key={i} onPress={() => setSelectedDay(i)}>
              <Col align="center" style={{ width: 38 }}>
                <Txt size={11} weight="600" color={Colors.textSecondary}>{d.label.slice(0, 3).toUpperCase()}</Txt>
                <View style={[styles.weekDayCircle, selectedDay === i && styles.weekDayCircleActive]}>
                  <Txt size={13} weight="700" color={selectedDay === i ? Colors.textInverse : Colors.textPrimary}>
                    {String(d.date).padStart(2, '0')}
                  </Txt>
                </View>
              </Col>
            </AnimatedPress>
          ))}
        </ScrollView>

        {/* Meal rows */}
        {/* The gate check comes first, and before the empty state: a gated resident gets an
            empty list from a 403, not from an empty kitchen, and telling them "No meals
            posted yet" is both untrue and a dead end. */}
        {gateCodeOf(mealsError) ? (
          <GateNotice error={mealsError} />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="restaurant-outline" size={28} color={Colors.textSecondary} />
            <Txt size={14} weight="700" color={Colors.textSecondary} style={{ marginTop: 12 }}>
              {isLoading ? 'Loading meals...' : 'No meals posted yet.'}
            </Txt>
          </View>
        ) : (
          <View style={styles.mealListCard}>
            {notifications.map((n, idx) => {
              const choice = effectiveChoices[n.id];
              const isEat = choice === 'REQUIRED';
              const isSkip = choice === 'NOT_REQUIRED';
              const lowerType = n.mealType.toLowerCase();
              const icon = lowerType === 'breakfast' ? 'sunny-outline' : lowerType === 'dinner' ? 'moon-outline' : 'restaurant-outline';
              const isLast = idx === notifications.length - 1;

              // Skipping is a valid answer, not a failure — it reads `neutral`, not danger.
              // Only "Not decided" past the cutoff is actually something to act on.
              const isUpcoming = !choice && getCutoffMs(n.mealType) > Date.now();
              const status: { label: string; tone: StatusTone } =
                isEat ? { label: 'Attending', tone: 'ok' }
                : isSkip ? { label: 'Skipping', tone: 'neutral' }
                : isUpcoming ? { label: 'Upcoming', tone: 'info' }
                : { label: 'Not decided', tone: 'warn' };

              return (
                <AnimatedPress accessibilityRole="button"
                  key={n.id}
                  onPress={() => setDetailMeal(n)}
                  style={[styles.mealRow, !isLast && styles.mealRowBorder]}
                >
                  <View style={styles.mealRowIcon}>
                    <Ionicons name={icon} size={18} color={Colors.primaryDark} />
                  </View>
                  <Col style={{ flex: 1, marginLeft: 12 }}>
                    <Txt size={14} weight="700" color={Colors.textPrimary}>{n.mealType[0] + n.mealType.slice(1).toLowerCase()}</Txt>
                    <Txt size={12} color={Colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                      {n.menuItems ?? '—'}
                    </Txt>
                  </Col>
                  <Row align="center" gap={6}>
                    <StatusChip label={status.label} tone={status.tone} />
                    <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
                  </Row>
                </AnimatedPress>
              );
            })}
          </View>
        )}

        {/* ── 7. PAST MEALS & FEEDBACK ── */}
        <AnimatedPress accessibilityRole="button"
          style={styles.pastCard}
          onPress={() => { toast('info', 'Not Available Yet', 'Meal feedback history is coming soon.'); }}
        >
          <View style={styles.pastIcon}>
            <Ionicons name="receipt-outline" size={20} color={Colors.primaryDark} />
          </View>
          <Col style={{ flex: 1, marginLeft: 12 }}>
            <Txt size={14} weight="700" color={Colors.textPrimary}>Past Meals & Feedback</Txt>
            <Txt size={12} color={Colors.textSecondary} style={{ marginTop: 2 }}>
              Rate your meals and help us improve.
            </Txt>
          </Col>
          <View style={styles.viewAllChip}>
            <Txt size={12} weight="700" color={Colors.primary}>View All</Txt>
            <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
          </View>
        </AnimatedPress>

        {/* ── 8. FEEDBACK BANNER ── */}
        <AnimatedPress accessibilityRole="button"
          style={styles.feedbackBanner}
          onPress={() => { toast('info', 'Not Available Yet', 'Meal feedback submission is coming soon.'); }}
        >
          <View style={styles.feedbackIcon}>
            <Ionicons name="star-outline" size={20} color={Colors.primaryDark} />
          </View>
          <Col style={{ flex: 1, marginLeft: 12 }}>
            <Txt size={14} weight="700" color={Colors.textPrimary}>Your feedback matters!</Txt>
            <Txt size={12} color={Colors.textSecondary} style={{ marginTop: 2 }}>
              Help us serve you better every day.
            </Txt>
          </Col>
          <Image
            source={require('../../../../assets/img_guest_dashboard_hero.webp')}
            style={styles.feedbackImage}
            resizeMode="cover"
          />
        </AnimatedPress>

        <Spacer size={32} />
      </ScrollView>

      {/* Detail Sheet */}
      <Sheet
        visible={detailMeal != null}
        title={detailMeal?.mealType ?? 'Meal'}
        subtitle={`Service at ${detailMeal ? formatServiceTime12h(detailMeal.serviceTime) : ''}`}
        icon={detailMeal?.mealType?.toLowerCase() === 'breakfast' ? 'sunny' : detailMeal?.mealType?.toLowerCase() === 'dinner' ? 'moon' : 'restaurant'}
        accent={Colors.primary}
        onDismiss={() => setDetailMeal(null)}
        footer={
          detailMeal ? (
            <Row gap={10}>
              <AnimatedPress accessibilityRole="button"
                style={[styles.sheetBtn, { backgroundColor: Colors.primary }]}
                onPress={() => { handleRSVP(detailMeal.id, 'REQUIRED'); setDetailMeal(null); }}
              >
                <Ionicons name="checkmark" size={16} color={Colors.textInverse} />
                <Txt size={13} weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>I'll Attend ✅</Txt>
              </AnimatedPress>
              <AnimatedPress accessibilityRole="button"
                style={[styles.sheetBtn, { backgroundColor: Colors.danger }]}
                onPress={() => { handleRSVP(detailMeal.id, 'NOT_REQUIRED'); setDetailMeal(null); }}
              >
                <Ionicons name="close" size={16} color={Colors.textInverse} />
                <Txt size={13} weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>Skip Portion</Txt>
              </AnimatedPress>
            </Row>
          ) : null
        }
      >
        {detailMeal && (
          <View>
            <Card containerColor="#F7FAFA" borderRadius={Radii.card} borderWidth={1} borderColor="#DCE9EA" padding={[14, 14]}>
              <Row justify="space-between" align="center">
                <Row align="center" gap={8}>
                  <Ionicons name="restaurant" size={18} color={Colors.primary} />
                  <Txt size={12} weight="700" color={Colors.primary} style={{ letterSpacing: 1 }}>MENU DETAILS</Txt>
                </Row>
                {detailMeal.dietaryType && (
                  <View style={[styles.dietTag, { backgroundColor: DIETARY_TAG[detailMeal.dietaryType].bg }]}>
                    <Txt size={10} weight="700" color={DIETARY_TAG[detailMeal.dietaryType].color}>
                      {DIETARY_TAG[detailMeal.dietaryType].label}
                    </Txt>
                  </View>
                )}
              </Row>
              <Spacer size={8} />
              <Txt size={16} weight="700" color={Colors.textPrimary}>{detailMeal.menuItems}</Txt>
              {detailMeal.chefNote ? (
                <>
                  <Spacer size={8} />
                  <View style={styles.chefNote}>
                    <Txt size={12} weight="700" color={Colors.textPrimary}>Chef note: "{detailMeal.chefNote}"</Txt>
                  </View>
                </>
              ) : null}
            </Card>

            <Spacer size={14} />
            <Txt size={11} weight="700" color={Colors.primary} style={{ letterSpacing: 1 }}>SERVICE TIMELINE</Txt>
            <Spacer size={6} />
            <View style={styles.timelineRow}>
              <Ionicons name="time" size={14} color={Colors.textSecondary} />
              <Txt size={12} color={Colors.textPrimary}>Service time: {formatServiceTime12h(detailMeal.serviceTime)}</Txt>
            </View>
            <View style={styles.timelineRow}>
              <Ionicons name={detailMeal.isAlertSent ? 'notifications' : 'notifications-outline'} size={14} color={detailMeal.isAlertSent ? Colors.primary : Colors.textSecondary} />
              <Txt size={12} color={detailMeal.isAlertSent ? Colors.primary : Colors.textSecondary}>
                {detailMeal.isAlertSent ? 'RSVP alert sent — your response is being counted' : `Alert triggers at ${getAlertTriggerTime(detailMeal.serviceTime)}`}
              </Txt>
            </View>
            <View style={styles.timelineRow}>
              <Ionicons name="calendar" size={14} color={Colors.textSecondary} />
              <Txt size={12} color={Colors.textSecondary}>Posted {formatTime12h(detailMeal.timestamp)}</Txt>
            </View>

            <Spacer size={14} />
            <Txt size={11} weight="700" color={Colors.primary} style={{ letterSpacing: 1 }}>YOUR RSVP STATUS</Txt>
            <Spacer size={6} />
            {(() => {
              const choice = detailMeal ? effectiveChoices[detailMeal.id] : null;
              if (choice === 'REQUIRED') {
                return (
                  <View style={[styles.rsvpStatusBox, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: Colors.success }]}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    <Txt size={12} weight="700" color={Colors.success} style={{ marginLeft: 8 }}>You're eating! Your portion is reserved.</Txt>
                  </View>
                );
              }
              if (choice === 'NOT_REQUIRED') {
                return (
                  <View style={[styles.rsvpStatusBox, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: Colors.danger }]}>
                    <Ionicons name="close-circle" size={18} color={Colors.danger} />
                    <Txt size={12} weight="700" color={Colors.danger} style={{ marginLeft: 8 }}>You're skipping. Thank you for helping reduce waste!</Txt>
                  </View>
                );
              }
              return (
                <View style={[styles.rsvpStatusBox, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: Colors.warning }]}>
                  <Ionicons name="hourglass" size={18} color={Colors.warning} />
                  <Txt size={12} weight="700" color={Colors.warning} style={{ marginLeft: 8 }}>Pending — pick Attending or Skip below.</Txt>
                </View>
              );
            })()}
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },

  // Header

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  // Day strip
  dayStrip: { marginBottom: 16 },
  dayStripContent: { gap: 8, paddingRight: 8 },
  dayPill: {
    minWidth: 54, paddingHorizontal: 8, paddingVertical: 10,
    borderRadius: Radii.card, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: '#DCE9E9',
    alignItems: 'center',
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  dayPillActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  weeklyViewBtn: {
    width: 56, paddingVertical: 10, borderRadius: Radii.card,
    backgroundColor: '#EAF5F4', borderWidth: 1, borderColor: '#BDD8D6',
    alignItems: 'center', justifyContent: 'center' },

  // Prefs
  prefsWrapper: {
    backgroundColor: Colors.surface, borderRadius: Radii.card, borderWidth: 1, borderColor: '#DCE9E9',
    padding: 14, marginBottom: 16,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },

  // RSVP Banner
  rsvpBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radii.card,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 14, marginBottom: 12,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  rsvpBannerIcon: { width: 38, height: 38, borderRadius: Radii.pill, backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center' },

  // Meal tabs
  tabRow: { marginBottom: 16, flexWrap: 'nowrap' },
  tabPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radii.card,
    borderWidth: 1, borderColor: '#DCE9E9',
    paddingHorizontal: 10, paddingVertical: 10 },
  tabPillActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },

  // Hero card
  heroCard: {
    backgroundColor: Colors.surface, borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 20, marginBottom: 0,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5,
    overflow: 'hidden' },
  heroImageWrap: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%' },
  heroImage: { width: '100%', height: '100%' },
  upcomingBadge: {
    backgroundColor: Palette.TintGreen, borderRadius: Radii.sheet,
    paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start' },
  vegDotWrap: { width: 14, height: 14, borderRadius: Radii.badge, borderWidth: 1.5, borderColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 6, height: 6, borderRadius: Radii.pill, backgroundColor: Colors.success },
  rsvpClosed: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F6F5', borderRadius: Radii.card, height: 44, paddingHorizontal: 16 },
  attendBtn: {
    flex: 1, height: 44, borderRadius: Radii.card,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#DCE9E9' },
  attendBtnActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  skipBtn: {
    flex: 1, height: 44, borderRadius: Radii.card,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#DCE9E9' },
  skipBtnActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  dotInd: { width: 7, height: 7, borderRadius: Radii.pill, backgroundColor: '#D5E8E6' },
  dotIndActive: { width: 20, backgroundColor: Colors.primaryDark },

  // Progress box
  progressBox: { marginTop: 16, backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 12, borderWidth: 1, borderColor: '#DCE9E9' },
  progressTrack: { height: 6, backgroundColor: Palette.TintGreen, borderRadius: Radii.badge, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radii.badge },

  // Week day circle
  weekDayCircle: { width: 38, height: 38, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', marginTop: 4, backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#DCE9E9' },
  weekDayCircleActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },

  // Meal list
  mealListCard: { backgroundColor: Colors.surface, borderRadius: Radii.sheet, borderWidth: 1, borderColor: '#DCE9E9', overflow: 'hidden', marginBottom: 16, shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  mealRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  mealRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F6F5' },
  mealRowIcon: { width: 42, height: 42, borderRadius: Radii.pill, backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 40, backgroundColor: Colors.surface, borderRadius: Radii.sheet, borderWidth: 1, borderColor: '#DCE9E9', marginBottom: 16 },

  // Past Meals
  pastCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 16, marginBottom: 12,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  pastIcon: { width: 46, height: 46, borderRadius: Radii.card, backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center' },
  viewAllChip: { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.sheet, borderWidth: 1, borderColor: '#BDD8D6', paddingHorizontal: 12, paddingVertical: 7 },

  // Feedback banner
  feedbackBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EAF5F4', borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#BDD8D6',
    padding: 16, overflow: 'hidden' },
  feedbackIcon: { width: 46, height: 46, borderRadius: Radii.card, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  feedbackImage: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 90, opacity: 0.35 },

  // Sheet
  sheetBtn: { flex: 1, height: 46, borderRadius: Radii.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  chefNote: { marginTop: 10, backgroundColor: '#F0F6F5', borderRadius: Radii.control, padding: 10 },
  dietTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.control },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  rsvpStatusBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderRadius: Radii.control, borderWidth: 1 } });
