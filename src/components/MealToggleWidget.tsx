/**
 * MealToggleWidget — the resident's B/L/D opt-in for today, with a live
 * countdown to each meal's cutoff.
 *
 * Three rows (Breakfast / Lunch / Dinner). Each row carries:
 *   - the meal icon (sunrise / sun / sunset from MaterialCommunityIcons),
 *   - the menu summary the kitchen posted (e.g. "Idli + Sambar"),
 *   - a large toggle styled with StatusGreen when on, neutral when off,
 *   - a live "Cutoff in 2h 14m" line beneath, tinted amber under 1h, red under
 *     15m, and muted when the cutoff has already passed.
 *
 * The countdown is driven by `useCountdown`, a tiny inline hook that ticks
 * every second on a `setInterval` and cleans up on unmount or when the target
 * changes. It is defined here rather than in `hooks/` because it is the only
 * consumer in the app today — if a second one appears, lift it then.
 *
 * Why a custom switch instead of `Switch`: the native `Switch` on Android
 * ignores `trackColor` for the thumb tint in some versions and renders pink by
 * default, which collides with the StatusGreen we use everywhere else. A
 * hand-rolled Pressable gives us a single color story across both platforms.
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Txt, Row, Col, Spacer } from '@/components/ui';
import { Colors, Palette, Radii } from '@/theme';
import { haptic } from '@/utils/haptics';
import type { MealToggleState } from '@/types';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealToggleWidgetProps {
  breakfast: MealToggleState;
  lunch: MealToggleState;
  dinner: MealToggleState;
  onToggle: (mealType: MealType, enabled: boolean) => void;
}

interface CountdownResult {
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

/**
 * Tick every second toward `targetMs`. Returns `{hours, minutes, seconds, isPast}`
 * clamped to non-negative values, with `isPast` flipping true the moment the
 * target elapses so the row can switch from "Cutoff in" to "Cutoff passed".
 *
 * The interval is keyed off `targetMs` — when the parent hands in a new cutoff
 * (because the meal rolled over to tomorrow's, or the server returned a fresh
 * one), the effect tears down and restarts with the new target. A `null` target
 * yields all zeros and `isPast: false`, which the row renders as "no cutoff
 * scheduled".
 */
function useCountdown(targetMs: number | null): CountdownResult {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs == null) return; // nothing to count toward
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs == null) {
    return { hours: 0, minutes: 0, seconds: 0, isPast: false };
  }
  const remaining = targetMs - now;
  if (remaining <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, isPast: true };
  }
  const totalSec = Math.floor(remaining / 1000);
  return {
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    isPast: false,
  };
}

const MEAL_META: Record<
  MealType,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tint: string }
> = {
  breakfast: { icon: 'weather-sunny', label: 'Breakfast', tint: Colors.CyberAmber },
  lunch: { icon: 'white-balance-sunny', label: 'Lunch', tint: Colors.CyberGreen },
  dinner: { icon: 'weather-sunset-down', label: 'Dinner', tint: Colors.CyberPurple },
};

export function MealToggleWidget({ breakfast, lunch, dinner, onToggle }: MealToggleWidgetProps) {
  return (
    <Col gap={10}>
      <MealRow mealType="breakfast" state={breakfast} onToggle={onToggle} />
      <MealRow mealType="lunch" state={lunch} onToggle={onToggle} />
      <MealRow mealType="dinner" state={dinner} onToggle={onToggle} />
    </Col>
  );
}

interface MealRowProps {
  mealType: MealType;
  state: MealToggleState;
  onToggle: (mealType: MealType, enabled: boolean) => void;
}

function MealRow({ mealType, state, onToggle }: MealRowProps) {
  const meta = MEAL_META[mealType];
  const countdown = useCountdown(state.nextCutoffMs);

  const handleToggle = () => {
    // Medium impact: this is a real opt-in decision, not a tab switch.
    haptic('medium');
    onToggle(mealType, !state.enabled);
  };

  return (
    <Card containerColor={Colors.LuxurySurfaceDark} borderRadius={Radii.xxl} padding={[14, 14]}>
      <Row align="center" justify="space-between" gap={12}>
        <Row align="center" gap={12} style={{ flex: 1 }}>
          <View style={[styles.iconChip, { backgroundColor: `${meta.tint}22` }]}>
            <MaterialCommunityIcons name={meta.icon} size={22} color={meta.tint} />
          </View>
          <Col style={{ flex: 1 }}>
            <Txt size={14} weight="700" color={Colors.IvoryWhiteText}>
              {meta.label}
            </Txt>
            <Txt size={11} color={Colors.SlateMutedText} numberOfLines={1}>
              {state.menuSummary || 'Menu not posted'}
            </Txt>
          </Col>
        </Row>
        <MealSwitch enabled={state.enabled} onToggle={handleToggle} tint={meta.tint} />
      </Row>

      <Spacer size={10} />
      <CountdownLine state={state} countdown={countdown} />
    </Card>
  );
}

/** Custom toggle. See file header for why we don't use the native `Switch`. */
function MealSwitch({
  enabled,
  onToggle,
  tint,
}: {
  enabled: boolean;
  onToggle: () => void;
  tint: string;
}) {
  const trackColor = enabled ? Palette.StatusGreen : Palette.BorderMid;
  const thumbColor = enabled ? Colors.LuxuryPureBlack : Colors.SlateMutedText;

  // The thumb slides 20px (track width 44 minus thumb 24). Using a plain
  // animated transform would be smoother, but the spring on AnimatedPress is
  // already in use everywhere and a layout animation here would fight it.
  const thumbOffset: ViewStyle = { transform: [{ translateX: enabled ? 20 : 0 }] };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel="Meal opt-in toggle"
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.switchTrack, { backgroundColor: trackColor, borderColor: enabled ? tint : Palette.BorderMid }]}
    >
      <View style={[styles.switchThumb, thumbOffset, { backgroundColor: thumbColor }]} />
    </Pressable>
  );
}

function CountdownLine({ state, countdown }: { state: MealToggleState; countdown: CountdownResult }) {
  // No upcoming cutoff → render nothing, not a "0h 00m" tease.
  if (state.nextCutoffMs == null) {
    return (
      <Txt size={11} color={Colors.SlateMutedText}>
        No cutoff scheduled
      </Txt>
    );
  }

  if (countdown.isPast) {
    return (
      <Row align="center" gap={6}>
        <MaterialCommunityIcons name="clock-outline" size={13} color={Colors.SlateMutedText} />
        <Txt size={11} color={Colors.SlateMutedText}>
          Cutoff passed — skipped
        </Txt>
      </Row>
    );
  }

  const totalMinutes = countdown.hours * 60 + countdown.minutes;
  // The 15-minute and 1-hour thresholds drive the tint. Seconds are shown only
  // under 15 minutes — beyond that, "2h 14m" is the right granularity and a
  // ticking seconds field would just be noise.
  const tint =
    totalMinutes < 15 ? Palette.StatusRed
    : totalMinutes < 60 ? Palette.StatusAmber
    : Colors.SlateMutedText;

  const label =
    totalMinutes < 15
      ? `Cutoff in ${countdown.minutes}m ${countdown.seconds.toString().padStart(2, '0')}s`
      : `Cutoff in ${countdown.hours}h ${countdown.minutes.toString().padStart(2, '0')}m`;

  return (
    <Row align="center" gap={6}>
      <MaterialCommunityIcons name="timer-sand" size={13} color={tint} />
      <Txt size={11} weight="600" color={tint}>
        {label}
      </Txt>
      <Txt size={10} color={Colors.SlateMutedText}>
        · {state.cutoffTime}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 0,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});

export default MealToggleWidget;
