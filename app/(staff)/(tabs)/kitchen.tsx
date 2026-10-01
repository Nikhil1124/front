/** Chef dashboard "Kitchen" tab or Delivery Agent Profile */
import { useEffect, useState } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Card, Txt, Btn, PGowDialog, Row, Spacer, Col } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { Colors, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { FormScroll } from '@/components/ui/FormScroll';
import { useActiveMeal } from '@/features/staff/useActiveMeal';
import { useBroadcastNotificationMutation, BROADCAST_AUDIENCE_MAP } from '@/features/notifications/useNotifications';
import { Ionicons } from '@expo/vector-icons';

import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { RSVPTrendCard } from '@/features/kitchen/components/RSVPTrendCard';
import { KitchenPreparationCard, PrepStage } from '@/features/kitchen/components/KitchenPreparationCard';
import { BroadcastComposer } from '@/features/kitchen/components/BroadcastComposer';
import { ScheduledBroadcastCard } from '@/features/kitchen/components/ScheduledBroadcastCard';
import { useMyTripsQuery } from '@/features/staff/useTrips';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { useMealResponsesQuery, useUpdatePrepStatusMutation, type PrepStatus } from '@/features/meals/useMeals';
import { parseTime } from '@/utils/format';

export default function ChefKitchenTab() {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole === 'delivery_agent') return <DeliveryProfileRoute />;
  return <ChefKitchenView />;
}

function ChefKitchenView() {
  const dockScroll = useDockScroll();
  const [composerMessage, setComposerMessage] = useState('');
  
  const activePgId = useAuthStore((s) => s.activePgId);
  const broadcastMutation = useBroadcastNotificationMutation(activePgId ?? undefined);
  const { activeMeal } = useActiveMeal();
  const toast = useToast();

  // The stage lives on the meal, on the server — it used to be state here, so it went back to
  // Prepping every time the app restarted. A tap shows at once and is saved behind it.
  const updatePrep = useUpdatePrepStatusMutation(activePgId ?? undefined);
  const [pendingStage, setPendingStage] = useState<PrepStage | null>(null);
  const prepStage: PrepStage =
    pendingStage ?? ((activeMeal?.prepStatus ?? 'prepping').toUpperCase() as PrepStage);
  const setPrepStage = (stage: PrepStage) => {
    if (!activeMeal) return;
    setPendingStage(stage);
    updatePrep.mutate(
      { mealId: activeMeal.id, prepStatus: stage.toLowerCase() as PrepStatus },
      {
        // The saved stage is in the refetched meal now; holding the tap any longer would hide
        // a change another cook makes later.
        onSuccess: () => setPendingStage(null),
        onError: (err) => {
          setPendingStage(null);
          toast('error', 'Not saved', err instanceof Error ? err.message : 'Check your connection and try again.');
        },
      },
    );
  };
  
  const { data: mealResponses = [] } = useMealResponsesQuery(activeMeal?.id, activePgId ?? undefined);

  const eatingCount = mealResponses.filter(r => r.choice === 'eating').length;
  const skippingCount = mealResponses.filter(r => r.choice === 'skipping').length;
  const noReplyCount = mealResponses.filter(r => r.choice === null).length;
  
  const portionsToPrepare = eatingCount + noReplyCount;

  // Derive estimated time from activeMeal
  let displayTime = "Not Set";
  if (activeMeal?.serviceTime) {
    const { hour, minute } = parseTime(activeMeal.serviceTime);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    displayTime = `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
  }

  // No portions-prepared figure. It used to be derived from the stage —
  // `floor(portionsToPrepare / 2)` on COOKING — which is not a count of anything; nobody
  // tallies plates, so the card reports the RSVP numbers it actually has.

  // A different meal brings its own saved stage.
  useEffect(() => {
    setPendingStage(null);
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
      toast('error', 'Not sent', err instanceof Error ? err.message : 'The broadcast did not go out.');
      return false;
    }
  };

  const handleBroadcastReady = async () => {
    const ok = await broadcastToResidents('🍽️ Meal is Served', 'Meal is ready! Please come collect your hot portions!');
    if (ok) {
      toast('success', 'Residents alerted', 'They have been told the meal is ready.');
    }
  };

  const handleSendCustomAnnouncement = async () => {
    if (!composerMessage.trim()) return;
    const ok = await broadcastToResidents('🍳 Kitchen Update', composerMessage.trim());
    if (ok) {
      setComposerMessage('');
      toast('success', 'Announcement sent', 'Every resident has it on their phone.');
    }
  };

  return (
    <FormScroll {...dockScroll} contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 24, backgroundColor: '#FAFAF7' }}>
      <ChefGroceriesShortcut />
      
      <RSVPTrendCard
        eatingCount={eatingCount}
        skippingCount={skippingCount}
        noReplyCount={noReplyCount}
      />

      <KitchenPreparationCard
        currentStage={prepStage}
        onStageChange={setPrepStage}
        estimatedTime={displayTime}
        confirmedCount={eatingCount}
        expectedResidents={portionsToPrepare}
        onBroadcastReady={handleBroadcastReady}
      />

      <BroadcastComposer
        message={composerMessage}
        onChangeMessage={setComposerMessage}
        onPreview={() => {
          if (!composerMessage.trim()) {
             toast('error', 'Empty Message', 'Please enter a message to preview.');
             return;
          }
          toast('success', 'Preview', composerMessage);
        }}
      />

      <ScheduledBroadcastCard />

      <Btn 
        onPress={handleSendCustomAnnouncement} 
        disabled={!composerMessage.trim() || broadcastMutation.isPending} 
        loading={broadcastMutation.isPending}
        containerColor={Colors.primary} 
        textColor={Colors.textInverse} 
        borderRadius={Radii.card} 
        height={56}
        style={{ marginTop: 8 }}
      >
        <Row gap={8} align="center">
          <Ionicons name="send" size={16} color={Colors.textInverse} />
          <Txt size={15} weight="800" color={Colors.textInverse}>Send Announcement to Residents 🚀</Txt>
        </Row>
      </Btn>
    </FormScroll>
  );
}

/** The laundry provider's profile tab. Same sign-out confirmation every other role gets. */
function DeliveryProfileRoute() {
  const dockScroll = useDockScroll();
  const staff = usePGowStore((s) => s.loggedInStaff);
  const logout = usePGowStore((s) => s.logout);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const { data: realTrips = [], error: tripsError, refetch: refetchTrips, isRefetching: tripsRefetching } = useMyTripsQuery();
  
  const activeTrip = realTrips.find(t => t.status === 'active' || t.status === 'planned') ?? realTrips[0];
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
