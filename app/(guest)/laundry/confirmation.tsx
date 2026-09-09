import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { Btn, Col, Row, Spacer, Txt } from '@/components/ui';
import { useLaundryStore, LAUNDRY_SERVICES } from '@/features/laundry/store/useLaundryStore';

export default function LaundryConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const activeOrder = useLaundryStore((s) => s.activeOrder);

  if (!activeOrder) {
    return null;
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
        
        <Spacer size={insets.top + 20} />

        <View style={styles.successCircle}>
          <Ionicons name="checkmark" size={60} color="#FFF" />
        </View>

        <Spacer size={24} />

        <Txt style={styles.title}>Laundry Booking Confirmed</Txt>
        <Txt style={styles.subtitle}>Your order {activeOrder.id} has been successfully placed.</Txt>

        <Spacer size={32} />

        <View style={styles.detailsCard}>
          <Row align="flex-start" gap={12} style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="calendar" size={18} color={Colors.primary} />
            </View>
            <Col>
              <Txt style={styles.detailLabel}>Pickup Schedule</Txt>
              <Txt style={styles.detailValue}>{activeOrder.pickupDate} • {activeOrder.pickupTime}</Txt>
            </Col>
          </Row>

          <View style={styles.divider} />

          <Row align="flex-start" gap={12} style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="location" size={18} color={Colors.primary} />
            </View>
            <Col>
              <Txt style={styles.detailLabel}>Pickup Location</Txt>
              <Txt style={styles.detailValue}>{activeOrder.pickupLocation}</Txt>
            </Col>
          </Row>

          <View style={styles.divider} />

          <Row align="flex-start" gap={12} style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="time" size={18} color={Colors.primary} />
            </View>
            <Col>
              <Txt style={styles.detailLabel}>Estimated Return</Txt>
              <Txt style={styles.detailValue}>{activeOrder.estimatedReturn}</Txt>
            </Col>
          </Row>
        </View>

        <Spacer size={24} />

        <View style={styles.summaryCard}>
          <Txt style={styles.summaryTitle}>Services</Txt>
          <Spacer size={12} />
          {Object.entries(activeOrder.items).map(([id, qty]) => {
            const product = LAUNDRY_SERVICES.find((p) => p.id === id);
            if (!product) return null;
            return (
              <Row key={id} justify="space-between" style={{ marginBottom: 8 }}>
                <Txt style={styles.summaryItem}>{qty} {product.unit} {product.name}</Txt>
              </Row>
            );
          })}
          
          <Spacer size={12} />
          <View style={styles.dividerDashed} />
          <Spacer size={12} />
          
          <Row justify="space-between">
            <Txt style={styles.summaryTotalLabel}>Estimated Total</Txt>
            <Txt style={styles.summaryTotalValue}>₹{activeOrder.estimatedTotal}</Txt>
          </Row>
        </View>

      </ScrollView>

      {/* FIXED BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <Btn 
          onPress={() => router.replace('/laundry/tracking')}
          containerColor={Colors.primary}
          textColor="#FFF"
          borderRadius={Radii.control}
          height={50}
        >
          <Txt variant="button" color="#FFF">Track Laundry</Txt>
        </Btn>
        <Spacer size={12} />
        <Btn 
          onPress={() => router.replace('/laundry/order-details')}
          containerColor="#FFF"
          textColor={Colors.textPrimary}
          borderRadius={Radii.control}
          height={50}
          style={{ borderWidth: 1, borderColor: Colors.borderSubtle }}
        >
          <Txt variant="button" color={Colors.textPrimary}>View Order Details</Txt>
        </Btn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.primaryDark, textAlign: 'center' },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
  
  detailsCard: { backgroundColor: '#FFF', borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle },
  detailRow: { padding: 16 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EBF4EC', alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  detailValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginLeft: 64 },
  
  summaryCard: { backgroundColor: '#FFF', borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  summaryItem: { fontSize: 14, color: Colors.textSecondary },
  dividerDashed: { height: 1, borderWidth: 1, borderColor: Colors.borderSubtle, borderStyle: 'dashed', borderRadius: 1 },
  summaryTotalLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  summaryTotalValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
});
