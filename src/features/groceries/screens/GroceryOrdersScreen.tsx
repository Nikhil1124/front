import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Platform, Image, ScrollView, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mockProducts } from '../data/mockProducts';
import { useOrderStore, DetailedOrder } from '../store/useOrderStore';
import { useCartStore } from '../store/useCartStore';
import { useGroceryUiStore } from '../store/useGroceryUiStore';
import { AppColors, AppFonts, AppRadius, AppShadow } from '../theme/AppColors';
import { usePGowStore } from '@/store/usePGowStore';

export function GroceryOrdersScreen() {
  const orders = useOrderStore((state) => state.orders);
  const logout = usePGowStore((s) => s.logout);
  const addItem = useCartStore((state) => state.addItem);
  const pushScreen = usePGowStore((s) => s.pushScreen);
  const popScreen = usePGowStore((s) => s.popScreen);
  const setSelectedOrderId = useGroceryUiStore((s) => s.setSelectedOrderId);

  // Android hardware back — the header had a title and a logout button but no way to leave the
  // screen and return to wherever opened it (the groceries home's profile tile, or a checkout).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      popScreen();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeOrder = orders.find((o) => o.status !== 'delivered');

  // Extract unique items from past orders for "Buy It Again"
  const buyItAgainItems = Array.from(
    new Map(orders.flatMap((o) => o.items.map((i) => [i.id, i]))).values()
  );

  const handleReorder = (order: DetailedOrder) => {
    order.items.forEach((item) => {
      const product = mockProducts.find(p => p.id === item.productId);
      if (product) {
        addItem(product, { unit: item.unit, price: item.price, originalPrice: item.originalPrice }, item.quantity);
      }
    });
    pushScreen('GROCERY_CART');
  };

  const openOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    pushScreen('GROCERY_ORDER_DETAIL');
  };

  const renderOrder = ({ item }: { item: DetailedOrder }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => openOrder(item.id)}
      activeOpacity={0.9}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Order #{item.id}</Text>
        <View style={[styles.statusBadge, item.status !== 'delivered' && styles.activeStatusBadge]}>
          <Text style={[styles.statusText, item.status !== 'delivered' && styles.activeStatusText]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.orderDate}>
        {new Date(item.placedAt).toLocaleDateString()} · {item.slotLabel}
      </Text>

      <View style={styles.divider} />

      <Text style={styles.orderItems} numberOfLines={2}>
        {item.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
      </Text>

      <View style={styles.divider} />

      <View style={styles.orderFooter}>
        <Text style={styles.orderTotal}>₹{item.total}</Text>
        <TouchableOpacity style={styles.reorderBtn} onPress={() => handleReorder(item)}>
          <Ionicons name="refresh" size={15} color={AppColors.primary} />
          <Text style={styles.reorderText}>Reorder</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => popScreen()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={AppColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Orders</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color={AppColors.error} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Active Order Banner */}
            {activeOrder && (
              <TouchableOpacity
                style={styles.activeBanner}
                onPress={() => openOrder(activeOrder.id)}
                activeOpacity={0.9}
              >
                <View style={styles.activeBannerLeft}>
                  <View style={styles.pulseDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeBannerTitle}>
                      Order #{activeOrder.id} is {activeOrder.status.toUpperCase()}
                    </Text>
                    <Text style={styles.activeBannerSub}>
                      Est. delivery in ~{activeOrder.etaMinutes} mins · Tap to track live
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={AppColors.primary} />
              </TouchableOpacity>
            )}

            {/* Buy It Again Carousel */}
            {buyItAgainItems.length > 0 && (
              <View style={styles.buyAgainSection}>
                <Text style={styles.sectionTitle}>Buy It Again</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buyAgainList}>
                  {buyItAgainItems.map((item) => (
                    <View key={item.id} style={styles.buyAgainCard}>
                      <Image
                        source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                        style={styles.buyAgainImg}
                      />
                      <Text style={styles.buyAgainName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.buyAgainPrice}>₹{item.price}</Text>
                      <TouchableOpacity
                        style={styles.addAgainBtn}
                        onPress={() => {
                          const product = mockProducts.find(p => p.id === item.productId);
                          if (product) {
                            addItem(product, { unit: item.unit, price: item.price, originalPrice: item.originalPrice }, 1);
                          }
                        }}
                      >
                        <Text style={styles.addAgainText}>+ Add</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.sectionTitle}>Order History</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={48} color={AppColors.textMuted} />
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        }
      />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.primaryLight,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
    borderRadius: AppRadius.lg,
    padding: 14,
    marginBottom: 16,
    ...AppShadow.card,
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppColors.primary,
  },
  activeBannerTitle: {
    fontSize: 14,
    fontFamily: AppFonts.extraBold,
    color: AppColors.primary,
  },
  activeBannerSub: {
    fontSize: 12,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.medium,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
    marginBottom: 12,
  },
  buyAgainSection: {
    marginBottom: 16,
  },
  buyAgainList: {
    gap: 10,
  },
  buyAgainCard: {
    width: 120,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.md,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    ...AppShadow.card,
  },
  buyAgainImg: {
    width: 50,
    height: 50,
    borderRadius: AppRadius.sm,
    backgroundColor: AppColors.surfaceAlt,
    marginBottom: 6,
  },
  buyAgainName: {
    fontSize: 12,
    fontFamily: AppFonts.bold,
    color: AppColors.textPrimary,
    textAlign: 'center',
  },
  buyAgainPrice: {
    fontSize: 12,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
    marginVertical: 4,
  },
  addAgainBtn: {
    backgroundColor: AppColors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  addAgainText: {
    color: AppColors.primary,
    fontFamily: AppFonts.extraBold,
    fontSize: 11,
  },
  orderCard: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...AppShadow.card,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderId: {
    fontSize: 15,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  statusBadge: {
    backgroundColor: AppColors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeStatusBadge: {
    backgroundColor: AppColors.primaryLight,
  },
  statusText: {
    fontSize: 11,
    fontFamily: AppFonts.extraBold,
    color: AppColors.primary,
  },
  activeStatusText: {
    color: AppColors.primary,
  },
  orderDate: {
    fontSize: 12,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.medium,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.divider,
    marginVertical: 10,
  },
  orderItems: {
    fontSize: 13,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.medium,
    lineHeight: 18,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 16,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  reorderText: {
    color: AppColors.primary,
    fontFamily: AppFonts.bold,
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: AppFonts.medium,
    color: AppColors.textMuted,
  },
});
