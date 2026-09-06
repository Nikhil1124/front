import { SupplyOrderSummary } from '@/types';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';

import { AnimatedPress } from '@/components/ui';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState, ListRow, toneFor } from '@/components/ui';
import { useSupplyOrdersQuery } from '../useSupplyOrders';
import { useAuthStore } from '@/store/authStore';
import { Radii, Colors, Layout } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { formatINR } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';

export function GroceryOrdersScreen() {
  const insets = useSafeAreaInsets();
  const logout = usePGowStore((s) => s.logout);
  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const { data: ordersData, isLoading, error, refetch } = useSupplyOrdersQuery(activePgId);
  const orders = ordersData?.items || [];

  const activeOrder = orders.find((o) => o.status !== 'delivered' && o.status !== 'cancelled');

  const openOrder = (orderId: string) => {
    router.push({ pathname: '/groceries/orders/[id]', params: { id: orderId } });
  };

  // The card carried a "View Status" button that opened exactly what tapping the card
  // already opened — a second target inside the first, for the same destination.
  const renderOrder = ({ item, index }: { item: SupplyOrderSummary; index: number }) => (
    <ListRow
      title={`Order #${item.order_no || item.id.slice(0, 8)}`}
      meta={`${new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${item.item_count} item${item.item_count === 1 ? '' : 's'}`}
      leading={<Ionicons name="bag-handle-outline" size={17} color={Colors.primary} />}
      amount={formatINR(Number(item.total_amount), 2)}
      status={{ label: item.status, tone: toneFor(item.status) }}
      onPress={() => openOrder(item.id)}
      first={index === 0}
      last={index === orders.length - 1}
      testID={`order_${item.id}`}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header — had no safe-area handling at all (fixed paddingVertical:12 only), unlike
          every other grocery screen's header (insets.top + 14). This is a dock tab root, not
          pushed under anything, so it sat directly under the notch. */}
      <AppHeader
        title="Your Orders"
        onBack={() => router.back()}
        actions={
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Log out" accessibilityRole="button" onPress={logout}>
            <Ionicons name="log-out-outline" size={22} color={Colors.danger} />
          </AnimatedPress>
        }
      />

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        /* Without this the list just renders empty on a failed fetch, which reads as "you
           have never ordered anything" to someone waiting on a delivery. */
        <ErrorState
          error={error}
          title="Could not load your orders"
          onRetry={refetch}
          fill={false}
        />
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
                <AnimatedPress accessibilityRole="button"
                  style={styles.activeBanner}
                  onPress={() => openOrder(activeOrder.id)}

                >
                  <View style={styles.activeBannerLeft}>
                    <View style={styles.pulseDot} />
                    <View style={{ flex: 1 }}>
                      <Text maxFontSizeMultiplier={1.3} style={styles.activeBannerTitle}>
                        Order #{activeOrder.order_no || activeOrder.id.slice(0, 8)} is {activeOrder.status.toUpperCase()}
                      </Text>
                      <Text maxFontSizeMultiplier={1.3} style={styles.activeBannerSub}>
                        Tap to track live updates
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                </AnimatedPress>
              )}

              <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Order History</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
              <Text maxFontSizeMultiplier={1.3} style={styles.emptyText}>No orders yet</Text>
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
    backgroundColor: Colors.canvas },
  listContainer: {
    padding: 16,
    paddingBottom: 110 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radii.card,
    padding: 14,
    marginBottom: 16,
    ...Layout.shadowCard },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1 },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: Radii.pill,
    backgroundColor: Colors.primary },
  activeBannerTitle: {
    fontSize: 14,
    color: Colors.primary },
  activeBannerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2 },
  sectionTitle: {
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 12 },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12 },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60 } });
