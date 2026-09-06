import { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Alert, KeyboardAvoidingView } from 'react-native';

import { AnimatedPress, Txt } from '@/components/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OrderStepper } from '../components/grocery/OrderStepper';
import {
  useSupplyOrderDetailQuery,
  useSupplyTrackingQuery,
  useCancelSupplyOrderMutation,
  useSubmitUpiPaymentMutation } from '../useSupplyOrders';
import { ErrorState, OutlinedTextField, Sheet, Btn, Txt } from '@/components/ui';
import { Radii, Colors, Layout } from '@/theme';
import { formatINR } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';

const STATUS_HERO: Record<string, string> = {
  placed: 'Order Placed',
  confirmed: 'Order Confirmed',
  packed: 'Order Packed',
  loaded: 'Loaded on Vehicle',
  dispatched: 'Out for Delivery',
  delivered: 'Order Delivered',
  cancelled: 'Order Cancelled' };

export function GroceryOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, error, refetch, isRefetching } = useSupplyOrderDetailQuery(id as string);
  const { data: tracking, refetch: refetchTracking } = useSupplyTrackingQuery(id as string);
  const cancelOrder = useCancelSupplyOrderMutation();
  const submitUpiPayment = useSubmitUpiPaymentMutation();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | undefined>();
  const [upiError, setUpiError] = useState<string | undefined>();
  const [upiRef, setUpiRef] = useState('');

  const handleCancel = async () => {
    if (!order) return;
    if (!cancelReason.trim()) {
      setCancelError("Tell us why — the shop sees this");
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
      setUpiError('Paste the UTR from your payment app');
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
          <Txt maxFontSizeMultiplier={1.3} style={styles.emptyText}>Order not found</Txt>
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
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Refresh" accessibilityRole="button" onPress={() => refetch()}>
            <Ionicons name="refresh-outline" size={22} color={Colors.textPrimary} />
          </AnimatedPress>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => Promise.all([refetch(), refetchTracking()])} />}
      >
        {/* Status Card */}
        <View style={styles.statusHeroCard}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.statusHeroTitle}>{STATUS_HERO[order.status] || order.status.toUpperCase()}</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.statusHeroSub}>
            {isDelivered
              ? `Delivered on ${new Date(order.updated_at || order.created_at).toLocaleDateString()}`
              : isCancelled
              ? 'This order was cancelled'
              : 'Tracking live updates from warehouse to delivery'}
          </Txt>

          <OrderStepper status={order.status} />

          {isDelivered && (
            <View style={styles.deliveredBadgeRow}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.deliveredText}>Order Completed Successfully 🎉</Txt>
            </View>
          )}

          {tracking?.trip && (
            <View style={styles.tripInfoBox}>
              <Ionicons name="car-outline" size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.tripTitle}>Delivery Vehicle: {tracking.trip.vehicle_label}</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.tripSub}>
                  Driver: {tracking.trip.driver_name} ({tracking.trip.driver_phone})
                </Txt>
              </View>
            </View>
          )}
        </View>

        {/* Order Details & Summary */}
        <View style={styles.sectionCard}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Order Summary</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>Placed on {new Date(order.created_at).toLocaleString()}</Txt>
          {order.delivery_note ? <Txt maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>{order.delivery_note}</Txt> : null}
          <Txt maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>Payment Method: {order.payment_method.toUpperCase()}</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>Payment Status: {order.payment_status.toUpperCase()}</Txt>

          <View style={styles.divider} />

          {order.items?.map((item) => (
            <View key={item.id} style={styles.lineItem}>
              <View style={{ flex: 1 }}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.lineName}>
                  {item.item_name} ({item.unit_label}) x {item.quantity}
                </Txt>
                {item.status ? (
                  <Txt maxFontSizeMultiplier={1.3} style={styles.lineStatusText}>Status: {item.status}</Txt>
                ) : null}
              </View>
              <Txt maxFontSizeMultiplier={1.3} style={styles.linePrice}>{formatINR(Number(item.total_price), 2)}</Txt>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.billRow}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>Taxable Value</Txt>
            <Txt maxFontSizeMultiplier={1.3} style={styles.billVal}>{formatINR(Number(order.taxable_amount), 2)}</Txt>
          </View>
          <View style={styles.billRow}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.billLabel}>GST</Txt>
            <Txt maxFontSizeMultiplier={1.3} style={styles.billVal}>{formatINR(Number(order.tax_amount), 2)}</Txt>
          </View>
          <View style={[styles.billRow, { marginTop: 6 }]}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.totalLabel}>Total Amount</Txt>
            <Txt maxFontSizeMultiplier={1.3} style={styles.totalVal}>{formatINR(Number(order.total_amount), 2)}</Txt>
          </View>
        </View>

        {needsUpiRef && (
          <View style={styles.sectionCard}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Confirm UPI Payment</Txt>
            <Txt maxFontSizeMultiplier={1.3} style={styles.summaryMeta}>Paid via UPI? Enter the reference so it can be verified.</Txt>
            <View style={styles.upiRow}>
              <OutlinedTextField
                style={{ flex: 1 }}
                placeholder="12-digit UTR / UPI Ref"
                value={upiRef}
                onChangeText={(v) => { setUpiRef(v); if (upiError) setUpiError(undefined); }}
                error={upiError}
                keyboardType="number-pad"
                maxLength={22}
              />
              <AnimatedPress accessibilityRole="button"
                style={[styles.upiSubmitBtn, (!upiRef.trim() || submitUpiPayment.isPending) && styles.btnDisabled]}
                onPress={handleSubmitUpiRef}
                disabled={!upiRef.trim() || submitUpiPayment.isPending}

              >
                <Txt maxFontSizeMultiplier={1.3} style={styles.upiSubmitText}>{submitUpiPayment.isPending ? 'Submitting…' : 'Submit'}</Txt>
              </AnimatedPress>
            </View>
          </View>
        )}

        {canCancel && (
          <AnimatedPress accessibilityRole="button" style={styles.cancelOrderBtn} onPress={() => setShowCancelModal(true)}>
            <Ionicons name="close-circle-outline" size={18} color={Colors.danger} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.cancelOrderBtnText}>Cancel Order</Txt>
          </AnimatedPress>
        )}
      </ScrollView>

      <Sheet
        visible={showCancelModal}
        title="Cancel this order?"
        subtitle="This can't be undone. Let us know why."
        onDismiss={() => setShowCancelModal(false)}
        testID="grocery_cancel_order_sheet"
        footer={
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <Btn onPress={() => setShowCancelModal(false)} containerColor={Colors.surfaceMuted} textColor={Colors.textPrimary} borderRadius={Radii.control} style={{ flex: 1 }}>
              <Txt>Keep Order</Txt>
            </Btn>
            <Btn onPress={handleCancel} containerColor={Colors.danger} textColor={Colors.textInverse} borderRadius={Radii.control} style={{ flex: 1 }} loading={cancelOrder.isPending}>
              <Txt>{cancelOrder.isPending ? 'Cancelling…' : 'Cancel Order'}</Txt>
            </Btn>
          </View>
        }
      >
        <OutlinedTextField
          label="Reason for cancelling"
          placeholder="Tell us what changed"
          value={cancelReason}
          onChangeText={(v) => { setCancelReason(v); if (cancelError) setCancelError(undefined); }}
          error={cancelError}
          multiline
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center' },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12 },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary },
  content: {
    padding: 16,
    paddingBottom: 40 },
  statusHeroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Layout.shadowCard },
  statusHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary },
  statusHeroSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 16 },
  deliveredBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 10,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.control },
  deliveredText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 13 },
  tripInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 10,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.control },
  tripTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary },
  tripSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2 },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8 },
  summaryMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 3 },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: 12 },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8 },
  lineName: {
    fontSize: 13,
    color: Colors.textPrimary },
  lineStatusText: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2 },
  linePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6 },
  billLabel: {
    fontSize: 13,
    color: Colors.textSecondary },
  billVal: {
    fontSize: 13,
    color: Colors.textPrimary },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary },
  totalVal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary },
  upiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10 },
  upiSubmitBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: Radii.control,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center' },
  upiSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textInverse },
  btnDisabled: {
    opacity: 0.5 },
  cancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.danger,
    marginTop: 4 },
  cancelOrderBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.danger },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20 },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    padding: 20 },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary },
  modalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4 },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16 },
  modalKeepBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radii.control,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center' },
  modalKeepText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radii.control,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center' },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textInverse } });
