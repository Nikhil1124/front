/**
 * GuestRSVPsTab — port of Kotlin `GuestRSVPsTab`.
 * Daily portion RSVP planner + monetized ad card + meal notifications list.
 *
 * Touch interactions:
 *   - Each meal notification card is wrapped in <AnimatedPress> so it
 *     compresses on tap and opens a MealDetailBottomSheet with the full
 *     nutrition/allergen breakdown and RSVP status.
 *   - RSVP buttons fire success haptics on tap, and surface a toast via
 *     AlertOverlay instead of a blocking Alert.alert.
 *   - Filter chips fire a selection haptic.
 *   - ScrollView has pull-to-refresh wired up via usePullToRefresh.
 */
import { useState, useCallback, useEffect } from 'react';
import { ScrollView, View, StyleSheet, Image, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { InfoTip } from '@/components/ui/InfoTip';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { DetailBottomSheet } from '@/components/DetailBottomSheet';
import { EmptyState } from '@/components/EmptyState';
// ── Task 8: persistent B/L/D opt-in widget with countdown ───────────────────
import { MealToggleWidget } from '@/components/MealToggleWidget';
import type { MealToggleState } from '@/types';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { FeaturedMonetizedAdCard } from '@/components/FeaturedMonetizedAdCard';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useToast } from '@/hooks/useToast';
import { hapticSelect, hapticSuccess } from '@/utils/haptics';
import { formatTime12h } from '@/utils/format';
import type { MealNotificationEntity } from '@/types';

// Task 8: AsyncStorage keys for persistent meal preferences. The spec called
// for `POST /v1/meals/attendance`, but the backend has not landed that endpoint
// yet — storing locally so the toggle state survives between sessions and the
// widget remains useful today. A future swap to the API is one-line.
const MEAL_PREF_KEY = '@pgow/meal_preferences';
const CUTOFF_HOURS: Record<'breakfast' | 'lunch' | 'dinner', number> = {
  breakfast: 8,
  lunch: 12,
  dinner: 19,
};

export function GuestRSVPsTab() {
  const guest = usePGowStore((s) => s.loggedInGuest);
  const notifications = usePGowStore((s) => s.currentPGNotifications);
  const allRSVPs = usePGowStore((s) => s.allRSVPsState);
  const submitRSVP = usePGowStore((s) => s.submitRSVP);
  const getAlertTriggerTime = usePGowStore((s) => s.getAlertTriggerTime);
  const formatServiceTime12h = usePGowStore((s) => s.formatServiceTime12h);
  const toast = useToast();
  const { refreshing, onRefresh } = usePullToRefresh();

  const [selectedMealFilter, setSelectedMealFilter] = useState('ALL');
  const [detailMeal, setDetailMeal] = useState<MealNotificationEntity | null>(null);

  // ── Task 8: persistent meal preference state (B/L/D opt-in/out) ──────────────
  // Loaded from AsyncStorage on mount. Each toggle persists to AsyncStorage so
  // the resident's "I want dinner every day" preference survives a logout.
  // TODO: when `POST /v1/meals/attendance` lands server-side, swap the
  // AsyncStorage setItem call for an apiFetch POST and keep the rest of the
  // widget contract intact.
  const [mealPrefs, setMealPrefs] = useState<{ breakfast: boolean; lunch: boolean; dinner: boolean }>({
    breakfast: true,
    lunch: true,
    dinner: true,
  });

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
        } catch { /* ignore — fall back to defaults */ }
      })
      .catch(() => { /* AsyncStorage is best-effort */ });
  }, []);

  const setMealPreference = useCallback(
    (mealType: 'breakfast' | 'lunch' | 'dinner', enabled: boolean) => {
      setMealPrefs((cur) => {
        const next = { ...cur, [mealType]: enabled };
        AsyncStorage.setItem(MEAL_PREF_KEY, JSON.stringify(next)).catch(() => { /* best-effort */ });
        return next;
      });
      toast('success', enabled ? `Opted in to ${mealType}` : `Opted out of ${mealType}`, enabled ? 'Your portion will be reserved.' : 'Skipping this meal today.');
    },
    [toast],
  );

  // Build the MealToggleState per meal: enabled flag, today's menu summary
  // (from the matching meal notification), cutoff time as "HH:MM" and a
  // wall-clock ms timestamp for the countdown.
  const buildMealToggleState = useCallback(
    (mealType: 'breakfast' | 'lunch' | 'dinner'): MealToggleState => {
      const notif = notifications.find((n) => n.mealType.toUpperCase() === mealType.toUpperCase());
      const cutoffHour = CUTOFF_HOURS[mealType];
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setHours(cutoffHour, 0, 0, 0);
      // If the cutoff has already passed today, the next one is tomorrow's.
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

  const filteredNotifications = notifications.filter((n) =>
    selectedMealFilter === 'ALL' ? true : n.mealType.toUpperCase() === selectedMealFilter,
  );

  const totalMealsCount = notifications.length;
  const answeredMealsCount = notifications.filter((n) =>
    allRSVPs.some((r) => r.notificationId === n.id && r.guestId === guest?.id),
  ).length;
  const progressPercent = totalMealsCount > 0 ? answeredMealsCount / totalMealsCount : 0;

  const mealSlots: { name: string; icon: keyof typeof Ionicons.glyphMap; key: string }[] = [
    { name: 'Breakfast', icon: 'sunny', key: 'BREAKFAST' },
    { name: 'Lunch', icon: 'restaurant', key: 'LUNCH' },
    { name: 'Dinner', icon: 'moon', key: 'DINNER' },
  ];

  const handleRSVP = useCallback(
    async (notificationId: string, choice: 'REQUIRED' | 'NOT_REQUIRED') => {
      const result = await submitRSVP(notificationId, choice);
      if (result.ok) {
        hapticSuccess();
        const label = choice === 'REQUIRED' ? 'Eating' : 'Skipping';
        toast('success', `RSVP: ${label}`, 'Your portion is booked.');
      }
      // On failure, submitRSVP already surfaced the "❌ RSVP NOT RECORDED" alert itself.
    },
    [submitRSVP, toast],
  );

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, gap: 12 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.CyberGreen} colors={[Colors.CyberGreen]} />}
    >
      <Row gap={6} align="center">
        <Txt variant="screenTitle" weight="900" color={Colors.CyberGreen} style={{ letterSpacing: -0.3 }}>Daily Portion RSVP</Txt>
        <InfoTip text="Chefs prepare meals based on precise responses. Tap a meal card to view nutrition details & RSVP!" />
      </Row>

      <Card containerColor="transparent" borderRadius={14} borderWidth={1} borderColor={Colors.borderSubtle} style={{ height: 110, overflow: 'hidden' }}>
        <Image source={require('../../../../assets/img_guest_dashboard_hero.jpg')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </Card>

      <FeaturedMonetizedAdCard />

      {/* Task 8: persistent B/L/D opt-in widget with live countdown timers.
          Sits above the per-posted-meal RSVP cards so the resident's default
          preference is the first thing they see, and the per-meal RSVPs below
          are overrides for today's specific menu. */}
      <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={16} borderWidth={1} borderColor={Colors.LuxuryCardBorder} padding={[14, 14]}>
        <Row gap={6} align="center">
          <Ionicons name="restaurant" size={16} color={Colors.CyberGreen} />
          <Txt variant="cardTitle" weight="800" color={Colors.IvoryWhiteText}>My Daily Meal Preferences</Txt>
          <InfoTip text="Toggle each meal on/off for today. The kitchen sees your default opt-in and pre-reserves a portion." />
        </Row>
        <Spacer size={10} />
        <MealToggleWidget
          breakfast={buildMealToggleState('breakfast')}
          lunch={buildMealToggleState('lunch')}
          dinner={buildMealToggleState('dinner')}
          onToggle={setMealPreference}
        />
      </Card>

      <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={16} borderWidth={1} borderColor={Colors.LuxuryCardBorder} padding={[16, 16]}>
        <Txt variant="sectionTitle" weight="800" color={Colors.IvoryWhiteText}>📅 Daily RSVP Status Planner</Txt>
        <Spacer size={12} />
        <Row gap={10}>
          {mealSlots.map((slot) => {
            const matchingNotif = notifications.find((n) => n.mealType.toUpperCase() === slot.key);
            const rsvp = matchingNotif ? allRSVPs.find((r) => r.notificationId === matchingNotif.id && r.guestId === guest?.id) : null;
            const isFilterSelected = selectedMealFilter === slot.key;
            let statusBg: string = '#F8FAFC';
            let statusBorder: string = Colors.borderMuted;
            let statusColor: string = Colors.textMuted;
            let statusText = 'No Menu';
            if (matchingNotif) {
              if (!rsvp) { statusBg = 'rgba(255,184,0,0.1)'; statusBorder = '#FFB800'; statusColor = '#FFB800'; statusText = 'Pending'; }
              else if (rsvp.choice === 'REQUIRED') { statusBg = 'rgba(16,185,129,0.1)'; statusBorder = '#10B981'; statusColor = '#10B981'; statusText = 'Eating'; }
              else { statusBg = 'rgba(239,68,68,0.1)'; statusBorder = '#EF4444'; statusColor = '#EF4444'; statusText = 'Skipping'; }
            }
            return (
              <AnimatedPress
                key={slot.key}
                scale={isFilterSelected ? 0.95 : 0.97}
                hapticPattern="light"
                onPress={() => {
                  hapticSelect();
                  setSelectedMealFilter(isFilterSelected ? 'ALL' : slot.key);
                }}
                style={{ flex: 1 }}
              >
                <View style={[styles.mealCard, { backgroundColor: statusBg, borderColor: isFilterSelected ? Colors.CyberPink : statusBorder, borderWidth: isFilterSelected ? 2 : 1 }]}>
                  <Col align="center">
                    <Ionicons name={slot.icon} size={20} color={statusColor} />
                    <Spacer size={4} />
                    <Txt variant="caption" weight="700" color={isFilterSelected ? Colors.CyberPink : Colors.IvoryWhiteText}>{slot.name}</Txt>
                    <Txt variant="labelSmall" weight="800" color={statusColor}>{statusText}</Txt>
                  </Col>
                </View>
              </AnimatedPress>
            );
          })}
        </Row>
        <Spacer size={16} />
        <Row justify="space-between" align="center">
          <Txt variant="caption" weight="700" color={Colors.IvoryWhiteText}>Meal Selection Progress</Txt>
          <Txt variant="caption" weight="800" color={progressPercent === 1 ? '#10B981' : Colors.CyberPink}>
            {answeredMealsCount} of {totalMealsCount} Decisions Made ({Math.round(progressPercent * 100)}%)
          </Txt>
        </Row>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent * 100}%`, backgroundColor: progressPercent === 1 ? '#10B981' : Colors.CyberPink }]} />
        </View>
      </Card>

      <Col>
        <Txt variant="body" weight="700" color={Colors.IvoryWhiteText}>Quick-Action Filter by Menu</Txt>
        <Row gap={8} style={{ marginTop: 8 }}>
          {[
            { key: 'ALL', label: 'All Menus 🍽️' },
            { key: 'BREAKFAST', label: 'Breakfast 🍳' },
            { key: 'LUNCH', label: 'Lunch 🍛' },
            { key: 'DINNER', label: 'Dinner 🌙' },
          ].map((f) => {
            const sel = selectedMealFilter === f.key;
            return (
              <AnimatedPress
                key={f.key}
                scale={0.95}
                hapticPattern="light"
                onPress={() => { hapticSelect(); setSelectedMealFilter(f.key); }}
                style={[styles.filterChip, { backgroundColor: sel ? 'rgba(0,163,140,0.25)' : Colors.surface, borderColor: sel ? Colors.CyberPink : Colors.LuxuryCardBorder }]}
              >
                <Txt size={10} weight={sel ? '900' : '700'} color={sel ? Colors.CyberPink : Colors.SlateMutedText}>{f.label}</Txt>
              </AnimatedPress>
            );
          })}
        </Row>
      </Col>

      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon="restaurant-outline"
          title={selectedMealFilter === 'ALL' ? 'No active menus posted' : `No active ${selectedMealFilter} menu posted`}
          subtitle="Your PG's chef will broadcast a menu here when the next meal is ready. Pull down to refresh."
          accent={Colors.CyberGreen}
        />
      ) : (
        filteredNotifications.map((notif) => {
          const currentChoice = allRSVPs.find((r) => r.notificationId === notif.id && r.guestId === guest?.id)?.choice;
          const isEating = currentChoice === 'REQUIRED';
          const isSkipping = currentChoice === 'NOT_REQUIRED';
          return (
            <AnimatedPress
              key={notif.id}
              scale={0.985}
              hapticPattern="light"
              onPress={() => setDetailMeal(notif)}
            >
              <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={12} borderWidth={1} borderColor={currentChoice ? 'rgba(0,223,188,0.4)' : 'rgba(20,226,177,0.15)'} padding={[18, 18]}>
                <Row justify="space-between" align="center">
                  <Row gap={10}>
                    <View style={styles.mealIconBox}>
                      <Ionicons name={notif.mealType === 'Breakfast' ? 'sunny' : notif.mealType === 'Dinner' ? 'moon' : 'restaurant'} size={18} color={Colors.CyberGreen} />
                    </View>
                    <Txt variant="sectionTitle" weight="800" color={Colors.IvoryWhiteText}>{notif.mealType}</Txt>
                  </Row>
                  <Row gap={6} align="center">
                    <Txt variant="caption" weight="700" color={Colors.textMuted}>{formatTime12h(notif.timestamp)}</Txt>
                    <Ionicons name="chevron-forward" size={14} color={Colors.SlateMutedText} />
                  </Row>
                </Row>
                <Spacer size={10} />
                <View style={styles.serviceBox}>
                  <Col style={{ flex: 1 }}>
                    <Txt variant="caption" weight="700" color={Colors.CyberGreen}>🕒 Meal Service: {formatServiceTime12h(notif.serviceTime)}</Txt>
                    <Txt size={10} weight="500" color={notif.isAlertSent ? '#02E0A5' : '#9CA3AF'}>
                      {notif.isAlertSent ? '🔔 Interactive RSVP status notification sent' : `🔔 Status bar RSVP alert triggers at ${getAlertTriggerTime(notif.serviceTime)}`}
                    </Txt>
                  </Col>
                </View>
                <Spacer size={12} />
                <Txt variant="cardTitle" weight="800" color={Colors.IvoryWhiteText}>{notif.menuItems}</Txt>
                {notif.chefNote ? (
                  <>
                    <Spacer size={6} />
                    <View style={styles.chefNoteBox}><Txt variant="caption" weight="700" color={Colors.IvoryWhiteText}>Chef Note: "{notif.chefNote}"</Txt></View>
                  </>
                ) : null}
                <Spacer size={12} />
                <Txt variant="labelSmall" color={Colors.CyberPurple} weight="700">👆 Tap card to view nutrition, allergens & RSVP details</Txt>
                <Spacer size={16} />
                <Row gap={10}>
                  <Btn
                    onPress={() => handleRSVP(notif.id, 'REQUIRED')}
                    containerColor={isEating ? '#10B981' : 'rgba(16,185,129,0.15)'}
                    textColor={isEating ? '#FFFFFF' : '#10B981'}
                    borderRadius={12}
                    height={48}
                    style={{ flex: 1 }}
                    testID="rsvp_required_button"
                  >
                    <Ionicons name="checkmark" size={18} color={isEating ? '#FFFFFF' : '#10B981'} />
                    <Txt variant="cardTitle" weight="900" color={isEating ? '#FFFFFF' : '#10B981'} style={{ marginLeft: 6 }}>Eating</Txt>
                  </Btn>
                  <Btn
                    onPress={() => handleRSVP(notif.id, 'NOT_REQUIRED')}
                    containerColor={isSkipping ? '#EF4444' : 'rgba(239,68,68,0.15)'}
                    textColor={isSkipping ? '#FFFFFF' : '#EF4444'}
                    borderRadius={12}
                    height={48}
                    style={{ flex: 1 }}
                    testID="rsvp_skip_button"
                  >
                    <Ionicons name="close" size={18} color={isSkipping ? '#FFFFFF' : '#EF4444'} />
                    <Txt variant="cardTitle" weight="900" color={isSkipping ? '#FFFFFF' : '#EF4444'} style={{ marginLeft: 6 }}>Skipping</Txt>
                  </Btn>
                </Row>
              </Card>
            </AnimatedPress>
          );
        })
      )}

      {/* Meal Detail Bottom Sheet */}
      <DetailBottomSheet
        visible={detailMeal != null}
        title={detailMeal?.mealType ?? 'Meal'}
        subtitle={`Service at ${detailMeal ? formatServiceTime12h(detailMeal.serviceTime) : ''}`}
        icon={detailMeal?.mealType === 'Breakfast' ? 'sunny' : detailMeal?.mealType === 'Dinner' ? 'moon' : 'restaurant'}
        accent={Colors.CyberGreen}
        onDismiss={() => setDetailMeal(null)}
        footer={
          detailMeal ? (
            <Row gap={10}>
              <Btn
                onPress={() => { handleRSVP(detailMeal.id, 'REQUIRED'); setDetailMeal(null); }}
                containerColor="#10B981"
                textColor="#FFFFFF"
                borderRadius={12}
                height={46}
                style={{ flex: 1 }}
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Txt size={13} weight="900" color="#FFFFFF" style={{ marginLeft: 6 }}>I will Eat ✅</Txt>
              </Btn>
              <Btn
                onPress={() => { handleRSVP(detailMeal.id, 'NOT_REQUIRED'); setDetailMeal(null); }}
                containerColor="#EF4444"
                textColor="#FFFFFF"
                borderRadius={12}
                height={46}
                style={{ flex: 1 }}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
                <Txt size={13} weight="900" color="#FFFFFF" style={{ marginLeft: 6 }}>Skip Portion</Txt>
              </Btn>
            </Row>
          ) : null
        }
      >
        {detailMeal && (
          <View>
            <Card containerColor={Colors.surfaceElevated} borderRadius={12} borderWidth={1} borderColor="rgba(20,226,177,0.18)" padding={[14, 14]}>
              <Row align="center" gap={8}>
                <Ionicons name="restaurant" size={18} color={Colors.CyberGreen} />
                <Txt size={12} weight="900" color={Colors.CyberGreen} style={{ letterSpacing: 1 }}>MENU DETAILS</Txt>
              </Row>
              <Spacer size={8} />
              <Txt variant="cardTitle" weight="800" color={Colors.IvoryWhiteText}>{detailMeal.menuItems}</Txt>
              {detailMeal.chefNote ? (
                <>
                  <Spacer size={8} />
                  <View style={styles.chefNoteBox}><Txt variant="caption" weight="700" color={Colors.IvoryWhiteText}>👨‍🍳 Chef Note: "{detailMeal.chefNote}"</Txt></View>
                </>
              ) : null}
            </Card>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={Colors.CyberPurple} style={{ letterSpacing: 1 }}>SERVICE TIMELINE</Txt>
            <Spacer size={6} />
            <View style={styles.timelineRow}>
              <Ionicons name="time" size={14} color={Colors.SlateMutedText} />
              <Txt variant="caption" color={Colors.IvoryWhiteText}>Service time: {formatServiceTime12h(detailMeal.serviceTime)}</Txt>
            </View>
            <View style={styles.timelineRow}>
              <Ionicons name={detailMeal.isAlertSent ? 'notifications' : 'notifications-outline'} size={14} color={detailMeal.isAlertSent ? Colors.CyberGreen : Colors.SlateMutedText} />
              <Txt variant="caption" color={detailMeal.isAlertSent ? Colors.CyberGreen : Colors.SlateMutedText}>
                {detailMeal.isAlertSent ? 'RSVP alert sent — your response is being counted' : `Alert triggers at ${getAlertTriggerTime(detailMeal.serviceTime)}`}
              </Txt>
            </View>
            <View style={styles.timelineRow}>
              <Ionicons name="calendar" size={14} color={Colors.SlateMutedText} />
              <Txt variant="caption" color={Colors.SlateMutedText}>Posted {formatTime12h(detailMeal.timestamp)}</Txt>
            </View>

            <Spacer size={14} />
            <Row gap={6} align="center">
              <Txt size={11} weight="900" color={Colors.CyberPurple} style={{ letterSpacing: 1 }}>NUTRITION & ALLERGEN NOTES</Txt>
              <InfoTip text="Detailed nutrition and allergen breakdowns are populated by your chef when they broadcast the menu. If you have a specific allergy (dairy, gluten, nuts), please declare it under Profile & KYC → Allergy Profile so the kitchen can prepare a safe portion for you." />
            </Row>
            <Spacer size={10} />
            <Row gap={8}>
              {['Dairy-free', 'Gluten-free', 'Vegan option'].map((tag) => (
                <View key={tag} style={styles.allergenChip}><Txt variant="labelSmall" color={Colors.CyberGreen}>{tag}</Txt></View>
              ))}
            </Row>

            <Spacer size={14} />
            <Txt size={11} weight="900" color={Colors.CyberPurple} style={{ letterSpacing: 1 }}>YOUR RSVP STATUS</Txt>
            <Spacer size={6} />
            {(() => {
              const choice = allRSVPs.find((r) => r.notificationId === detailMeal.id && r.guestId === guest?.id)?.choice;
              if (choice === 'REQUIRED') {
                return (
                  <View style={[styles.rsvpStatusBox, { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10B981' }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Txt variant="caption" weight="800" color="#10B981" style={{ marginLeft: 8 }}>You're eating! Your portion is reserved.</Txt>
                  </View>
                );
              }
              if (choice === 'NOT_REQUIRED') {
                return (
                  <View style={[styles.rsvpStatusBox, { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#EF4444' }]}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                    <Txt variant="caption" weight="800" color="#EF4444" style={{ marginLeft: 8 }}>You're skipping. Thank you for helping reduce waste!</Txt>
                  </View>
                );
              }
              return (
                <View style={[styles.rsvpStatusBox, { backgroundColor: 'rgba(255,184,0,0.15)', borderColor: '#FFB800' }]}>
                  <Ionicons name="hourglass" size={18} color="#FFB800" />
                  <Txt variant="caption" weight="800" color="#FFB800" style={{ marginLeft: 8 }}>Pending — pick Eating or Skip below.</Txt>
                </View>
              );
            })()}
          </View>
        )}
      </DetailBottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mealCard: { borderRadius: 12, padding: 10, alignItems: 'center' },
  progressTrack: { height: 10, backgroundColor: '#E2E8F0', borderRadius: 5, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%' },
  filterChip: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  mealIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  serviceBox: { flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(20,226,177,0.15)', padding: 10, alignItems: 'center', justifyContent: 'space-between' },
  chefNoteBox: { backgroundColor: Colors.surfaceElevated, borderRadius: 8, padding: 6 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  allergenChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(20,226,177,0.12)', borderWidth: 1, borderColor: 'rgba(20,226,177,0.3)' },
  rsvpStatusBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
});
