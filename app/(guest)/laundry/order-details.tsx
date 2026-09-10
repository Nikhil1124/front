import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { AnimatedPress, Btn, Col, Row, Spacer, Txt } from '@/components/ui';
import { useLaundryStore, LAUNDRY_SERVICES } from '@/features/laundry/store/useLaundryStore';

export default function LaundryOrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const completedOrders = useLaundryStore((s) => s.completedOrders);
  
  // For demonstration, just grab the first completed order or active order
  const activeOrder = useLaundryStore((s) => s.activeOrder);
  const orderToDisplay = activeOrder || completedOrders[0];

  if (!orderToDisplay) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 16), paddingHorizontal: 20 }]}>
        <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </AnimatedPress>
        <Spacer size={40} />
        <Txt style={{fontSize: 20, fontWeight: '700'}}>Order not found.</Txt>
      </View>
    );
  }

  const pickupFee = 30;
  const discount = 20;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" gap={16} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
          <Col>
            <Txt style={styles.headerTitle}>Order Receipt</Txt>
            <Txt style={styles.headerSubtitle}>{orderToDisplay.id}</Txt>
          </Col>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* TOP INFO */}
        <View style={styles.infoCard}>
          <Row justify="space-between" style={styles.infoRow}>
            <Txt style={styles.infoLabel}>Booking Date</Txt>
            <Txt style={styles.infoValue}>{new Date(orderToDisplay.createdAt).toLocaleDateString()}</Txt>
          </Row>
          <Spacer size={12} />
          <Row justify="space-between" style={styles.infoRow}>
            <Txt style={styles.infoLabel}>Pickup Date</Txt>
            <Txt style={styles.infoValue}>{orderToDisplay.pickupDate}</Txt>
          </Row>
          <Spacer size={12} />
          <Row justify="space-between" style={styles.infoRow}>
            <Txt style={styles.infoLabel}>Return Date</Txt>
            <Txt style={styles.infoValue}>{orderToDisplay.estimatedReturn}</Txt>
          </Row>
          <Spacer size={12} />
          <Row justify="space-between" style={styles.infoRow}>
            <Txt style={styles.infoLabel}>Pickup Location</Txt>
            <Txt style={styles.infoValue}>{orderToDisplay.pickupLocation}</Txt>
          </Row>
        </View>

        {/* SERVICES */}
        <Txt style={styles.sectionTitle}>Services</Txt>
        <View style={styles.servicesCard}>
          {Object.entries(orderToDisplay.items).map(([id, qty], idx) => {
            const product = LAUNDRY_SERVICES.find((p) => p.id === id);
            if (!product) return null;
            return (
              <View key={id}>
                <Row align="center" justify="space-between" style={styles.serviceRow}>
                  <Col>
                    <Txt style={styles.serviceCat}>{product.category}</Txt>
                    <Txt style={styles.serviceName}>{qty} {product.unit} × {product.name}</Txt>
                  </Col>
                  <Txt style={styles.servicePrice}>₹{product.price * qty}</Txt>
                </Row>
                {idx < Object.keys(orderToDisplay.items).length - 1 && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>

        {/* PRICING */}
        <Txt style={styles.sectionTitle}>Pricing</Txt>
        <View style={styles.pricingCard}>
          <Row justify="space-between" style={styles.pricingRow}>
            <Txt style={styles.pricingLabel}>Estimated amount</Txt>
            <Txt style={styles.pricingValue}>₹{orderToDisplay.estimatedTotal - pickupFee + discount}</Txt>
          </Row>
          <Spacer size={12} />
          <Row justify="space-between" style={styles.pricingRow}>
            <Txt style={styles.pricingLabel}>Pickup Fee</Txt>
            <Txt style={styles.pricingValue}>₹{pickupFee}</Txt>
          </Row>
          <Spacer size={12} />
          <Row justify="space-between" style={styles.pricingRow}>
            <Txt style={styles.pricingLabel}>Discount</Txt>
            <Txt style={styles.pricingDiscount}>−₹{discount}</Txt>
          </Row>
          
          <Spacer size={16} />
          <View style={styles.dividerDashed} />
          <Spacer size={16} />
          
          <Row justify="space-between" style={styles.pricingRow}>
            <Txt style={styles.pricingTotalLabel}>Final amount</Txt>
            <Txt style={styles.pricingTotalValue}>₹{orderToDisplay.finalTotal || orderToDisplay.estimatedTotal}</Txt>
          </Row>
        </View>

        {/* PAYMENT */}
        <View style={styles.paymentCard}>
          <Row justify="space-between" align="center">
            <Col>
              <Txt style={styles.paymentLabel}>Payment</Txt>
              <Row align="center" gap={6} style={{ marginTop: 2 }}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                <Txt style={styles.paymentMethod}>UPI • Paid</Txt>
              </Row>
            </Col>
            <Ionicons name="receipt" size={24} color={Colors.borderSubtle} />
          </Row>
        </View>

      </ScrollView>

      {/* BOTTOM ACTIONS */}
      <View style={styles.bottomBar}>
        <Row gap={12}>
          <Btn 
            onPress={() => {}}
            containerColor={Colors.surface}
            textColor={Colors.textPrimary}
            borderRadius={Radii.control}
            height={44}
            style={{ flex: 1, borderWidth: 1, borderColor: Colors.borderSubtle }}
          >
            <Txt variant="button" color={Colors.textPrimary}>Report Issue</Txt>
          </Btn>
          <Btn 
            onPress={() => router.push('/laundry')}
            containerColor={Colors.primary}
            textColor={Colors.surface}
            borderRadius={Radii.control}
            height={44}
            style={{ flex: 1 }}
          >
            <Txt variant="button" color={Colors.textInverse}>Book Again</Txt>
          </Btn>
        </Row>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  
  infoCard: { backgroundColor: Colors.surface, padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  infoRow: { alignItems: 'center' },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  
  servicesCard: { backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle },
  serviceRow: { padding: 16 },
  serviceCat: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  serviceName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  servicePrice: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: 16 },
  
  pricingCard: { backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16 },
  pricingRow: { alignItems: 'center' },
  pricingLabel: { fontSize: 14, color: Colors.textSecondary },
  pricingValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  pricingDiscount: { fontSize: 14, color: Colors.primaryDark, fontWeight: '700' },
  dividerDashed: { height: 1, borderWidth: 1, borderColor: Colors.borderSubtle, borderStyle: 'dashed', borderRadius: Radii.badge },
  pricingTotalLabel: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  pricingTotalValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  
  paymentCard: { backgroundColor: Colors.surface, marginHorizontal: 20, marginTop: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16 },
  paymentLabel: { fontSize: 12, color: Colors.textSecondary },
  paymentMethod: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
});
