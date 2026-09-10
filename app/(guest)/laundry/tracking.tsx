import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { AnimatedPress, Btn, Col, ErrorState, LoadingState, Row, Spacer, Txt } from '@/components/ui';
import { useLaundryOrder } from '@/features/laundry/useLaundryBooking';
import { Timeline, TimelineStep } from '@/features/laundry/components/Timeline';

/**
 * The four stages the server actually has.
 *
 * This screen used to show eleven — Weighed, Washing, Drying, Ironing, Quality Check, Packed
 * — advanced by a row of "[Simulation Controls]" buttons the RESIDENT could press to move
 * their own order along, plus a `setTimeout` that auto-advanced it three seconds after
 * booking. None of it existed anywhere but this screen's memory.
 *
 * A laundry booking is a row in `requests`, which has five statuses. `mappers.HUB_STATUS`
 * already names them for laundry and `updateLaundryStatus` already moves them — from the
 * owner's side, which is who is holding the clothes. These are those four, in order.
 * Cancelled is not a stage; it is handled separately below.
 */
const STAGES = ['Pickup Scheduled', 'Picked Up', 'Washing & Ironing', 'Delivered'] as const;

const STAGE_COPY: Record<string, { icon: string; desc: string }> = {
  'Pickup Scheduled': { icon: 'car', desc: 'Your pickup is booked. Keep your laundry ready for the slot you chose.' },
  'Picked Up': { icon: 'basket', desc: 'Your laundry has been collected and is being sorted.' },
  'Washing & Ironing': { icon: 'water', desc: 'Your clothes are being washed and finished.' },
  Delivered: { icon: 'checkmark-circle', desc: 'Your laundry has been returned to your room.' },
  Cancelled: { icon: 'close-circle', desc: 'This booking was cancelled.' },
};

export default function LaundryTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { order, isLoading, error, refetch, isRefetching } = useLaundryOrder(id);

  if (isLoading && !order) return <LoadingState label="Loading your order…" />;
  if (error && !order) return <ErrorState error={error} title="Could not load this order" onRetry={refetch} />;

  if (!order) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 16), paddingHorizontal: 20 }]}>
        <AnimatedPress accessibilityRole="button" onPress={() => router.replace('/laundry')} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </AnimatedPress>
        <Spacer size={40} />
        <Txt style={styles.emptyTitle}>This order is no longer available.</Txt>
        <Btn style={{ marginTop: 20 }} onPress={() => router.replace('/laundry/orders')}>
          <Txt variant="button" color={Colors.textInverse}>View History</Txt>
        </Btn>
      </View>
    );
  }

  const cancelled = order.status === 'Cancelled';
  const currentIndex = STAGES.indexOf(order.status as (typeof STAGES)[number]);

  const steps: TimelineStep[] = STAGES.map((label, idx) => ({
    id: label,
    label,
    status: cancelled
      ? 'upcoming'
      : idx < currentIndex
        ? 'completed'
        : idx === currentIndex
          ? 'current'
          : 'upcoming',
    subLabel:
      label === 'Pickup Scheduled' && order.pickupDate
        ? [order.pickupDate, order.preferredSlot].filter(Boolean).join(' • ')
        : undefined,
  }));

  const copy = STAGE_COPY[order.status] ?? { icon: 'time', desc: 'Your order is being processed.' };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" justify="space-between" gap={12} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Row align="center" gap={16} style={{ flex: 1 }}>
            <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </AnimatedPress>
            <Txt style={styles.headerTitle} numberOfLines={1}>Laundry Order</Txt>
          </Row>
          <Txt style={styles.headerOrderNo} numberOfLines={1}>#{order.id.slice(0, 8)}</Txt>
        </Row>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >

        {/* TOP STATUS OVERVIEW */}
        <View style={styles.topOverview}>
          <Txt style={styles.statusPill} numberOfLines={2}>{order.status.toUpperCase()}</Txt>
          <Spacer size={8} />
          <Row align="center" gap={8}>
            <Ionicons name="pricetag-outline" size={16} color={Colors.textSecondary} />
            {/* No "estimated return": nothing in the system produces one. It used to read
                "Tomorrow • 6:00 PM – 8:00 PM" on every order, invented at booking time. */}
            <Txt style={styles.estReturnText} numberOfLines={2}>
              {order.weightOrCount || order.serviceType} • ₹{order.totalCost} • {order.paymentStatus || 'Payment on collection'}
            </Txt>
          </Row>
        </View>

        {/* STATUS CARD */}
        <View style={styles.statusCard}>
          <Row align="center" gap={12}>
            <View style={styles.statusIconWrap}>
              <Ionicons name={copy.icon as any} size={24} color={cancelled ? Colors.danger : Colors.primary} />
            </View>
            <Col style={{ flex: 1 }}>
              <Txt style={styles.statusCardTitle} numberOfLines={2}>{order.status}</Txt>
              <Txt style={styles.statusCardDesc} numberOfLines={3}>{copy.desc}</Txt>
            </Col>
          </Row>
        </View>

        {/* TIMELINE */}
        {!cancelled && (
          <View style={styles.timelineCard}>
            <Txt style={styles.timelineTitle}>Progress Timeline</Txt>
            <Spacer size={16} />
            <Timeline steps={steps} />
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: '#F8FAFB' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  headerOrderNo: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },

  emptyTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },

  topOverview: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  statusPill: { fontSize: 13, fontWeight: '800', color: Colors.primaryDark, letterSpacing: 0.5 },
  estReturnText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500', flex: 1 },

  statusCard: { backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statusIconWrap: { width: 48, height: 48, borderRadius: Radii.feature, backgroundColor: '#EBF4EC', alignItems: 'center', justifyContent: 'center' },
  statusCardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  statusCardDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },

  timelineCard: { backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 20, paddingBottom: 4 },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
});
