import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OrderStepper } from '../components/grocery/OrderStepper';
import {
  useSupplyOrderDetailQuery,
  useSupplyTrackingQuery,
  useCancelSupplyOrderMutation,
  useSubmitUpiPaymentMutation,
} from '../useSupplyOrders';
import { ErrorState } from '@/components/ui';
import { Colors, Layout } from '@/theme';
import { formatINR } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, error, refetch, isRefetching } = useSupplyOrderDetailQuery(id as string);
  const { data: tracking, refetch: refetchTracking } = useSupplyTrackingQuery(id as string);
  const cancelOrder = useCancelSupplyOrderMutation();
  const submitUpiPayment = useSubmitUpiPaymentMutation();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [upiRef, setUpiRef] = useState('');

  const handleCancel = async () => {
    if (!order) return;
    if (!cancelReason.trim()) {
      Alert.alert('Reason required', "Please tell us why you're cancelling this order.");
      return;
    }
    try {
      await cancelOrder.mutateAsync({ orderId: order.id, reason: cancelReason.trim() });
      setShowCancelModal(false);
      setCancelReason('');
    } catch (err) {
      Alert.alert('Could not cancel', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleSubmitUpiRef = async () => {
    if (!order) return;
    const ref = upiRef.trim();
    if (ref.length < 6) {
      Alert.alert('Enter a valid reference', 'Enter the UTR / UPI transaction reference from your payment app.');
      return;
    }
    try {
      await submitUpiPayment.mutateAsync({ orderId: order.id, upiRef: ref });
      setUpiRef('');
      Alert.alert('Submitted', 'Your payment reference has been sent for verification.');
    } catch (err) {
      Alert.alert('Could not submit', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Before this, a failed request fell through to the `!order` branch below and told the
  // customer their order was "not found" — i.e. that it no longer exists — when the truth was
  // that the request never arrived. Distinguishing the two is the difference between "retry"
  // and "panic about a delivery you already paid for".
  if (error) {
    return (
      <View style={styles.container}>
        <AppHeader title="Order Tracking" onBack={() => router.back()} />
        <ErrorState
          error={error}
          title="Could not load this order"
          onRetry={refetch}
        />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <AppHeader title="Order Tracking" onBack={() => router.back()} />
        <View style={styles.emptyBox}>
          <Ionicons name="receipt-outline" size={64} color={Colors.textMuted} />
          <Text maxFontSizeMultiplier={1.3} style={styles.emptyText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';
  // The server is the real authority on when a cancel is still allowed (e.g. once dispatched)
  // — this just avoids offering the button on the two states where it obviously can't apply.
  const canCancel = !isDelivered && !isCancelled;
  const needsUpiRef = order.payment_method === 'upi' && order.payment_status === 'pending';

  return (
    <View style={styles.container}>
      <AppHeader
        title={`Order #${order.order_no || order.id.slice(-6)}`}
        onBack={() => router.back()}
        actions={
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Refresh" accessibilityRole="button" onPress={() => refetch()}>
            <Ionicons name="refresh-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => Promise.all([refetch(), refetchTracking()])} />}
      >
        {/* Status Card */}
        <View style={styles.statusHeroCard}>
          <Text maxFontSizeMultiplier={1.3} style={styles.statusHeroTitle}>{STATUS_HERO[order.status] || order.status.toUpperCase()}</Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.statusHeroSub}>
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
              <Text maxFontSizeMultiplier={1.3} style={styles.deliveredText}>Order Completed Successfully 🎉</Text>
            </View>
          )}

          {tracking?.trip && (
            <View style={styles.tripInfoBox}>
              <Ionicons name="car-outline" size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={1.3} style={styles.tripTitle}>Delivery Vehicle: {tracking.trip.vehicle_label}</Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.tripSub}>
                  Driver: {tracking.trip.driver_name} ({tracking.trip.driver_phone})
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Order Details & Summary */}
        <View style={styles.sectionCard}>
          <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Order Summary</Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>Placed on {new Date(order.created_at).toLocaleString()}</Text>
          {order.delivery_note ? <Text maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>{order.delivery_note}</Text> : null}
          <Text maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>Payment Method: {order.payment_method.toUpperCase()}</Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>Payment Status: {order.payment_status.toUpperCase()}</Text>

          <View style={styles.divider} />

          {order.items?.map((item) => (
            <View key={item.id} style={styles.lineItem}>
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={1.3} style={styles.lineName}>
                  {item.item_name} ({item.unit_label}) x {item.quantity}
                </Text>
                {item.status ? (
                  <Text maxFontSizeMultiplier={1.3} style={styles.lineStatusText}>Status: {item.status}</Text>
                ) : null}
              </View>
              <Text maxFontSizeMultiplier={1.3} style={styles.linePrice}>{formatINR(Number(item.total_price), 2)}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.billRow}>
            <Text maxFontSizeMultiplier={1.3} style={styles.billLabel}>Taxable Value</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.billVal}>{formatINR(Number(order.taxable_amount), 2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text maxFontSizeMultiplier={1.3} style={styles.billLabel}>GST</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.billVal}>{formatINR(Number(order.tax_amount), 2)}</Text>
          </View>
          <View style={[styles.billRow, { marginTop: 6 }]}>
            <Text maxFontSizeMultiplier={1.3} style={styles.totalLabel}>Total Amount</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.totalVal}>{formatINR(Number(order.total_amount), 2)}</Text>
          </View>
        </View>

        {needsUpiRef && (
          <View style={styles.sectionCard}>
            <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Confirm UPI Payment</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>Paid via UPI? Enter the reference so it can be verified.</Text>
            <View style={styles.upiRow}>
              <TextInput maxFontSizeMultiplier={1.3} accessibilityLabel="12-digit UTR / UPI Ref"
                style={styles.upiInput}
                placeholder="12-digit UTR / UPI Ref"
                placeholderTextColor={Colors.textMuted}
                value={upiRef}
                onChangeText={setUpiRef}
                keyboardType="number-pad"
                maxLength={22}
              />
              <TouchableOpacity accessibilityRole="button"
                style={[styles.upiSubmitBtn, (!upiRef.trim() || submitUpiPayment.isPending) && styles.btnDisabled]}
                onPress={handleSubmitUpiRef}
                disabled={!upiRef.trim() || submitUpiPayment.isPending}
                activeOpacity={0.8}
              >
                <Text maxFontSizeMultiplier={1.3} style={styles.upiSubmitText}>{submitUpiPayment.isPending ? 'Submitting…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {canCancel && (
          <TouchableOpacity accessibilityRole="button" style={styles.cancelOrderBtn} onPress={() => setShowCancelModal(true)} activeOpacity={0.8}>
            <Ionicons name="close-circle-outline" size={18} color={Colors.danger} />
            <Text maxFontSizeMultiplier={1.3} style={styles.cancelOrderBtnText}>Cancel Order</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding">
          <View style={styles.modalCard}>
            <Text maxFontSizeMultiplier={1.3} style={styles.modalTitle}>Cancel this order?</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.modalSub}>This can't be undone. Let us know why.</Text>
            <TextInput maxFontSizeMultiplier={1.3} accessibilityLabel="Reason for cancelling"
              style={styles.modalInput}
              placeholder="Reason for cancelling"
              placeholderTextColor={Colors.textMuted}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" style={styles.modalKeepBtn} onPress={() => setShowCancelModal(false)} activeOpacity={0.8}>
                <Text maxFontSizeMultiplier={1.3} style={styles.modalKeepText}>Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button"
                style={[styles.modalConfirmBtn, cancelOrder.isPending && styles.btnDisabled]}
                onPress={handleCancel}
                disabled={cancelOrder.isPending}
                activeOpacity={0.8}
              >
                <Text maxFontSizeMultiplier={1.3} style={styles.modalConfirmText}>{cancelOrder.isPending ? 'Cancelling…' : 'Cancel Order'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    backgroundColor: Colors.surfaceElevated,
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
    backgroundColor: Colors.surfaceMuted,
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
  upiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  upiInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  upiSubmitBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  cancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    marginTop: 4,
  },
  cancelOrderBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.danger,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  modalInput: {
    marginTop: 14,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 12,
    fontSize: 13,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalKeepBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalKeepText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
