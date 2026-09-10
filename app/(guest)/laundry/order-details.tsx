import { View, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { AnimatedPress, Btn, Col, ErrorState, LoadingState, Row, Spacer, Txt } from '@/components/ui';
import { useLaundryOrder } from '@/features/laundry/useLaundryBooking';

export default function LaundryOrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  // Was "grab the first completed order or active order" out of local state — so this screen
  // showed whichever order happened to be in memory, not the one that was tapped.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { order, isLoading, error, refetch } = useLaundryOrder(id);

  if (isLoading && !order) return <LoadingState label="Loading receipt…" />;
  if (error && !order) return <ErrorState error={error} title="Could not load this receipt" onRetry={refetch} />;

  if (!order) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 16), paddingHorizontal: 20 }]}>
        <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </AnimatedPress>
        <Spacer size={40} />
        <Txt style={{ fontSize: 20, fontWeight: '700' }}>Order not found.</Txt>
      </View>
    );
  }

  const linesTotal = order.items.reduce((sum, l) => sum + l.qty * l.price, 0);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" gap={16} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
          <Col style={{ flex: 1 }}>
            <Txt style={styles.headerTitle} numberOfLines={1}>Order Receipt</Txt>
            <Txt style={styles.headerSubtitle} numberOfLines={1}>#{order.id.slice(0, 8)}</Txt>
          </Col>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* TOP INFO */}
        <View style={styles.infoCard}>
          <Row justify="space-between" gap={12} style={styles.infoRow}>
            <Txt style={styles.infoLabel}>Booking Date</Txt>
            <Txt style={styles.infoValue} numberOfLines={1}>{new Date(order.timestamp).toLocaleDateString()}</Txt>
          </Row>
          <Spacer size={12} />
          <Row justify="space-between" gap={12} style={styles.infoRow}>
            <Txt style={styles.infoLabel}>Pickup</Txt>
            <Txt style={[styles.infoValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
              {[order.pickupDate, order.preferredSlot].filter(Boolean).join(' • ') || '—'}
            </Txt>
          </Row>
          {/* No "Return Date" row: nothing produces one. It showed a fixed invented string. */}
          <Spacer size={12} />
          <Row justify="space-between" gap={12} style={styles.infoRow}>
            <Txt style={styles.infoLabel}>Pickup Location</Txt>
            <Txt style={[styles.infoValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
              {order.roomNo ? `Room ${order.roomNo}` : order.pickupPreference || '—'}
            </Txt>
          </Row>
          <Spacer size={12} />
          <Row justify="space-between" gap={12} style={styles.infoRow}>
            <Txt style={styles.infoLabel}>Status</Txt>
            <Txt style={styles.infoValue} numberOfLines={1}>{order.status}</Txt>
          </Row>
        </View>

        {/* SERVICES */}
        <Txt style={styles.sectionTitle}>Services</Txt>
        <View style={styles.servicesCard}>
          {order.items.length === 0 ? (
            <View style={styles.serviceRow}>
              <Txt style={styles.serviceName} numberOfLines={2}>{order.serviceType || 'Laundry'} • {order.weightOrCount}</Txt>
            </View>
          ) : (
            order.items.map((line, idx) => (
              <View key={`${line.name}-${idx}`}>
                <Row align="center" justify="space-between" gap={12} style={styles.serviceRow}>
                  <Col style={{ flex: 1 }}>
                    <Txt style={styles.serviceName} numberOfLines={2}>{line.qty} {line.unit} × {line.name}</Txt>
                    <Txt style={styles.serviceCat}>₹{line.price} per {line.unit}</Txt>
                  </Col>
                  <Txt style={styles.servicePrice}>₹{line.qty * line.price}</Txt>
                </Row>
                {idx < order.items.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
        </View>

        {/* PRICING */}
        <Txt style={styles.sectionTitle}>Pricing</Txt>
        <View style={styles.pricingCard}>
          {/* The invented ₹30 pickup fee and −₹20 discount are gone. What is charged is the
              lines at the rates they were quoted at, which is what the request stores. */}
          <Row justify="space-between" style={styles.pricingRow}>
            <Txt style={styles.pricingLabel}>Services</Txt>
            <Txt style={styles.pricingValue}>₹{linesTotal}</Txt>
          </Row>

          <Spacer size={16} />
          <View style={styles.dividerDashed} />
          <Spacer size={16} />

          <Row justify="space-between" style={styles.pricingRow}>
            <Txt style={styles.pricingTotalLabel}>
              {order.status === 'Delivered' ? 'Final amount' : 'Estimated amount'}
            </Txt>
            <Txt style={styles.pricingTotalValue}>₹{order.totalCost}</Txt>
          </Row>
        </View>

        {/* PAYMENT */}
        <View style={styles.paymentCard}>
          <Row justify="space-between" align="center" gap={12}>
            <Col style={{ flex: 1 }}>
              <Txt style={styles.paymentLabel}>Payment</Txt>
              <Row align="center" gap={6} style={{ marginTop: 2 }}>
                <Ionicons name="card-outline" size={14} color={Colors.primary} />
                {/* Was hardcoded "UPI • Paid" on every receipt, including the unpaid ones. */}
                <Txt style={styles.paymentMethod} numberOfLines={2}>
                  {order.paymentStatus || 'To be settled on collection'}
                </Txt>
              </Row>
            </Col>
            <Ionicons name="receipt" size={24} color={Colors.borderSubtle} />
          </Row>
        </View>

      </ScrollView>

      {/* BOTTOM ACTIONS */}
      <View style={styles.bottomBar}>
        <Row gap={12}>
          <Btn
            // Was a no-op `() => {}`. Support is where a ticket about this order gets raised.
            onPress={() => router.push('/(guest)/(tabs)/support')}
            containerColor={Colors.surface}
            textColor={Colors.textPrimary}
            borderRadius={Radii.control}
            height={44}
            style={{ flex: 1, borderWidth: 1, borderColor: Colors.borderSubtle }}
          >
            <Txt variant="button" color={Colors.textPrimary}>Report Issue</Txt>
          </Btn>
          <Btn
            onPress={() => router.push('/laundry')}
            containerColor={Colors.primary}
            textColor={Colors.surface}
            borderRadius={Radii.control}
            height={44}
            style={{ flex: 1 }}
          >
            <Txt variant="button" color={Colors.textInverse}>Book Again</Txt>
          </Btn>
        </Row>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  infoCard: { backgroundColor: Colors.surface, padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  infoRow: { alignItems: 'flex-start' },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginHorizontal: 20, marginTop: 24, marginBottom: 12 },

  servicesCard: { backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle },
  serviceRow: { padding: 16 },
  serviceCat: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },
  serviceName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  servicePrice: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: 16 },

  pricingCard: { backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16 },
  pricingRow: { alignItems: 'center' },
  pricingLabel: { fontSize: 14, color: Colors.textSecondary },
  pricingValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  dividerDashed: { height: 1, borderWidth: 1, borderColor: Colors.borderSubtle, borderStyle: 'dashed', borderRadius: Radii.badge },
  pricingTotalLabel: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  pricingTotalValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },

  paymentCard: { backgroundColor: Colors.surface, marginHorizontal: 20, marginTop: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16 },
  paymentLabel: { fontSize: 12, color: Colors.textSecondary },
  paymentMethod: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark, flex: 1 },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
});
