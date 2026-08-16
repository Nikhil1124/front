import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../store/useCartStore';
import { useGroceryUiStore } from '../store/useGroceryUiStore';
import { OrderStepper } from '../components/grocery/OrderStepper';
import { orderEngine, DetailedOrder, OrderItemUpdate } from '../services/orderEngine';
import { mockProducts } from '../data/mockProducts';
import { AppColors, AppFonts, AppRadius, AppShadow } from '../theme/AppColors';
import { usePGowStore } from '@/store/usePGowStore';

const STATUS_HERO: Record<string, string> = {
  received: 'Order Received',
  shopping: 'Shopping Your Order',
  checkout: 'At Checkout',
  'on-the-way': 'Out for Delivery',
  delivered: 'Delivered',
};

const KIND_LABEL: Record<string, string> = {
  found: 'Found',
  replaced: 'Replaced',
  refunded: 'Refunded',
};

const KIND_BADGE: Record<string, { bg: string; text: string }> = {
  found: { bg: AppColors.primaryLight, text: AppColors.primary },
  replaced: { bg: '#FFF3E0', text: '#E65100' },
  refunded: { bg: AppColors.errorLight, text: AppColors.error },
};

export function GroceryOrderDetailScreen() {
  const id = useGroceryUiStore((s) => s.selectedOrderId);
  const popScreen = usePGowStore((s) => s.popScreen);
  const pushScreen = usePGowStore((s) => s.pushScreen);
  const addItem = useCartStore((state) => state.addItem);

  const [order, setOrder] = useState<DetailedOrder | undefined>(() =>
    orderEngine.getOrder(id as string)
  );

  // Subscribe to live order status updates
  useEffect(() => {
    const unsub = orderEngine.subscribe(() => {
      const fresh = orderEngine.getOrder(id as string);
      if (fresh) setOrder(fresh);
    });
    return unsub;
  }, [id]);

  // Live timer tick for elapsed and remaining duration
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (order && order.status !== 'delivered') {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [order?.status]);

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => popScreen()}>
            <Ionicons name="arrow-back" size={24} color={AppColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyBox}>
          <Ionicons name="receipt-outline" size={64} color={AppColors.textMuted} />
          <Text style={styles.emptyText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isDelivered = order.status === 'delivered';
  const elapsedMs = (isDelivered && order.statusTimestamps.delivered ? order.statusTimestamps.delivered : now) - order.placedAt;
  const etaMs = order.etaMinutes * 60 * 1000;
  const remainingMs = Math.max(0, etaMs - (now - order.placedAt));

  const formatTime = (ms: number) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  const handleBuyItAgain = () => {
    order.items.forEach((item) => {
      const product = mockProducts.find(p => p.id === item.productId);
      if (product) {
        addItem(product, { unit: item.unit, price: item.price, originalPrice: item.originalPrice }, item.quantity);
      }
    });
    pushScreen('GROCERY_CART');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => popScreen()}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.id.slice(-6)}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={styles.statusHeroCard}>
          <Text style={styles.statusHeroTitle}>{STATUS_HERO[order.status] || 'Processing'}</Text>
          <Text style={styles.statusHeroSub}>
            {isDelivered
              ? `Delivered at ${new Date(order.statusTimestamps.delivered || now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : `Arriving in approx ${Math.ceil(remainingMs / 60000)} mins`}
          </Text>

          <OrderStepper status={order.status} />

          {!isDelivered ? (
            <View style={styles.timerRow}>
              <View style={styles.timerBox}>
                <Ionicons name="time-outline" size={16} color={AppColors.primary} />
                <Text style={styles.timerLabel}>Elapsed: </Text>
                <Text style={styles.timerValue}>{formatTime(elapsedMs)}</Text>
              </View>
              <View style={styles.timerBox}>
                <Ionicons name="hourglass-outline" size={16} color={AppColors.primary} />
                <Text style={styles.timerLabel}>ETA: </Text>
                <Text style={styles.timerValue}>{formatTime(remainingMs)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.deliveredBadgeRow}>
              <Ionicons name="checkmark-circle" size={18} color={AppColors.primary} />
              <Text style={styles.deliveredText}>Order Completed Successfully 🎉</Text>
            </View>
          )}
        </View>

        {/* Live Item Updates from Shopper */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Shopper Item Updates</Text>
          {order.itemUpdates.length === 0 ? (
            <Text style={styles.noUpdatesText}>Your shopper will log item picks & substitutions here.</Text>
          ) : (
            <View style={styles.updatesList}>
              {order.itemUpdates.map((upd: OrderItemUpdate) => {
                const badge = KIND_BADGE[upd.kind];
                return (
                  <View key={upd.productId} style={styles.updateRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.updateProductName}>{upd.productName}</Text>
                      {upd.note ? <Text style={styles.updateNote}>{upd.note}</Text> : null}
                    </View>
                    <View style={[styles.kindBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.kindBadgeText, { color: badge.text }]}>
                        {KIND_LABEL[upd.kind]}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Order Details & Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <Text style={styles.summaryMeta}>Placed on {new Date(order.placedAt).toLocaleString()}</Text>
          <Text style={styles.summaryMeta}>Slot: {order.slotLabel}</Text>
          <Text style={styles.summaryMeta}>Deliver to: {order.addressLabel}</Text>
          <Text style={styles.summaryMeta}>Payment: {order.paymentMethod}</Text>

          <View style={styles.divider} />

          {order.items.map((item) => (
            <View key={item.id} style={styles.lineItem}>
              <Text style={styles.lineName}>
                {item.name} ({item.unit}) x {item.quantity}
              </Text>
              <Text style={styles.linePrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Subtotal</Text>
            <Text style={styles.billVal}>₹{order.subtotal}</Text>
          </View>
          {order.cgst !== undefined && (
            <>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>CGST (2.5%)</Text>
                <Text style={styles.billVal}>₹{order.cgst}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>SGST (2.5%)</Text>
                <Text style={styles.billVal}>₹{order.sgst}</Text>
              </View>
            </>
          )}
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={styles.billVal}>{order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform Fee</Text>
            <Text style={styles.billVal}>₹{order.serviceFee}</Text>
          </View>
          {order.tip > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Tip</Text>
              <Text style={styles.billVal}>₹{order.tip}</Text>
            </View>
          )}
          <View style={[styles.billRow, { marginTop: 6 }]}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalVal}>₹{order.total}</Text>
          </View>
        </View>

        {/* Buy Again Button */}
        <TouchableOpacity style={styles.buyAgainBtn} onPress={handleBuyItAgain} activeOpacity={0.85}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.buyAgainText}>Reorder All Items</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
    backgroundColor: AppColors.surface,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: AppFonts.semiBold,
    color: AppColors.textSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  statusHeroCard: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...AppShadow.card,
  },
  statusHeroTitle: {
    fontSize: 20,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  statusHeroSub: {
    fontSize: 13,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.medium,
    marginTop: 2,
    marginBottom: 16,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: AppColors.divider,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerLabel: {
    fontSize: 12,
    fontFamily: AppFonts.medium,
    color: AppColors.textSecondary,
  },
  timerValue: {
    fontSize: 13,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  deliveredBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: AppColors.divider,
  },
  deliveredText: {
    fontSize: 14,
    fontFamily: AppFonts.bold,
    color: AppColors.primary,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...AppShadow.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
    marginBottom: 12,
  },
  noUpdatesText: {
    fontSize: 13,
    color: AppColors.textMuted,
    fontStyle: 'italic',
    fontFamily: AppFonts.regular,
  },
  updatesList: {
    gap: 8,
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceAlt,
    padding: 10,
    borderRadius: AppRadius.md,
    gap: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  updateProductName: {
    fontSize: 13,
    fontFamily: AppFonts.bold,
    color: AppColors.textPrimary,
  },
  updateNote: {
    fontSize: 11,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.medium,
    marginTop: 1,
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kindBadgeText: {
    fontSize: 11,
    fontFamily: AppFonts.extraBold,
  },
  summaryMeta: {
    fontSize: 12,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.medium,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.divider,
    marginVertical: 10,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  lineName: {
    flex: 1,
    fontSize: 13,
    fontFamily: AppFonts.semiBold,
    color: AppColors.textPrimary,
  },
  linePrice: {
    fontSize: 13,
    fontFamily: AppFonts.bold,
    color: AppColors.textPrimary,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  billLabel: {
    fontSize: 13,
    fontFamily: AppFonts.medium,
    color: AppColors.textSecondary,
  },
  billVal: {
    fontSize: 13,
    fontFamily: AppFonts.semiBold,
    color: AppColors.textPrimary,
  },
  totalLabel: {
    fontSize: 15,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  totalVal: {
    fontSize: 16,
    fontFamily: AppFonts.extraBold,
    color: AppColors.primary,
  },
  buyAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    borderRadius: AppRadius.pill,
    gap: 8,
    marginTop: 8,
  },
  buyAgainText: {
    color: '#fff',
    fontFamily: AppFonts.extraBold,
    fontSize: 15,
  },
});
