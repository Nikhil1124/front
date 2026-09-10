import { View, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { Btn, Col, ErrorState, LoadingState, Row, Spacer, Txt } from '@/components/ui';
import { useLaundryOrder } from '@/features/laundry/useLaundryBooking';

export default function LaundryConfirmationScreen() {
  const insets = useSafeAreaInsets();
  // The id of the request that was just created, handed over by the booking screen. It used
  // to read a local `activeOrder` that only existed in memory, so a reload showed a blank
  // screen and the "order" it was confirming had never reached the server at all.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { order, isLoading, error, refetch } = useLaundryOrder(id);

  if (isLoading && !order) return <LoadingState label="Confirming your booking…" />;
  if (error && !order) return <ErrorState error={error} title="Could not load this booking" onRetry={refetch} />;
  if (!order) {
    return (
      <ErrorState
        title="Booking not found"
        error={new Error('This booking is no longer available.')}
        onRetry={() => router.replace('/laundry/orders')}
      />
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 140 }}>

        <Spacer size={insets.top + 20} />

        <View style={styles.successCircle}>
          <Ionicons name="checkmark" size={60} color={Colors.textInverse} />
        </View>

        <Spacer size={24} />

        <Txt style={styles.title} numberOfLines={2}>Laundry Booking Confirmed</Txt>
        <Txt style={styles.subtitle}>{order.serviceType} • {order.weightOrCount}</Txt>

        <Spacer size={32} />

        <View style={styles.detailsCard}>
          <Row align="flex-start" gap={12} style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="calendar" size={18} color={Colors.primary} />
            </View>
            <Col style={{ flex: 1 }}>
              <Txt style={styles.detailLabel}>Pickup Schedule</Txt>
              <Txt style={styles.detailValue} numberOfLines={2}>
                {[order.pickupDate, order.preferredSlot].filter(Boolean).join(' • ') || 'To be confirmed'}
              </Txt>
            </Col>
          </Row>

          <View style={styles.divider} />

          <Row align="flex-start" gap={12} style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="location" size={18} color={Colors.primary} />
            </View>
            <Col style={{ flex: 1 }}>
              <Txt style={styles.detailLabel}>Pickup Location</Txt>
              <Txt style={styles.detailValue} numberOfLines={2}>
                {order.roomNo ? `Room ${order.roomNo}` : order.pickupPreference}
              </Txt>
            </Col>
          </Row>

          <View style={styles.divider} />

          <Row align="flex-start" gap={12} style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="card" size={18} color={Colors.primary} />
            </View>
            <Col style={{ flex: 1 }}>
              <Txt style={styles.detailLabel}>Payment</Txt>
              <Txt style={styles.detailValue} numberOfLines={2}>{order.paymentStatus || '—'}</Txt>
            </Col>
          </Row>
        </View>

        <Spacer size={24} />

        <View style={styles.summaryCard}>
          <Txt style={styles.summaryTitle}>Services</Txt>
          <Spacer size={12} />
          {order.items.map((line) => (
            <Row key={`${line.name}-${line.unit}`} justify="space-between" style={{ marginBottom: 8, gap: 12 }}>
              <Txt style={[styles.summaryItem, { flex: 1 }]} numberOfLines={2}>
                {line.qty} × {line.name}
              </Txt>
              <Txt style={styles.summaryItem}>₹{line.qty * line.price}</Txt>
            </Row>
          ))}

          <Spacer size={12} />
          <View style={styles.dividerDashed} />
          <Spacer size={12} />

          <Row justify="space-between">
            <Txt style={styles.summaryTotalLabel}>Estimated Total</Txt>
            <Txt style={styles.summaryTotalValue}>₹{order.totalCost}</Txt>
          </Row>
        </View>

      </ScrollView>

      {/* FIXED BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <Btn
          onPress={() => router.replace({ pathname: '/laundry/tracking', params: { id: order.id } })}
          containerColor={Colors.primary}
          textColor={Colors.surface}
          borderRadius={Radii.control}
          height={50}
        >
          <Txt variant="button" color={Colors.textInverse}>Track Laundry</Txt>
        </Btn>
        <Spacer size={12} />
        <Btn
          onPress={() => router.replace({ pathname: '/laundry/order-details', params: { id: order.id } })}
          containerColor={Colors.surface}
          textColor={Colors.textPrimary}
          borderRadius={Radii.control}
          height={50}
          style={{ borderWidth: 1, borderColor: Colors.borderSubtle }}
        >
          <Txt variant="button" color={Colors.textPrimary}>View Order Details</Txt>
        </Btn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },

  successCircle: { width: 100, height: 100, borderRadius: Radii.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.primaryDark, textAlign: 'center' },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },

  detailsCard: { backgroundColor: Colors.surface, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle },
  detailRow: { padding: 16 },
  iconWrap: { width: 36, height: 36, borderRadius: Radii.card, backgroundColor: '#EBF4EC', alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  detailValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginLeft: 64 },

  summaryCard: { backgroundColor: Colors.surface, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  summaryItem: { fontSize: 14, color: Colors.textSecondary },
  dividerDashed: { height: 1, borderWidth: 1, borderColor: Colors.borderSubtle, borderStyle: 'dashed', borderRadius: Radii.badge },
  summaryTotalLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  summaryTotalValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
});
