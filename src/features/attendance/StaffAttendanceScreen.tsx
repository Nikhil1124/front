/**
 * StaffAttendanceScreen — QR + geofence clock-in.
 *
 * Layout:
 *   - Top: staff name, today's date, current shift info (start/end), shift
 *     status (off-day / scheduled / completed).
 *   - Big PUNCH IN button (200×60, CyberGreen). Two paths:
 *       * "Use QR" — shows a notice that `expo-camera` is not installed;
 *         geofence check-in is the available path.
 *       * "Use Geofence" — uses `expo-location` to get current location and
 *         calls `POST /v1/attendance/punch-in` with method='geofence', lat, lng.
 *   - After punch-in: show punch-in time + PUNCH OUT (red) button.
 *   - Weekly schedule view (7 day cards with shift start/end or "Off Day").
 *   - Bottom: list of recent attendance punches (last 7 days).
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { Card, Txt, Btn, Row, Col, Spacer, Divider } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { InfoTip } from '@/components/ui/InfoTip';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import { formatLongDate, formatTime12h, todayLocalISO } from '@/utils/format';
import { useDeviceLocation } from '@/features/places/useDeviceLocation';
import {
  useMyTodayShift,
  usePunches,
  usePunchIn,
  usePunchOut,
  useWeeklySchedule,
  type WeeklyScheduleDay,
} from '@/features/attendance/useAttendance';
import type { AttendancePunch, StaffShift } from '@/types';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StaffAttendanceScreen() {
  const staff = usePGowStore((s) => s.loggedInStaff);
  const activePgId = useAuthStore((s) => s.activePgId);
  const user = useAuthStore((s) => s.user);
  const staffMembershipId =
    user?.memberships.find((m) => m.pg_id === activePgId && (m.role === 'chef' || m.role === 'kitchen_staff' || m.role === 'maintenance' || m.role === 'manager'))?.membership_id ?? null;
  const toast = useToast();
  const { refreshing, onRefresh } = usePullToRefresh();
  const { requestPermission } = useDeviceLocation();

  const today = new Date();
  const todayIso = todayLocalISO(today);

  // This week's Sunday as the week-start date (server expects YYYY-MM-DD).
  const weekStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay()); // back to Sunday
    return todayLocalISO(d);
  }, [today]);

  const { data: todayShifts = [] } = useMyTodayShift(activePgId, staffMembershipId);
  const todayShift: StaffShift | null = todayShifts[0] ?? null;
  const { data: weekly } = useWeeklySchedule(activePgId, staffMembershipId, weekStart);

  // Last 7 days of punches — windowed query.
  const weekAgo = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return todayLocalISO(d);
  }, [today]);
  const { data: punches = [] } = usePunches(activePgId, staffMembershipId, weekAgo, todayIso);

  const punchIn = usePunchIn(activePgId);
  const punchOut = usePunchOut(activePgId);

  // Find today's punch (if any).
  const todayPunch = useMemo(() => {
    return punches.find((p: AttendancePunch) => todayLocalISO(new Date(p.punchInAt)) === todayIso) ?? null;
  }, [punches, todayIso]);

  const isOffDay = todayShift?.isOffDay ?? false;
  const isCompleted = todayPunch?.status === 'completed';

  // Geofence punch-in: ask for foreground location, take a fix, post.
  const doGeofencePunchIn = async () => {
    if (!todayShift) {
      hapticError();
      toast('error', 'No shift today', 'You have no scheduled shift for today.');
      return;
    }
    if (todayShift.isOffDay) {
      hapticError();
      toast('error', 'Off day', "Today is marked as your day off — there's no shift to clock into.");
      return;
    }
    try {
      const granted = await requestPermission();
      if (!granted) {
        hapticError();
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      hapticSelect();
      await punchIn.mutateAsync({
        shift_id: todayShift.id,
        method: 'geofence',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      hapticSuccess();
      toast('success', 'Punched in', `Geofence check-in at ${formatTime12h(Date.now())}.`);
    } catch (err: any) {
      hapticError();
      toast('error', 'Punch-in failed', err?.message ?? 'Please try again or contact the manager.');
    }
  };

  const doGeofencePunchOut = async () => {
    if (!todayPunch) return;
    try {
      const granted = await requestPermission();
      if (!granted) {
        hapticError();
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      hapticSelect();
      await punchOut.mutateAsync({
        punchId: todayPunch.id,
        method: 'geofence',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      hapticSuccess();
      toast('success', 'Punched out', `Geofence check-out at ${formatTime12h(Date.now())}.`);
    } catch (err: any) {
      hapticError();
      toast('error', 'Punch-out failed', err?.message ?? 'Please try again.');
    }
  };

  const showQrNotice = () => {
    Alert.alert(
      'QR scanner unavailable',
      'QR scanner requires expo-camera, which is not installed in this build. Geofence check-in is available — tap "Use Geofence".',
      [{ text: 'OK' }],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        {/* Header */}
        <Card containerColor={Colors.surface} borderRadius={Radii.huge} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
          <Row justify="space-between" align="center">
            <Col>
              <Txt size={20} weight="900" color={Colors.primaryDark}>Attendance</Txt>
              <Txt size={12} color={Colors.textMuted}>{staff?.name ?? 'Staff'} · {formatLongDate(today.getTime())}</Txt>
            </Col>
            <View style={styles.headerIcon}><Ionicons name="time" size={24} color={Colors.primary} /></View>
          </Row>
          <Spacer size={12} />
          <Row gap={8} align="center">
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Txt size={12} color={Colors.textSecondary}>
              {isOffDay
                ? 'Off day — no shift scheduled'
                : todayShift
                  ? `Shift: ${todayShift.shiftStart}–${todayShift.shiftEnd}`
                  : 'No shift scheduled'}
            </Txt>
          </Row>
          <Row gap={8} align="center" style={{ marginTop: 4 }}>
            <Ionicons name="radio-button-on" size={12} color={isCompleted ? Colors.success : isOffDay ? Colors.textMuted : Colors.warning} />
            <Txt size={11} weight="800" color={isCompleted ? Colors.success : isOffDay ? Colors.textMuted : '#B45309'}>
              {isCompleted ? 'Shift completed' : isOffDay ? 'Off day' : todayPunch ? 'Clocked in' : 'Not yet clocked in'}
            </Txt>
          </Row>
        </Card>

        {/* Punch action card */}
        <Card containerColor={Colors.surface} borderRadius={Radii.huge} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
          {isOffDay ? (
            <Col align="center" gap={8}>
              <Ionicons name="moon-outline" size={22} color={Colors.textMuted} />
              <Txt size={13} weight="800" color={Colors.textMuted}>Off day — no shift to clock into</Txt>
            </Col>
          ) : !todayPunch ? (
            <Col align="center" gap={12}>
              <Row gap={6} align="center">
                <Txt size={16} weight="900" color={Colors.textPrimary}>Punch In</Txt>
                <InfoTip text="Choose a check-in method. QR requires expo-camera (not installed); geofence uses your GPS." />
              </Row>
              <Btn
                onPress={doGeofencePunchIn}
                loading={punchIn.isPending}
                containerColor={Colors.primary}
                textColor="#FFFFFF"
                borderRadius={Radii.lg}
                height={54}
                width={220}
                testID="punch_in_geofence_btn"
              >
                <Ionicons name="location" size={20} color="#FFFFFF" />
                <Txt size={16} weight="900" color="#FFFFFF" style={{ marginLeft: 8 }}>PUNCH IN</Txt>
              </Btn>
              <AnimatedPress scale={0.95} hapticPattern="light" onPress={showQrNotice}>
                <View style={styles.qrNoticeBtn}>
                  <Ionicons name="qr-code" size={14} color={Colors.textMuted} />
                  <Txt size={11} weight="700" color={Colors.textMuted} style={{ marginLeft: 4 }}>Use QR (unavailable)</Txt>
                </View>
              </AnimatedPress>
            </Col>
          ) : (
            <Col align="center" gap={10}>
              <Txt size={13} color={Colors.textMuted}>Punched in at</Txt>
              <Txt size={28} weight="900" color={Colors.primaryDark}>{formatTime12h(new Date(todayPunch.punchInAt).getTime())}</Txt>
              <Txt size={11} color={Colors.textMuted}>via {todayPunch.punchInMethod}</Txt>
              {!isCompleted ? (
                <Btn
                  onPress={doGeofencePunchOut}
                  loading={punchOut.isPending}
                  containerColor={Colors.danger}
                  textColor="#FFFFFF"
                  borderRadius={Radii.lg}
                  height={52}
                  width={220}
                  testID="punch_out_btn"
                >
                  <Ionicons name="log-out" size={20} color="#FFFFFF" />
                  <Txt size={16} weight="900" color="#FFFFFF" style={{ marginLeft: 8 }}>PUNCH OUT</Txt>
                </Btn>
              ) : (
                <Txt size={13} weight="800" color={Colors.success}>Shift completed ✅</Txt>
              )}
            </Col>
          )}
        </Card>

        {/* Weekly schedule */}
        <Txt size={15} weight="900" color={Colors.textPrimary}>This Week</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(weekly?.days ?? []).map((day: WeeklyScheduleDay) => {
            const d = new Date(day.date);
            const isToday = day.date === todayIso;
            const isOff = !day.shift || day.shift.isOffDay;
            const isDone = day.punch?.status === 'completed';
            return (
              <View
                key={day.date}
                style={[
                  styles.dayCard,
                  {
                    borderColor: isToday ? Colors.primary : isDone ? '#BBF7D0' : Colors.borderSubtle,
                    backgroundColor: isToday ? '#E6FAF5' : isOff ? Colors.surfaceMuted : Colors.surface,
                    borderWidth: isToday ? 2 : 1,
                  },
                ]}
              >
                <Txt size={10} weight="900" color={isToday ? Colors.primaryDark : Colors.textMuted} align="center">
                  {WEEKDAY_SHORT[d.getDay()]}
                </Txt>
                <Txt size={15} weight="900" color={Colors.textPrimary} align="center">{d.getDate()}</Txt>
                <Txt size={9} color={isOff ? Colors.textMuted : Colors.textSecondary} align="center">
                  {isOff ? 'Off Day' : `${day.shift!.shiftStart}–${day.shift!.shiftEnd}`}
                </Txt>
                {day.punch && (
                  <Txt size={9} weight="900" color={isDone ? Colors.success : '#B45309'} align="center">
                    {isDone ? '✓ Done' : '• In'}
                  </Txt>
                )}
              </View>
            );
          })}
          {!weekly && <Txt size={11} color={Colors.textMuted}>Loading weekly schedule…</Txt>}
        </ScrollView>

        {/* Recent punches */}
        <Txt size={15} weight="900" color={Colors.textPrimary}>Recent Punches (Last 7 Days)</Txt>
        {punches.length === 0 ? (
          <EmptyState icon="time-outline" title="No punches recorded" subtitle="Your clock-in/out history will appear here." accent={Colors.primary} />
        ) : (
          <Col gap={8}>
            {punches.slice(0, 14).map((p: AttendancePunch) => (
              <PunchRow key={p.id} punch={p} />
            ))}
          </Col>
        )}
      </ScrollView>
    </View>
  );
}

function PunchRow({ punch }: { punch: AttendancePunch }) {
  const inAt = new Date(punch.punchInAt);
  const outAt = punch.punchOutAt ? new Date(punch.punchOutAt) : null;
  const isCompleted = punch.status === 'completed';
  return (
    <Card containerColor={Colors.surface} borderRadius={Radii.xxl} borderWidth={1} borderColor={Colors.borderSubtle} padding={[12, 14]}>
      <Row justify="space-between" align="center">
        <Col>
          <Txt size={13} weight="800" color={Colors.textPrimary}>{inAt.toLocaleDateString()} · {formatTime12h(inAt.getTime())}</Txt>
          <Txt size={11} color={Colors.textMuted}>
            via {punch.punchInMethod}
            {outAt ? ` → ${formatTime12h(outAt.getTime())} (${punch.punchOutMethod ?? 'manual'})` : ' — still in'}
          </Txt>
        </Col>
        <View style={[styles.statusPill, { backgroundColor: isCompleted ? '#F0FDF4' : '#FFFBEB', borderColor: isCompleted ? '#BBF7D0' : '#FEF3C7', borderWidth: 1 }]}>
          <Txt size={10} weight="900" color={isCompleted ? '#15803D' : '#B45309'}>
            {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
          </Txt>
        </View>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  qrNoticeBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  dayCard: {
    width: 72, paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 4,
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});

export default StaffAttendanceScreen;
