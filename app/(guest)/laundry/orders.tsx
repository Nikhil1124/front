import { useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { AnimatedPress, Btn, Col, ErrorState, LoadingState, Row, Txt } from '@/components/ui';
import { useMyLaundryOrders } from '@/features/laundry/useLaundryBooking';
import type { GuestLaundryRequest } from '@/types';

/**
 * Real orders now. This list used to read `activeOrder` / `completedOrders` out of a Zustand
 * store — one order at a time, in memory, gone on restart, and never the same set the owner
 * or the Hub Services tab could see. It reads the resident's own `kind: "laundry"` requests.
 */
export default function LaundryOrdersScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');

  const { active, completed, isLoading, error, refetch, isRefetching } = useMyLaundryOrders();

  const renderOrderCard = (order: GuestLaundryRequest, isActive: boolean) => {
    const totalItems = order.items.reduce((n, l) => n + l.qty, 0);
    const summary = totalItems > 0
      ? `${totalItems} item${totalItems === 1 ? '' : 's'} • ${order.serviceType || 'Laundry'}`
      : order.weightOrCount || order.serviceType || 'Laundry';

    return (
      <View key={order.id} style={styles.orderCard}>
        <Row align="flex-start" justify="space-between" gap={12}>
          <Col style={{ flex: 1 }}>
            {/* The server's uuid, shortened — an id a resident can read out to the owner and
                the owner can actually find, unlike the invented "#LW10261" this used to show. */}
            <Txt style={styles.orderId} numberOfLines={1}>Laundry #{order.id.slice(0, 8)}</Txt>
            <Txt style={styles.orderDesc} numberOfLines={2}>{summary}</Txt>
          </Col>
          <Txt style={styles.orderAmount}>₹{order.totalCost}</Txt>
        </Row>

        <View style={styles.divider} />

        {isActive ? (
          <Row align="center" justify="space-between" gap={12}>
            <Col style={{ flex: 1 }}>
              <Txt style={styles.statusLabel} numberOfLines={2}>
                Status: <Txt style={{ color: Colors.primary, fontWeight: '700' }}>{order.status}</Txt>
              </Txt>
              {!!order.pickupDate && (
                <Txt style={styles.estReturn} numberOfLines={2}>
                  Pickup: {order.pickupDate}{order.preferredSlot ? ` • ${order.preferredSlot}` : ''}
                </Txt>
              )}
            </Col>
            <Btn
              onPress={() => router.push({ pathname: '/laundry/tracking', params: { id: order.id } })}
              containerColor={Colors.primary}
              textColor={Colors.surface}
              borderRadius={Radii.control}
              height={36}
              style={{ paddingHorizontal: 16 }}
            >
              <Txt style={{ fontSize: 12, fontWeight: '700' }} color={Colors.textInverse}>Track</Txt>
            </Btn>
          </Row>
        ) : (
          <Row align="center" justify="space-between" gap={12}>
            <Txt style={styles.deliveredDate} numberOfLines={1}>
              {order.status} • {new Date(order.timestamp).toLocaleDateString()}
            </Txt>
            <AnimatedPress onPress={() => router.push({ pathname: '/laundry/order-details', params: { id: order.id } })}>
              <Txt style={styles.viewDetailsText}>View Details</Txt>
            </AnimatedPress>
          </Row>
        )}
      </View>
    );
  };

  const shown = tab === 'ACTIVE' ? active : completed;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" gap={16} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
          <Txt style={styles.headerTitle} numberOfLines={2}>Your Laundry Orders</Txt>
        </Row>
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <AnimatedPress onPress={() => setTab('ACTIVE')} style={[styles.tab, tab === 'ACTIVE' && styles.tabActive]}>
          <Txt style={[styles.tabText, tab === 'ACTIVE' && styles.tabTextActive]}>ACTIVE</Txt>
        </AnimatedPress>
        <AnimatedPress onPress={() => setTab('COMPLETED')} style={[styles.tab, tab === 'COMPLETED' && styles.tabActive]}>
          <Txt style={[styles.tabText, tab === 'COMPLETED' && styles.tabTextActive]}>COMPLETED</Txt>
        </AnimatedPress>
      </View>

      {isLoading ? (
        <LoadingState label="Loading your orders…" />
      ) : error ? (
        <ErrorState error={error} title="Could not load your orders" onRetry={refetch} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        >
          {shown.length > 0 ? (
            shown.map((o) => renderOrderCard(o, tab === 'ACTIVE'))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name={tab === 'ACTIVE' ? 'shirt-outline' : 'receipt-outline'} size={48} color={Colors.borderSubtle} />
              <Txt style={styles.emptyText}>
                {tab === 'ACTIVE' ? 'No active laundry orders.' : 'No past orders found.'}
              </Txt>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: '#F8FAFB' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, flex: 1 },

  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  orderCard: { backgroundColor: Colors.surface, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16, marginBottom: 16 },
  orderId: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  orderDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  orderAmount: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },

  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 16 },

  statusLabel: { fontSize: 13, color: Colors.textSecondary },
  estReturn: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },

  deliveredDate: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
  viewDetailsText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, marginTop: 16, fontWeight: '500' },
});
