import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Palette } from '@/theme';
import { AnimatedPress, Btn, Row, Spacer, Txt } from '@/components/ui';
import { useLaundryStore, LAUNDRY_SERVICES, LaundryOrder } from '@/features/laundry/store/useLaundryStore';
import { usePGowStore } from '@/store/usePGowStore';

export default function LaundryPaymentScreen() {
  const insets = useSafeAreaInsets();
  
  const guest = usePGowStore((s) => s.loggedInGuest);
  const cart = useLaundryStore((s) => s.cart);
  const clearCart = useLaundryStore((s) => s.clearCart);
  const pickupDetails = useLaundryStore((s) => s.pickupDetails);
  const placeOrder = useLaundryStore((s) => s.placeOrder);

  const [paymentMethod, setPaymentMethod] = useState('UPI');

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = LAUNDRY_SERVICES.find((p) => p.id === id);
    return sum + (product ? product.price * qty : 0);
  }, 0);

  const pickupFee = 30;
  const discount = 20;
  const estimatedTotal = cartTotal + pickupFee - discount;

  const handlePay = () => {
    // Generate order
    const order: LaundryOrder = {
      id: '#LW' + Math.floor(10000 + Math.random() * 90000),
      status: 'BOOKING_CONFIRMED',
      items: cart,
      pickupDate: pickupDetails.date,
      pickupTime: pickupDetails.time,
      pickupLocation: `PGow • Room ${guest?.roomNo || ''}`,
      instructions: pickupDetails.instructions,
      estimatedReturn: 'Tomorrow • 6:00 PM – 8:00 PM',
      estimatedTotal,
      createdAt: new Date().toISOString(),
    };
    placeOrder(order);
    clearCart();
    router.replace('/laundry/confirmation');
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" gap={16} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
          <Txt style={styles.headerTitle}>Payment</Txt>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <Txt style={styles.pageTitle}>Complete your booking</Txt>
        </View>

        {/* BILL SUMMARY */}
        <View style={styles.billCard}>
          <Row justify="space-between" style={styles.billRow}>
            <Txt style={styles.billLabel}>Laundry Services</Txt>
            <Txt style={styles.billValue}>₹{cartTotal}</Txt>
          </Row>
          <Spacer size={12} />
          <Row justify="space-between" style={styles.billRow}>
            <Txt style={styles.billLabel}>Pickup / Service Fee</Txt>
            <Txt style={styles.billValue}>₹{pickupFee}</Txt>
          </Row>
          <Spacer size={12} />
          <Row justify="space-between" style={styles.billRow}>
            <Txt style={styles.billLabel}>Discount</Txt>
            <Txt style={styles.billDiscount}>−₹{discount}</Txt>
          </Row>
          
          <Spacer size={16} />
          <View style={styles.dividerDashed} />
          <Spacer size={16} />
          
          <Row justify="space-between" style={styles.billRow}>
            <Txt style={styles.billTotalLabel}>TOTAL</Txt>
            <Txt style={styles.billTotalValue}>₹{estimatedTotal}</Txt>
          </Row>
        </View>

        <View style={styles.warningCard}>
          <Ionicons name="information-circle" size={20} color="#92400E" />
          <Txt style={styles.warningText}>₹{estimatedTotal} is an estimated amount. The final amount will be confirmed after pickup and weighing.</Txt>
        </View>

        {/* PAYMENT METHODS */}
        <View style={styles.section}>
          <Txt style={styles.sectionTitle}>Payment Methods</Txt>
          
          <View style={styles.methodsContainer}>
            {['UPI', 'Credit / Debit Card', 'PGow Wallet', 'Cash / Pay Later'].map((method, idx) => (
              <View key={method}>
                <AnimatedPress 
                  style={styles.methodRow}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Row align="center" justify="space-between">
                    <Row align="center" gap={12}>
                      <View style={styles.methodIconWrap}>
                        <Ionicons 
                          name={method === 'UPI' ? 'qr-code' : method === 'Credit / Debit Card' ? 'card' : method === 'PGow Wallet' ? 'wallet' : 'cash'} 
                          size={20} 
                          color={Colors.primary} 
                        />
                      </View>
                      <Txt style={styles.methodName}>{method}</Txt>
                    </Row>
                    <View style={[styles.radio, paymentMethod === method && styles.radioActive]}>
                      {paymentMethod === method && <View style={styles.radioInner} />}
                    </View>
                  </Row>
                </AnimatedPress>
                {idx < 3 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* STICKY BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <Btn 
          onPress={handlePay}
          containerColor={Colors.primary}
          textColor={Colors.surface}
          borderRadius={Radii.control}
          height={50}
        >
          <Txt variant="button" color={Colors.textInverse}>Pay ₹{estimatedTotal}</Txt>
        </Btn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: '#F8FAFB' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.primaryDark, lineHeight: 34 },
  
  billCard: { backgroundColor: Colors.surface, marginHorizontal: 20, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 20 },
  billRow: { flexDirection: 'row', alignItems: 'center' },
  billLabel: { fontSize: 15, color: Colors.textSecondary },
  billValue: { fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  billDiscount: { fontSize: 15, color: Colors.primaryDark, fontWeight: '700' },
  dividerDashed: { height: 1, borderWidth: 1, borderColor: Colors.borderSubtle, borderStyle: 'dashed', borderRadius: Radii.badge },
  billTotalLabel: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  billTotalValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  
  warningCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.TintAmber, marginHorizontal: 20, marginTop: 16, padding: 12, borderRadius: Radii.card, borderWidth: 1, borderColor: Palette.TintAmber },
  warningText: { fontSize: 13, color: '#92400E', marginLeft: 10, flex: 1, lineHeight: 18, fontWeight: '500' },
  
  section: { marginTop: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 20, marginBottom: 12 },
  methodsContainer: { backgroundColor: Colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderSubtle },
  methodRow: { padding: 16, paddingHorizontal: 20 },
  methodIconWrap: { width: 40, height: 40, borderRadius: Radii.card, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  methodName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginLeft: 72 },
  
  radio: { width: 22, height: 22, borderRadius: Radii.control, borderWidth: 2, borderColor: Colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioInner: { width: 12, height: 12, borderRadius: Radii.badge, backgroundColor: Colors.primary },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
});
