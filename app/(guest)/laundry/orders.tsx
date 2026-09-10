import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { AnimatedPress, Btn, Col, Row, Txt } from '@/components/ui';
import { useLaundryStore, LaundryOrder, LAUNDRY_SERVICES } from '@/features/laundry/store/useLaundryStore';

export default function LaundryOrdersScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  
  const activeOrder = useLaundryStore((s) => s.activeOrder);
  const completedOrders = useLaundryStore((s) => s.completedOrders);

  const renderOrderCard = (order: LaundryOrder, isActive: boolean) => {
    const totalItems = Object.values(order.items).reduce((a, b) => a + b, 0);
    
    // Find first item category for display purposes
    const firstItemId = Object.keys(order.items)[0];
    const category = firstItemId ? LAUNDRY_SERVICES.find(s => s.id === firstItemId)?.category : 'Laundry';

    return (
      <View key={order.id} style={styles.orderCard}>
        <Row align="center" justify="space-between">
          <Col>
            <Txt style={styles.orderId}>Laundry {order.id}</Txt>
            <Txt style={styles.orderDesc}>{totalItems} items • {category}</Txt>
          </Col>
          <Txt style={styles.orderAmount}>₹{order.finalTotal || order.estimatedTotal}</Txt>
        </Row>
        
        <View style={styles.divider} />
        
        {isActive ? (
          <Row align="center" justify="space-between">
            <Col>
              <Txt style={styles.statusLabel}>Status: <Txt style={{color: Colors.primary, fontWeight: '700'}}>{order.status.replace(/_/g, ' ')}</Txt></Txt>
              <Txt style={styles.estReturn}>Est. return: {order.estimatedReturn}</Txt>
            </Col>
            <Btn 
              onPress={() => router.push('/laundry/tracking')}
              containerColor={Colors.primary}
              textColor={Colors.surface}
              borderRadius={Radii.control}
              height={36}
              style={{ paddingHorizontal: 16 }}
            >
              <Txt style={{fontSize: 12, fontWeight: '700'}} color={Colors.textInverse}>Track</Txt>
            </Btn>
          </Row>
        ) : (
          <Row align="center" justify="space-between">
            <Txt style={styles.deliveredDate}>Delivered: {order.pickupDate}</Txt>
            <AnimatedPress onPress={() => router.push('/laundry/order-details')}>
              <Txt style={styles.viewDetailsText}>View Details</Txt>
            </AnimatedPress>
          </Row>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" gap={16} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
          <Txt style={styles.headerTitle}>Your Laundry Orders</Txt>
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

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        
        {tab === 'ACTIVE' && (
          activeOrder ? renderOrderCard(activeOrder, true) : (
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={48} color={Colors.borderSubtle} />
              <Txt style={styles.emptyText}>No active laundry orders.</Txt>
            </View>
          )
        )}

        {tab === 'COMPLETED' && (
          completedOrders.length > 0 ? completedOrders.map(o => renderOrderCard(o, false)) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={Colors.borderSubtle} />
              <Txt style={styles.emptyText}>No past orders found.</Txt>
            </View>
          )
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: '#F8FAFB' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  
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
  
  deliveredDate: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  viewDetailsText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, marginTop: 16, fontWeight: '500' },
});
