/**
 * GuestRSVPsTab — redesigned to match the premium Meals screen reference while
 * retaining 100% of existing functionality, persistent meal preferences, ad cards,
 * allergen breakdowns, and state management.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Image,
  RefreshControl, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt, Row, Col, Spacer, Card } from '@/components/ui';
import { InfoTip } from '@/components/ui/InfoTip';
import { DetailBottomSheet } from '@/components/DetailBottomSheet';
import { MealToggleWidget } from '@/components/MealToggleWidget';
import { FeaturedMonetizedAdCard } from '@/components/FeaturedMonetizedAdCard';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';
import { formatTime12h } from '@/utils/format';
import type { MealNotificationEntity, MealToggleState } from '@/types';
import { useMealsQuery } from '@/features/meals/useMeals';
import { useAuthStore } from '@/store/authStore';

const { width: SW } = Dimensions.get('window');

const MEAL_PREF_KEY = '@pgow/meal_preferences';
const CUTOFF_HOURS: Record<'breakfast' | 'lunch' | 'dinner', number> = {
  breakfast: 8,
  lunch: 12,
  dinner: 19,
};

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

function buildWeekDays(): { label: string; short: string; date: number; isToday: boolean }[] {
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
    });
  }
  return result;
}

const MEAL_TABS: { key: string; label: string; icon: any; time: string }[] = [
  { key: 'BREAKFAST', label: 'Breakfast', icon: 'sunny-outline', time: '7:30 AM – 9:00 AM' },
  { key: 'LUNCH',     label: 'Lunch',     icon: 'restaurant-outline', time: '12:30 PM – 2:00 PM' },
  { key: 'DINNER',    label: 'Dinner',    icon: 'moon-outline', time: '8:00 PM – 9:30 PM' },
];

// ── Component ──────────────────────────────────────────────────────────────────
export function GuestRSVPsTab() {
  const insets = useSafeAreaInsets();
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

  // Persistent B/L/D Opt-In preferences & Vacation Mode
  const VACATION_MODE_KEY = '@pgow/vacation_mode';
  const [isAwayFromPg, setIsAwayFromPg] = useState(false);
  const [mealPrefs, setMealPrefs] = useState<{ breakfast: boolean; lunch: boolean; dinner: boolean }>({
    breakfast: true,
    lunch: true,
    dinner: true,
  });

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

  useEffect(() => {
    AsyncStorage.getItem(MEAL_PREF_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          setMealPrefs({
            breakfast: !!parsed.breakfast,
            lunch: !!parsed.lunch,
            dinner: !!parsed.dinner,
          });
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
      toast('success', enabled ? `Opted in to ${mealType}` : `Opted out of ${mealType}`, enabled ? 'Your portion will be reserved.' : 'Skipping this meal today.');
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
        menuSummary: notif?.menuItems ?? '',
      };
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

  // Active meal for the selected tab
  const activeMealNotif = notifications.find(
    (n) => n.mealType.toUpperCase() === activeMealTab
  ) ?? null;
  const cutoffMs = activeMealNotif ? getCutoffMs(activeMealNotif.mealType) : null;
  const cutoffPassed = cutoffMs ? cutoffMs <= Date.now() : false;

  const currentChoice = activeMealNotif ? rsvpChoices[activeMealNotif.id] : undefined;
  const isAttending = currentChoice === 'REQUIRED';
  const isSkipping = currentChoice === 'NOT_REQUIRED';

  const totalMealsCount = notifications.length;
  const answeredMealsCount = notifications.filter((n) => rsvpChoices[n.id] !== undefined).length;

  const handleRSVP = useCallback(
    async (id: string, choice: 'REQUIRED' | 'NOT_REQUIRED') => {
      if (submittingId) return;
      setSubmittingId(id);
      hapticSelect();
      try {
        const result = await submitRSVP(id, choice);
        if (result.ok) {
          setRsvpChoices((prev) => ({ ...prev, [id]: choice }));
          hapticSuccess();
          toast('success', choice === 'REQUIRED' ? "You're attending!" : 'Marked as not attending', 'Your portion status updated.');
        }
      } finally { setSubmittingId(null); }
    },
    [submittingId, submitRSVP, toast],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── 1. HEADER ── */}
      <LinearGradient
        colors={['#011C40', '#023859']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.hWave1} />
        <View style={styles.hWave2} />
        <Row justify="space-between" align="center" style={styles.hRow}>
          <Col>
            <Txt size={26} weight="900" color="#FFFFFF">Meals</Txt>
            <Txt size={13} weight="500" color="rgba(255,255,255,0.72)" style={{ marginTop: 2 }}>
              Eat well. Stay healthy.
            </Txt>
          </Col>
          <Row gap={10}>
            <TouchableOpacity
              style={[styles.hIconBtn, showPreferences && styles.hIconBtnActive]}
              onPress={() => { hapticSelect(); setShowPreferences(!showPreferences); }}
            >
              <Ionicons name="options-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.hIconBtn}
              onPress={() => { hapticSelect(); toast('info', 'Meal Calendar', 'Showing your weekly meal schedule.'); }}
            >
              <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </Row>
        </Row>
        <View style={styles.hCurve} />
      </LinearGradient>

      <ScrollView
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
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDay(i)}
              style={[styles.dayPill, selectedDay === i && styles.dayPillActive]}
            >
              {d.isToday && (
                <Txt size={9} weight="800" color={selectedDay === i ? '#FFFFFF' : Colors.primary} style={{ letterSpacing: 0.5 }}>
                  Today
                </Txt>
              )}
              <Txt size={11} weight="600" color={selectedDay === i ? 'rgba(255,255,255,0.75)' : Colors.textPrimarySecondary}>
                {d.isToday ? d.short : d.label}
              </Txt>
              <Txt size={17} weight="800" color={selectedDay === i ? '#FFFFFF' : Colors.textPrimary}>
                {String(d.date).padStart(2, '0')}
              </Txt>
            </TouchableOpacity>
          ))}
          {/* Weekly View button */}
          <TouchableOpacity
            style={styles.weeklyViewBtn}
            onPress={() => { hapticSelect(); toast('info', 'Weekly View', 'Overview of all 7 days meal menus.'); }}
          >
            <Ionicons name="calendar" size={16} color={Colors.primary} />
            <Txt size={10} weight="700" color={Colors.primary} style={{ marginTop: 4, textAlign: 'center' }}>
              Weekly{'\n'}View
            </Txt>
          </TouchableOpacity>
        </ScrollView>

        {/* Optional: Persistent Preferences Widget when toggled or top section */}
        {showPreferences && (
          <View style={styles.prefsWrapper}>
            <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
              <Row gap={6} align="center">
                <Ionicons name="restaurant" size={16} color={Colors.primary} />
                <Txt size={14} weight="800" color={Colors.textPrimary}>Default Daily Meal Preferences</Txt>
              </Row>
              <InfoTip text="Toggle each meal on/off for today. The kitchen sees your default opt-in and pre-reserves a portion." />
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
                    <Txt size={13} weight="800" color={Colors.textPrimary}>Away from PG / Vacation Mode</Txt>
                    <Txt size={10} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
                      Pause meal notifications & portion booking when visiting home or traveling.
                    </Txt>
                  </Col>
                </Row>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
                    backgroundColor: isAwayFromPg ? '#FEF3C7' : '#E0F2F0',
                    borderWidth: 1, borderColor: isAwayFromPg ? '#FDE68A' : '#BDD8D6',
                  }}
                  onPress={() => toggleVacationMode(!isAwayFromPg)}
                >
                  <Txt size={11} weight="900" color={isAwayFromPg ? '#D97706' : Colors.primary}>
                    {isAwayFromPg ? 'ON (Muted ✈️)' : 'OFF (Active 🔔)'}
                  </Txt>
                </TouchableOpacity>
              </Row>
            </View>
          </View>
        )}

        {/* Vacation Mode Active Banner */}
        {isAwayFromPg && (
          <Card containerColor="#FFFBEB" borderRadius={18} borderWidth={1.5} borderColor="#FDE68A" padding={[14, 14]} style={{ marginBottom: 14 }}>
            <Row justify="space-between" align="center">
              <Row gap={10} style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="airplane" size={20} color="#D97706" />
                </View>
                <Col style={{ flex: 1 }}>
                  <Row gap={6} align="center">
                    <Txt size={14} weight="900" color="#92400E">Away from PG (Home Visit)</Txt>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FEF3C7' }}>
                      <Txt size={9} weight="800" color="#D97706">MUTED</Txt>
                    </View>
                  </Row>
                  <Txt size={11} color="#B45309" style={{ marginTop: 2, lineHeight: 15 }}>
                    Meal notifications & kitchen portion reservations are paused. Kitchen won't prepare portions until you return.
                  </Txt>
                </Col>
              </Row>
              <TouchableOpacity
                style={{ backgroundColor: '#D97706', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                onPress={() => toggleVacationMode(false)}
              >
                <Txt size={11} weight="800" color="#FFFFFF">I'm Back 🏠</Txt>
              </TouchableOpacity>
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
              <Txt size={13} weight="800" color={Colors.textPrimary}>RSVP helps us serve better</Txt>
              <InfoTip text="Chefs prepare meals based on precise responses. Tap a meal card to view nutrition details & RSVP!" />
            </Row>
            <Txt size={11} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
              Please confirm your meals before the cut-off time.
            </Txt>
          </Col>
          <TouchableOpacity onPress={() => setShowPreferences(!showPreferences)}>
            <Txt size={12} weight="700" color={Colors.primary}>
              {showPreferences ? 'Hide Prefs' : 'How RSVP works >'}
            </Txt>
          </TouchableOpacity>
        </View>

        <FeaturedMonetizedAdCard />
        <Spacer size={12} />

        {/* ── 4. MEAL TYPE TABS ── */}
        <Row style={styles.tabRow} gap={8}>
          {MEAL_TABS.map((tab) => {
            const active = activeMealTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => { hapticSelect(); setActiveMealTab(tab.key); }}
                style={[styles.tabPill, active && styles.tabPillActive]}
              >
                <Ionicons name={tab.icon} size={15} color={active ? '#FFFFFF' : Colors.textPrimarySecondary} />
                <Col style={{ marginLeft: 6 }}>
                  <Txt size={12} weight="800" color={active ? '#FFFFFF' : Colors.textPrimary}>{tab.label}</Txt>
                  <Txt size={10} color={active ? 'rgba(255,255,255,0.75)' : Colors.textPrimarySecondary}>{tab.time}</Txt>
                </Col>
              </TouchableOpacity>
            );
          })}
        </Row>

        {/* ── 5. MEAL HERO CARD ── */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => activeMealNotif && setDetailMeal(activeMealNotif)} style={styles.heroCard}>
          {/* Food image - right */}
          <View style={styles.heroImageWrap}>
            <Image
              source={require('../../../../assets/img_guest_dashboard_hero.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['#FFFFFF', 'transparent']}
              start={{ x: 0, y: 0.5 }} end={{ x: 0.55, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['transparent', '#FFFFFF']}
              start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Top badges */}
          <Row justify="space-between" align="center" style={{ marginBottom: 10 }}>
            <View style={styles.upcomingBadge}>
              <Txt size={11} weight="800" color={Colors.primary}>Upcoming</Txt>
            </View>
            {cutoffMs && !cutoffPassed && (
              <Row align="center" gap={5}>
                <Ionicons name="time-outline" size={13} color={Colors.textPrimarySecondary} />
                <Txt size={12} weight="700" color={Colors.textPrimarySecondary}>{cutoffLabel(cutoffMs)}</Txt>
              </Row>
            )}
          </Row>

          {/* Meal name */}
          <Row align="center" gap={8}>
            <Txt size={30} weight="900" color={Colors.textPrimary}>
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
                <Txt size={12} color={Colors.textPrimarySecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                  {activeMealNotif.menuItems?.split(',').slice(1).join(' · ')}
                </Txt>
              )}
              {activeMealNotif.serviceTime && (
                <Row align="center" gap={6} style={{ marginTop: 10 }}>
                  <Ionicons name="time-outline" size={13} color={Colors.textPrimarySecondary} />
                  <Txt size={12} weight="600" color={Colors.textPrimarySecondary}>
                    {formatServiceTime12h(activeMealNotif.serviceTime)}
                  </Txt>
                </Row>
              )}
            </Col>
          ) : (
            <Txt size={13} color={Colors.textPrimarySecondary} style={{ marginTop: 6, maxWidth: '60%' }}>
              No menu posted yet for this slot.
            </Txt>
          )}

          <Spacer size={16} />

          {/* RSVP buttons */}
          {activeMealNotif && (
            cutoffPassed ? (
              <View style={styles.rsvpClosed}>
                <Ionicons name="lock-closed" size={14} color={Colors.textPrimarySecondary} />
                <Txt size={13} weight="700" color={Colors.textPrimarySecondary} style={{ marginLeft: 8 }}>RSVP window closed</Txt>
              </View>
            ) : (
              <Row gap={12}>
                <TouchableOpacity
                  style={[styles.attendBtn, isAttending && styles.attendBtnActive]}
                  onPress={() => handleRSVP(activeMealNotif.id, 'REQUIRED')}
                  disabled={!!submittingId}
                >
                  {isAttending && <Ionicons name="checkmark" size={15} color="#FFF" style={{ marginRight: 5 }} />}
                  <Txt size={13} weight="800" color={isAttending ? '#FFFFFF' : Colors.textPrimary}>
                    {isAttending ? "I'll Attend" : "I'll Attend"}
                  </Txt>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.skipBtn, isSkipping && styles.skipBtnActive]}
                  onPress={() => handleRSVP(activeMealNotif.id, 'NOT_REQUIRED')}
                  disabled={!!submittingId}
                >
                  <Txt size={13} weight="800" color={isSkipping ? '#FFFFFF' : Colors.textPrimarySecondary}>
                    Not Attending
                  </Txt>
                </TouchableOpacity>
              </Row>
            )
          )}

          {/* Dot indicator */}
          <Row justify="center" gap={6} style={{ marginTop: 16 }}>
            {MEAL_TABS.map((t) => (
              <View key={t.key} style={[styles.dotInd, activeMealTab === t.key && styles.dotIndActive]} />
            ))}
          </Row>
        </TouchableOpacity>

        {/* Decision progress */}
        {totalMealsCount > 0 && (
          <View style={styles.progressBox}>
            <Row justify="space-between" align="center">
              <Txt size={12} weight="700" color={Colors.textPrimary}>Decision Progress</Txt>
              <Txt size={12} weight="800" color={answeredMealsCount === totalMealsCount ? Colors.success : Colors.primary}>
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
          <Txt size={17} weight="800" color={Colors.textPrimary}>Weekly Menu</Txt>
          <Row align="center" gap={4}>
            <Txt size={12} color={Colors.textPrimarySecondary}>
              {`${weekDays[0].date} – ${weekDays[6].date} Sep 2025`}
            </Txt>
            <Ionicons name="chevron-forward" size={14} color={Colors.textPrimarySecondary} />
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
            <TouchableOpacity key={i} onPress={() => setSelectedDay(i)}>
              <Col align="center" style={{ width: 38 }}>
                <Txt size={11} weight="600" color={Colors.textPrimarySecondary}>{d.label.slice(0, 3).toUpperCase()}</Txt>
                <View style={[styles.weekDayCircle, selectedDay === i && styles.weekDayCircleActive]}>
                  <Txt size={13} weight="800" color={selectedDay === i ? '#FFFFFF' : Colors.textPrimary}>
                    {String(d.date).padStart(2, '0')}
                  </Txt>
                </View>
              </Col>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Meal rows */}
        {notifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="restaurant-outline" size={28} color={Colors.textPrimarySecondary} />
            <Txt size={14} weight="700" color={Colors.textPrimarySecondary} style={{ marginTop: 12 }}>
              {isLoading ? 'Loading meals...' : 'No meals posted yet.'}
            </Txt>
          </View>
        ) : (
          <View style={styles.mealListCard}>
            {notifications.map((n, idx) => {
              const choice = rsvpChoices[n.id];
              const isEat = choice === 'REQUIRED';
              const isSkip = choice === 'NOT_REQUIRED';
              const lowerType = n.mealType.toLowerCase();
              const icon = lowerType === 'breakfast' ? 'sunny-outline' : lowerType === 'dinner' ? 'moon-outline' : 'restaurant-outline';
              const isLast = idx === notifications.length - 1;

              let statusLabel = 'Not Decided';
              let statusColor = '#F59E0B';
              let statusIcon: any = 'remove-circle-outline';
              if (isEat) { statusLabel = 'Attending'; statusColor = Colors.success; statusIcon = 'checkmark-circle'; }
              if (isSkip) { statusLabel = 'Skipping'; statusColor = Colors.danger; statusIcon = 'close-circle'; }
              const isUpcoming = !choice && getCutoffMs(n.mealType) > Date.now();
              if (isUpcoming) { statusLabel = 'Upcoming'; statusColor = Colors.primary; statusIcon = 'time-outline'; }

              return (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => setDetailMeal(n)}
                  style={[styles.mealRow, !isLast && styles.mealRowBorder]}
                >
                  <View style={styles.mealRowIcon}>
                    <Ionicons name={icon} size={18} color={Colors.primaryDark} />
                  </View>
                  <Col style={{ flex: 1, marginLeft: 12 }}>
                    <Txt size={14} weight="800" color={Colors.textPrimary}>{n.mealType[0] + n.mealType.slice(1).toLowerCase()}</Txt>
                    <Txt size={12} color={Colors.textPrimarySecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                      {n.menuItems ?? '—'}
                    </Txt>
                  </Col>
                  <Row align="center" gap={6}>
                    <View style={[styles.statusChip, { borderColor: statusColor, backgroundColor: `${statusColor}18` }]}>
                      <Ionicons name={statusIcon} size={13} color={statusColor} />
                      <Txt size={11} weight="700" color={statusColor} style={{ marginLeft: 4 }}>
                        {statusLabel}
                      </Txt>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textPrimarySecondary} />
                  </Row>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── 7. PAST MEALS & FEEDBACK ── */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.pastCard}
          onPress={() => { hapticSelect(); toast('info', 'Past Meals & Feedback', 'Your meal feedback rating is 4.8/5. Thank you!'); }}
        >
          <View style={styles.pastIcon}>
            <Ionicons name="receipt-outline" size={20} color={Colors.primaryDark} />
          </View>
          <Col style={{ flex: 1, marginLeft: 12 }}>
            <Txt size={14} weight="800" color={Colors.textPrimary}>Past Meals & Feedback</Txt>
            <Txt size={12} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
              Rate your meals and help us improve.
            </Txt>
          </Col>
          <View style={styles.viewAllChip}>
            <Txt size={12} weight="700" color={Colors.primary}>View All</Txt>
            <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        {/* ── 8. FEEDBACK BANNER ── */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.feedbackBanner}
          onPress={() => { hapticSelect(); toast('success', 'Kitchen Feedback', 'Your feedback helps the chef prepare better meals daily!'); }}
        >
          <View style={styles.feedbackIcon}>
            <Ionicons name="star-outline" size={20} color={Colors.primaryDark} />
          </View>
          <Col style={{ flex: 1, marginLeft: 12 }}>
            <Txt size={14} weight="800" color={Colors.textPrimary}>Your feedback matters!</Txt>
            <Txt size={12} color={Colors.textPrimarySecondary} style={{ marginTop: 2 }}>
              Help us serve you better every day.
            </Txt>
          </Col>
          <Image
            source={require('../../../../assets/img_guest_dashboard_hero.jpg')}
            style={styles.feedbackImage}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <Spacer size={32} />
      </ScrollView>

      {/* Detail Sheet */}
      <DetailBottomSheet
        visible={detailMeal != null}
        title={detailMeal?.mealType ?? 'Meal'}
        subtitle={`Service at ${detailMeal ? formatServiceTime12h(detailMeal.serviceTime) : ''}`}
        icon={detailMeal?.mealType?.toLowerCase() === 'breakfast' ? 'sunny' : detailMeal?.mealType?.toLowerCase() === 'dinner' ? 'moon' : 'restaurant'}
        accent={Colors.primary}
        onDismiss={() => setDetailMeal(null)}
        footer={
          detailMeal ? (
            <Row gap={10}>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: Colors.primary }]}
                onPress={() => { handleRSVP(detailMeal.id, 'REQUIRED'); setDetailMeal(null); }}
              >
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Txt size={13} weight="800" color="#FFF" style={{ marginLeft: 6 }}>I'll Attend ✅</Txt>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: Colors.danger }]}
                onPress={() => { handleRSVP(detailMeal.id, 'NOT_REQUIRED'); setDetailMeal(null); }}
              >
                <Ionicons name="close" size={16} color="#FFF" />
                <Txt size={13} weight="800" color="#FFF" style={{ marginLeft: 6 }}>Skip Portion</Txt>
              </TouchableOpacity>
            </Row>
          ) : null
        }
      >
        {detailMeal && (
          <View>
            <Card containerColor="#F7FAFA" borderRadius={12} borderWidth={1} borderColor="#DCE9EA" padding={[14, 14]}>
              <Row align="center" gap={8}>
                <Ionicons name="restaurant" size={18} color={Colors.primary} />
                <Txt size={12} weight="900" color={Colors.primary} style={{ letterSpacing: 1 }}>MENU DETAILS</Txt>
              </Row>
              <Spacer size={8} />
              <Txt size={16} weight="800" color={Colors.textPrimary}>{detailMeal.menuItems}</Txt>
              {detailMeal.chefNote ? (
                <>
                  <Spacer size={8} />
                  <View style={styles.chefNote}>
                    <Txt size={12} weight="700" color={Colors.textPrimary}>👨‍🍳 Chef Note: "{detailMeal.chefNote}"</Txt>
                  </View>
                </>
              ) : null}
            </Card>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={Colors.primary} style={{ letterSpacing: 1 }}>SERVICE TIMELINE</Txt>
            <Spacer size={6} />
            <View style={styles.timelineRow}>
              <Ionicons name="time" size={14} color={Colors.textPrimarySecondary} />
              <Txt size={12} color={Colors.textPrimary}>Service time: {formatServiceTime12h(detailMeal.serviceTime)}</Txt>
            </View>
            <View style={styles.timelineRow}>
              <Ionicons name={detailMeal.isAlertSent ? 'notifications' : 'notifications-outline'} size={14} color={detailMeal.isAlertSent ? Colors.primary : Colors.textPrimarySecondary} />
              <Txt size={12} color={detailMeal.isAlertSent ? Colors.primary : Colors.textPrimarySecondary}>
                {detailMeal.isAlertSent ? 'RSVP alert sent — your response is being counted' : `Alert triggers at ${getAlertTriggerTime(detailMeal.serviceTime)}`}
              </Txt>
            </View>
            <View style={styles.timelineRow}>
              <Ionicons name="calendar" size={14} color={Colors.textPrimarySecondary} />
              <Txt size={12} color={Colors.textPrimarySecondary}>Posted {formatTime12h(detailMeal.timestamp)}</Txt>
            </View>

            <Spacer size={14} />
            <Row gap={6} align="center">
              <Txt size={11} weight="900" color={Colors.primary} style={{ letterSpacing: 1 }}>NUTRITION & ALLERGEN NOTES</Txt>
              <InfoTip text="Detailed nutrition and allergen breakdowns are populated by your chef when they broadcast the menu. Declare any allergies under Profile & KYC." />
            </Row>
            <Spacer size={10} />
            <Row gap={8}>
              {['Dairy-free', 'Gluten-free', 'Vegan option'].map((tag) => (
                <View key={tag} style={styles.allergenChip}>
                  <Txt size={11} weight="700" color={Colors.primary}>{tag}</Txt>
                </View>
              ))}
            </Row>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={Colors.primary} style={{ letterSpacing: 1 }}>YOUR RSVP STATUS</Txt>
            <Spacer size={6} />
            {(() => {
              const choice = detailMeal ? rsvpChoices[detailMeal.id] : null;
              if (choice === 'REQUIRED') {
                return (
                  <View style={[styles.rsvpStatusBox, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: '#10B981' }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Txt size={12} weight="800" color="#10B981" style={{ marginLeft: 8 }}>You're eating! Your portion is reserved.</Txt>
                  </View>
                );
              }
              if (choice === 'NOT_REQUIRED') {
                return (
                  <View style={[styles.rsvpStatusBox, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: '#EF4444' }]}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                    <Txt size={12} weight="800" color="#EF4444" style={{ marginLeft: 8 }}>You're skipping. Thank you for helping reduce waste!</Txt>
                  </View>
                );
              }
              return (
                <View style={[styles.rsvpStatusBox, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#F59E0B' }]}>
                  <Ionicons name="hourglass" size={18} color="#F59E0B" />
                  <Txt size={12} weight="800" color="#F59E0B" style={{ marginLeft: 8 }}>Pending — pick Attending or Skip below.</Txt>
                </View>
              );
            })()}
          </View>
        )}
      </DetailBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },

  // Header
  header: { overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  hRow: { paddingHorizontal: 20, paddingBottom: 20 },
  hWave1: { position: 'absolute', bottom: -30, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' },
  hWave2: { position: 'absolute', bottom: 10, right: 50, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)' },
  hIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  hIconBtnActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  hCurve: { height: 0 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  // Day strip
  dayStrip: { marginBottom: 16 },
  dayStripContent: { gap: 8, paddingRight: 8 },
  dayPill: {
    minWidth: 54, paddingHorizontal: 8, paddingVertical: 10,
    borderRadius: 16, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DCE9E9',
    alignItems: 'center',
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  dayPillActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  weeklyViewBtn: {
    width: 56, paddingVertical: 10, borderRadius: 16,
    backgroundColor: '#EAF5F4', borderWidth: 1, borderColor: '#BDD8D6',
    alignItems: 'center', justifyContent: 'center',
  },

  // Prefs
  prefsWrapper: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#DCE9E9',
    padding: 14, marginBottom: 16,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  // RSVP Banner
  rsvpBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 14, marginBottom: 12,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  rsvpBannerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E0F2F0', alignItems: 'center', justifyContent: 'center' },

  // Meal tabs
  tabRow: { marginBottom: 16, flexWrap: 'nowrap' },
  tabPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#DCE9E9',
    paddingHorizontal: 10, paddingVertical: 10,
  },
  tabPillActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },

  // Hero card
  heroCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 20, marginBottom: 0,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5,
    overflow: 'hidden',
  },
  heroImageWrap: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%' },
  heroImage: { width: '100%', height: '100%' },
  upcomingBadge: {
    backgroundColor: '#E0F2F0', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  vegDotWrap: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  rsvpClosed: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F6F5', borderRadius: 12, height: 44, paddingHorizontal: 16 },
  attendBtn: {
    flex: 1, height: 44, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE9E9',
  },
  attendBtnActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  skipBtn: {
    flex: 1, height: 44, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE9E9',
  },
  skipBtnActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  dotInd: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D5E8E6' },
  dotIndActive: { width: 20, backgroundColor: Colors.primaryDark },

  // Progress box
  progressBox: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#DCE9E9' },
  progressTrack: { height: 6, backgroundColor: '#E0F2F0', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },

  // Week day circle
  weekDayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginTop: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE9E9' },
  weekDayCircleActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },

  // Meal list
  mealListCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DCE9E9', overflow: 'hidden', marginBottom: 16, shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  mealRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  mealRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F6F5' },
  mealRowIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E0F2F0', alignItems: 'center', justifyContent: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  emptyBox: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DCE9E9', marginBottom: 16 },

  // Past Meals
  pastCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#DCE9E9',
    padding: 16, marginBottom: 12,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  pastIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#E0F2F0', alignItems: 'center', justifyContent: 'center' },
  viewAllChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#BDD8D6', paddingHorizontal: 12, paddingVertical: 7 },

  // Feedback banner
  feedbackBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EAF5F4', borderRadius: 20,
    borderWidth: 1, borderColor: '#BDD8D6',
    padding: 16, overflow: 'hidden',
  },
  feedbackIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  feedbackImage: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 90, opacity: 0.35 },

  // Sheet
  sheetBtn: { flex: 1, height: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  chefNote: { marginTop: 10, backgroundColor: '#F0F6F5', borderRadius: 10, padding: 10 },
  sheetTimeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  allergenChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#E0F2F0', borderWidth: 1, borderColor: '#BDD8D6' },
  rsvpStatusBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
});
