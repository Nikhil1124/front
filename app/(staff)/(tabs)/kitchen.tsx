/** Chef dashboard "Kitchen" tab or Delivery Agent Profile */
import { useEffect, useState } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Card, Txt, Btn, PGowDialog, Row, Spacer, Col, AnimatedPress } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { useBroadcastNotificationMutation, BROADCAST_AUDIENCE_MAP } from '@/features/notifications/useNotifications';
import { Ionicons } from '@expo/vector-icons';

const ANNOUNCEMENTS = [
  'Special Dessert today! 🍨',
  'Serving started! Come get hot portions! 🍽️',
  'Delay of 10 mins due to prep ⏰',
  'Limited portions available. Hurry! 🏃‍♂️',
  'Chai is ready in the dining area! ☕',
];

export default function ChefKitchenTab() {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'delivery_agent') return <DeliveryProfileRoute />;
  return <ChefKitchenView />;
}

function ChefKitchenView() {
  const dockScroll = useDockScroll();
  const [prepState, setPrepState] = useState('PREPPING');
  const [chefBroadcast, setChefBroadcast] = useState('');
  const [broadcastError, setBroadcastError] = useState<string | undefined>();
  const activePgId = useAuthStore((s) => s.activePgId);
  const broadcastMutation = useBroadcastNotificationMutation(activePgId ?? undefined);
  const { activeMeal } = useActiveMeal();
  const toast = useToast();

  useEffect(() => {
    setPrepState('PREPPING');
  }, [activeMeal?.id]);

  const broadcastToResidents = async (title: string, body: string) => {
    if (!activePgId) {
      toast('error', 'Not sent', 'No active property.');
      return false;
    }
    try {
      await broadcastMutation.mutateAsync({
        pg_id: activePgId,
        target_role: BROADCAST_AUDIENCE_MAP.RESIDENT,
        title,
        body,
        category: 'announcement',
        priority: 'high',
      });
      return true;
    } catch (err) {
      toast('error', 'Not sent', err instanceof Error ? err.message : 'The broadcast did not go out. Check your connection and try again.');
      return false;
    }
  };

  const sendCustomAnnouncement = async () => {
    if (!chefBroadcast.trim()) {
      setBroadcastError('Type a message, or tap one of the quick ones above');
      return;
    }
    const ok = await broadcastToResidents('🍳 Kitchen Update', chefBroadcast.trim());
    if (!ok) return;
    setChefBroadcast('');
    toast('success', 'Announcement sent', 'Every resident has it on their phone.');
  };

  return (
    <FormScroll {...dockScroll} contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
      <ChefGroceriesShortcut />

      <AnimatedPress accessibilityRole="button" onPress={() => router.push('/rsvp-trends')}>
        <Card containerColor={Colors.surfaceElevated} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderGlass} padding={[14, 14]}>
          <Row gap={10} align="center">
            <Ionicons name="trending-up" size={20} color={Colors.primary} />
            <Txt size={13} weight="700" color={Colors.primaryDark} style={{ flex: 1 }}>View RSVP Trends</Txt>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Row>
        </Card>
      </AnimatedPress>

      <Txt size={15} weight="700" color={Colors.textPrimary}>Kitchen Preparation Status</Txt>
      <Spacer size={8} />
      <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
        <Row gap={8}>
          {['PREPPING 🥕', 'COOKING 🔥', 'READY 🍽️'].map((s) => {
            const sel = prepState === s.split(' ')[0];
            return (
              <Btn key={s} onPress={() => setPrepState(s.split(' ')[0])} containerColor={sel ? Colors.primary : Colors.surfaceMuted} textColor={sel ? Colors.textInverse : Colors.textSecondary} borderRadius={Radii.control} height={42} style={{ flex: 1 }}>
                <Txt size={11} weight="700" color={sel ? Colors.textInverse : Colors.textSecondary}>{s}</Txt>
              </Btn>
            );
          })}
        </Row>
        {prepState === 'READY' && (
          <>
            <Spacer size={14} />
            <Btn onPress={async () => { if (await broadcastToResidents('🍽️ Meal is Served', 'Meal is ready! Please come collect your hot portions!')) toast('success', 'Residents alerted', 'They have been told the meal is ready.'); }} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={44}>
              <Txt size={12} weight="700" color={Colors.textInverse}>Broadcast 'Meal is Served' to Residents 📢</Txt>
            </Btn>
          </>
        )}
      </Card>

      {/* A hardcoded "Today's Progress" checklist (fixed fake tasks/times/percentages, a
          static "Last updated: 8:45 AM") used to render here. pg-backend's Meal model has no
          prep-task or percentage-complete tracking at all, so there was no real data behind
          it — removed rather than left showing numbers that never move. */}

      <Spacer size={24} />
      <Txt size={15} weight="700" color={Colors.textPrimary}>Broadcast Custom Message</Txt>
      <Spacer size={12} />
      <OutlinedTextField placeholder="Type your kitchen update" value={chefBroadcast} onChangeText={(v) => { setChefBroadcast(v); if (broadcastError) setBroadcastError(undefined); }} error={broadcastError} multiline numberOfLines={4} />
      
      <Spacer size={20} />
      <Txt size={13} weight="700" color={Colors.textPrimary}>Quick Templates</Txt>
      <Spacer size={10} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ANNOUNCEMENTS.map((msg) => (
          <Btn key={msg} onPress={() => setChefBroadcast(msg)} containerColor={Colors.primaryGlow} textColor={Colors.primaryDark} borderRadius={Radii.control} height={34} contentStyle={{ paddingHorizontal: 12 }}>
            <Txt size={11} weight="700" color={Colors.primaryDark}>{msg}</Txt>
          </Btn>
        ))}
      </View>
      <Spacer size={24} />
      <Btn onPress={sendCustomAnnouncement} disabled={!chefBroadcast.trim()} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.card} height={54}>
        <Txt size={14} weight="700" color={Colors.textInverse}>Send Announcement to Residents 🚀</Txt>
      </Btn>
    </FormScroll>
  );
}

import { useMyTripsQuery } from '@/features/staff/useTrips';
import { useDockScroll } from '@/components/HeadlessDockTabButton';

function DeliveryProfileRoute() {
  const dockScroll = useDockScroll();
  const staff = usePGowStore((s) => s.loggedInStaff);
  const logout = usePGowStore((s) => s.logout);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const { data: realTrips = [], error: tripsError, refetch: refetchTrips, isRefetching: tripsRefetching } = useMyTripsQuery();
  
  const activeTrip = realTrips.find(t => t.status === 'active' || t.status === 'planned') ?? realTrips[0];
  // On a failed fetch this said "Not assigned", telling an agent they have no vehicle when
  // the truth is the trip list never loaded. Pull down to retry.
  const vehicle = tripsError
    ? 'Unavailable — pull to refresh'
    : (activeTrip?.vehicle_label ?? 'Not assigned');

  return (
    <View style={styles.root}>
      <FormScroll
        {...dockScroll}
        bottomPadding={120}
        contentContainerStyle={{ padding: 18, gap: 16 }}
        refreshControl={<RefreshControl refreshing={tripsRefetching} onRefresh={refetchTrips} tintColor={Colors.primary} />}
      >
        <Col align="center" style={{ marginTop: 20 }}>
          <View style={styles.avatarBox}>
            <Ionicons name="bicycle" size={30} color={Colors.primary} />
          </View>
          <Spacer size={12} />
          <Txt size={22} weight="700" color={Colors.primaryDark}>{staff?.name ?? 'Name unavailable'}</Txt>
          <Txt size={14} weight="700" color={Colors.primary}>Delivery Agent</Txt>
          <Spacer size={4} />
          <Txt size={12} color={Colors.textMuted}>Employee ID: {staff?.id ? `DA-${staff.id.slice(0, 4)}` : 'Unavailable'}</Txt>
        </Col>

        <Spacer size={20} />
        <View style={styles.sectionHeader}>
          <Txt size={13} weight="700" color={Colors.textSecondary}>STATUS & CONTACT</Txt>
        </View>
        <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle}>
          <Row justify="space-between" align="center" style={styles.profileRow}>
            <Row gap={12} align="center">
              <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}><Ionicons name="radio-button-on" size={18} color={Colors.success} /></View>
              <Txt size={14} weight="700" color={Colors.textPrimary}>Availability</Txt>
            </Row>
            <Txt size={14} weight="700" color={Colors.success}>Available</Txt>
          </Row>
          <View style={styles.divider} />
          <Row justify="space-between" align="center" style={styles.profileRow}>
            <Row gap={12} align="center">
              <View style={[styles.iconBox, { backgroundColor: Colors.surfaceMuted }]}><Ionicons name="call" size={18} color={Colors.textPrimary} /></View>
              <Txt size={14} weight="700" color={Colors.textPrimary}>Phone</Txt>
            </Row>
            <Txt size={14} weight="700" color={Colors.textMuted}>{staff?.phone ?? 'Not on file'}</Txt>
          </Row>
          <View style={styles.divider} />
          <Row justify="space-between" align="center" style={styles.profileRow}>
            <Row gap={12} align="center">
              <View style={[styles.iconBox, { backgroundColor: Colors.surfaceMuted }]}><Ionicons name="bicycle" size={18} color={Colors.textPrimary} /></View>
              <Txt size={14} weight="700" color={Colors.textPrimary}>Vehicle</Txt>
            </Row>
            <Txt size={14} weight="700" color={Colors.textMuted}>{vehicle}</Txt>
          </Row>
        </Card>

        <Spacer size={16} />
        <Btn onPress={() => setConfirmingSignOut(true)} containerColor={Colors.danger} textColor={Colors.textInverse} borderRadius={Radii.control} height={50}>
          <Ionicons name="exit" size={20} color={Colors.textInverse} />
          <Txt size={14} weight="700" style={{ marginLeft: 8 }}>Sign Out</Txt>
        </Btn>
      </FormScroll>

      <PGowDialog
        visible={confirmingSignOut}
        title="Sign out?"
        message="You will need your PIN to get back in."
        confirmLabel="Sign out"
        tone="destructive"
        onConfirm={() => { setConfirmingSignOut(false); logout(); router.replace('/'); }}
        onCancel={() => setConfirmingSignOut(false)}
      />
</View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  avatarBox: { width: 80, height: 80, borderRadius: Radii.pill, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { paddingHorizontal: 4, paddingBottom: 8 },
  profileRow: { padding: 16 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: 16 },
  iconBox: { width: 32, height: 32, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center' },
});
