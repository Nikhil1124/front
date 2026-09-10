import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Palette } from '@/theme';
import { AnimatedPress, Btn, ErrorState, Row, Spacer, Txt } from '@/components/ui';
import {
  useLaundryStore,
  laundryCartTotal,
  LAUNDRY_PAY_MODES,
} from '@/features/laundry/store/useLaundryStore';
import { useSubmitLaundryBooking } from '@/features/laundry/useLaundryBooking';
import { useAuthStore } from '@/store/authStore';

/**
 * ponytail: no gateway. Choosing "UPI" here records how the resident intends to settle up —
 * it does not move money, and the button no longer says "Pay" as though it did. The three
 * options are the ones the property actually operates (room bill, UPI on collection, cash),
 * matching the hub's own laundry sheet. There used to be four generic ones including a
 * "PGow Wallet" that does not exist anywhere in this product.
 */
export default function LaundryPaymentScreen() {
  const insets = useSafeAreaInsets();

  const activePgId = useAuthStore((s) => s.activePgId);
  const cart = useLaundryStore((s) => s.cart);
  const clearCart = useLaundryStore((s) => s.clearCart);
  const pickupDetails = useLaundryStore((s) => s.pickupDetails);
  const setPickupDetails = useLaundryStore((s) => s.setPickupDetails);
  const resetPickupDetails = useLaundryStore((s) => s.resetPickupDetails);

  const booking = useSubmitLaundryBooking(activePgId ?? undefined);

  // No pickup fee and no discount. Both were invented numbers on this screen — a flat ₹30
  // "service fee" and a −₹20 discount that no promotion, coupon or setting anywhere in this
  // product produces. A resident was being shown a bill nobody could explain.
  const total = laundryCartTotal(cart);

  const handleConfirm = async () => {
    if (!activePgId || booking.isPending) return;
    const created = await booking
      .mutateAsync({
        pgId: activePgId,
        cart,
        pickupDate: pickupDetails.date,
        pickupTime: pickupDetails.time,
        instructions: pickupDetails.instructions,
        payMode: pickupDetails.payMode,
      })
      // The mutation already holds the error for the banner below; swallowing it here just
      // stops an unhandled rejection. The cart is deliberately NOT cleared on failure.
      .catch(() => null);

    if (!created) return;
    clearCart();
    resetPickupDetails();
    router.replace({ pathname: '/laundry/confirmation', params: { id: created.id } });
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" gap={16} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
          <Txt style={styles.headerTitle}>Confirm booking</Txt>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>

        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <Txt style={styles.pageTitle}>Complete your booking</Txt>
        </View>

        {/* BILL SUMMARY */}
        <View style={styles.billCard}>
          <Row justify="space-between" style={styles.billRow}>
            <Txt style={styles.billLabel}>Laundry Services</Txt>
            <Txt style={styles.billValue}>₹{total}</Txt>
          </Row>

          <Spacer size={16} />
          <View style={styles.dividerDashed} />
          <Spacer size={16} />

          <Row justify="space-between" style={styles.billRow}>
            <Txt style={styles.billTotalLabel}>TOTAL</Txt>
            <Txt style={styles.billTotalValue}>₹{total}</Txt>
          </Row>
        </View>

        <View style={styles.warningCard}>
          <Ionicons name="information-circle" size={20} color="#92400E" />
          <Txt style={styles.warningText}>₹{total} is an estimated amount. The final amount will be confirmed after pickup and weighing.</Txt>
        </View>

        {/* HOW YOU'LL PAY */}
        <View style={styles.section}>
          <Txt style={styles.sectionTitle}>How you'll pay</Txt>

          <View style={styles.methodsContainer}>
            {LAUNDRY_PAY_MODES.map((method, idx) => (
              <View key={method}>
                <AnimatedPress
                  style={styles.methodRow}
                  onPress={() => setPickupDetails({ payMode: method })}
                >
                  <Row align="center" justify="space-between">
                    <Row align="center" gap={12}>
                      <View style={styles.methodIconWrap}>
                        <Ionicons
                          name={method === 'UPI' ? 'qr-code' : method === 'Cash on Pickup' ? 'cash' : 'receipt'}
                          size={20}
                          color={Colors.primary}
                        />
                      </View>
                      <Txt style={styles.methodName}>{method}</Txt>
                    </Row>
                    <View style={[styles.radio, pickupDetails.payMode === method && styles.radioActive]}>
                      {pickupDetails.payMode === method && <View style={styles.radioInner} />}
                    </View>
                  </Row>
                </AnimatedPress>
                {idx < LAUNDRY_PAY_MODES.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {booking.isError && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <ErrorState
              error={booking.error}
              title="Pickup not booked"
              onRetry={handleConfirm}
              fill={false}
            />
          </View>
        )}

      </ScrollView>

      {/* STICKY BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <Btn
          onPress={handleConfirm}
          disabled={booking.isPending || total === 0}
          containerColor={Colors.primary}
          textColor={Colors.surface}
          borderRadius={Radii.control}
          height={50}
        >
          <Txt variant="button" color={Colors.textInverse}>
            {booking.isPending ? 'Booking…' : `Confirm pickup • ₹${total}`}
          </Txt>
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
