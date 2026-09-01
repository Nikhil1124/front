import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrderStepper } from '../components/grocery/OrderStepper';
import { useSupplyOrderDetailQuery, useSupplyTrackingQuery } from '../useSupplyOrders';
import { Colors, Layout } from '@/theme';

const STATUS_HERO: Record<string, string> = {
  placed: 'Order Placed',
  confirmed: 'Order Confirmed',
  packed: 'Order Packed',
  loaded: 'Loaded on Vehicle',
  dispatched: 'Out for Delivery',
  delivered: 'Order Delivered',
  cancelled: 'Order Cancelled',
};

export function GroceryOrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, refetch, isRefetching } = useSupplyOrderDetailQuery(id as string);
  const { data: tracking, refetch: refetchTracking } = useSupplyTrackingQuery(id as string);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyBox}>
          <Ionicons name="receipt-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.order_no || order.id.slice(-6)}</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Ionicons name="refresh-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => Promise.all([refetch(), refetchTracking()])} />}
      >
        {/* Status Card */}
        <View style={styles.statusHeroCard}>
          <Text style={styles.statusHeroTitle}>{STATUS_HERO[order.status] || order.status.toUpperCase()}</Text>
          <Text style={styles.statusHeroSub}>
            {isDelivered
              ? `Delivered on ${new Date(order.updated_at || order.created_at).toLocaleDateString()}`
              : isCancelled
              ? 'This order was cancelled'
              : 'Tracking live updates from warehouse to delivery'}
          </Text>

          <OrderStepper status={order.status} />

          {isDelivered && (
            <View style={styles.deliveredBadgeRow}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              <Text style={styles.deliveredText}>Order Completed Successfully 🎉</Text>
            </View>
          )}

          {tracking?.trip && (
            <View style={styles.tripInfoBox}>
              <Ionicons name="car-outline" size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tripTitle}>Delivery Vehicle: {tracking.trip.vehicle_label}</Text>
                <Text style={styles.tripSub}>
                  Driver: {tracking.trip.driver_name} ({tracking.trip.driver_phone})
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Order Details & Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <Text style={styles.summaryMeta}>Placed on {new Date(order.created_at).toLocaleString()}</Text>
          {order.delivery_note ? <Text style={styles.summaryMeta}>{order.delivery_note}</Text> : null}
          <Text style={styles.summaryMeta}>Payment Method: {order.payment_method.toUpperCase()}</Text>
          <Text style={styles.summaryMeta}>Payment Status: {order.payment_status.toUpperCase()}</Text>

          <View style={styles.divider} />

          {order.items?.map((item) => (
            <View key={item.id} style={styles.lineItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>
                  {item.item_name} ({item.unit_label}) x {item.quantity}
                </Text>
                {item.status ? (
                  <Text style={styles.lineStatusText}>Status: {item.status}</Text>
                ) : null}
              </View>
              <Text style={styles.linePrice}>₹{Number(item.total_price).toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Taxable Value</Text>
            <Text style={styles.billVal}>₹{Number(order.taxable_amount).toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>GST</Text>
            <Text style={styles.billVal}>₹{Number(order.tax_amount).toFixed(2)}</Text>
          </View>
          <View style={[styles.billRow, { marginTop: 6 }]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalVal}>₹{Number(order.total_amount).toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  statusHeroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Layout.shadowCard,
  },
  statusHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusHeroSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 16,
  },
  deliveredBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
  },
  deliveredText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  tripInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  tripTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tripSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  summaryMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 3,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: 12,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  lineName: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  lineStatusText: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
  },
  linePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  billVal: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  totalVal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
