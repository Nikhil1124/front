import { SupplyItem, SupplyOrderSummary } from '@/types';
import React from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useSupplyOrdersQuery } from '../useSupplyOrders';
import { useCartStore } from '../store/useCartStore';
import { useSupplyItems } from '../useSupply';
import { useAuthStore } from '@/store/authStore';
import { Colors, Layout, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

export function GroceryOrdersScreen() {
  const logout = usePGowStore((s) => s.logout);
  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const { data: ordersData, isLoading, refetch } = useSupplyOrdersQuery(activePgId);
  const orders = ordersData?.items || [];

  const activeOrder = orders.find((o) => o.status !== 'delivered' && o.status !== 'cancelled');

  const openOrder = (orderId: string) => {
    router.push({ pathname: '/groceries/orders/[id]', params: { id: orderId } });
  };

  const renderOrder = ({ item }: { item: SupplyOrderSummary }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => openOrder(item.id)}
      activeOpacity={0.9}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Order #{item.order_no || item.id.slice(0, 8)}</Text>
        <View style={[styles.statusBadge, item.status !== 'delivered' && styles.activeStatusBadge]}>
          <Text style={[styles.statusText, item.status !== 'delivered' && styles.activeStatusText]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.orderDate}>
        {new Date(item.created_at).toLocaleDateString()} · {item.item_count} items
      </Text>

      <View style={styles.divider} />

      <View style={styles.orderFooter}>
        <Text style={styles.orderTotal}>₹{Number(item.total_amount).toFixed(2)}</Text>
        <TouchableOpacity style={styles.reorderBtn} onPress={() => openOrder(item.id)}>
          <Ionicons name="eye-outline" size={15} color={Colors.primary} />
          <Text style={styles.reorderText}>View Status</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Orders</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
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
                        Order #{activeOrder.order_no || activeOrder.id.slice(0, 8)} is {activeOrder.status.toUpperCase()}
                      </Text>
                      <Text style={styles.activeBannerSub}>
                        Tap to track live updates
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
                </TouchableOpacity>
              )}

              <Text style={styles.sectionTitle}>Order History</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    ...Layout.shadowCard,
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
    backgroundColor: Colors.primary,
  },
  activeBannerTitle: {
    fontSize: 14,
    color: Colors.primary,
  },
  activeBannerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    color: Colors.textPrimary,
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
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Layout.shadowCard,
  },
  buyAgainImg: {
    width: 50,
    height: 50,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceMuted,
    marginBottom: 6,
  },
  buyAgainName: {
    fontSize: 12,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  buyAgainPrice: {
    fontSize: 12,
    color: Colors.textPrimary,
    marginVertical: 4,
  },
  addAgainBtn: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addAgainText: {
    color: Colors.primary,
    fontSize: 11,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Layout.shadowCard,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderId: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  statusBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeStatusBadge: {
    backgroundColor: Colors.surfaceElevated,
  },
  statusText: {
    fontSize: 11,
    color: Colors.primary,
  },
  activeStatusText: {
    color: Colors.primary,
  },
  orderDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: 10,
  },
  orderItems: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  reorderText: {
    color: Colors.primary,
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
    color: Colors.textMuted,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
});
