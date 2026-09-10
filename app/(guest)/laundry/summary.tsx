import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Palette } from '@/theme';
import { AnimatedPress, Btn, Col, Row, Spacer, Txt } from '@/components/ui';
import { useLaundryStore, LAUNDRY_SERVICES } from '@/features/laundry/store/useLaundryStore';

export default function LaundrySummaryScreen() {
  const insets = useSafeAreaInsets();
  
  const cart = useLaundryStore((s) => s.cart);
  const updateCart = useLaundryStore((s) => s.updateCart);

  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const product = LAUNDRY_SERVICES.find((p) => p.id === id);
    return { id, qty, product };
  }).filter(item => item.product !== undefined) as { id: string, qty: number, product: typeof LAUNDRY_SERVICES[0] }[];

  const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
  // Was `subtotal + 30 - 20` — a flat "pickup / service fee" and a discount that no
  // promotion, coupon or setting in this product produces, both invented on this screen and
  // shown to the resident as part of their bill. The order is charged at what the lines add
  // up to, which is what the booking actually stores.
  const estimatedTotal = subtotal;

  if (cartItems.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 16), paddingHorizontal: 20 }]}>
        <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </AnimatedPress>
        <Spacer size={40} />
        <Txt style={styles.pageTitle}>Your basket is empty</Txt>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" gap={16} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
          <Txt style={styles.headerTitle}>Order Summary</Txt>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <Txt style={styles.pageTitle}>Review your laundry</Txt>
        </View>

        <View style={styles.itemsCard}>
          {cartItems.map((item, idx) => (
            <View key={item.id}>
              <Row align="flex-start" justify="space-between" style={styles.itemRow}>
                <Col style={{ flex: 1, paddingRight: 12 }}>
                  <Txt style={styles.itemCategory}>{item.product.category}</Txt>
                  <Txt style={styles.itemName}>{item.product.name}</Txt>
                  <Row align="center" gap={12} style={{ marginTop: 8 }}>
                    <Txt style={styles.itemQty}>{item.qty} {item.product.unit} × ₹{item.product.price}</Txt>
                    <AnimatedPress onPress={() => updateCart(item.id, -item.qty)}>
                      <Txt style={styles.removeItem}>Remove</Txt>
                    </AnimatedPress>
                  </Row>
                </Col>
                <Txt style={styles.itemTotal}>₹{item.product.price * item.qty}</Txt>
              </Row>
              {idx < cartItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          
          <AnimatedPress onPress={() => router.back()} style={styles.addMoreBtn}>
            <Ionicons name="add" size={16} color={Colors.primary} />
            <Txt style={styles.addMoreText}>Add more items</Txt>
          </AnimatedPress>
        </View>

        <View style={styles.billCard}>
          <Txt style={styles.billTitle}>Bill Details</Txt>
          <Spacer size={16} />
          <Row justify="space-between" style={styles.billRow}>
            <Txt style={styles.billLabel}>Subtotal</Txt>
            <Txt style={styles.billValue}>₹{subtotal}</Txt>
          </Row>

          <Spacer size={16} />
          <View style={styles.dividerDashed} />
          <Spacer size={16} />
          
          <Row justify="space-between" style={styles.billRow}>
            <Txt style={styles.billTotalLabel}>Estimated Total</Txt>
            <Txt style={styles.billTotalValue}>₹{estimatedTotal}</Txt>
          </Row>
        </View>

        <View style={styles.warningCard}>
          <Ionicons name="information-circle" size={20} color="#92400E" />
          <Txt style={styles.warningText}>Final amount may change after actual clothes are weighed or items are inspected.</Txt>
        </View>

      </ScrollView>

      {/* STICKY BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <Row align="center" justify="space-between">
          <Col>
            <Txt style={styles.cartTotalHint}>Estimated Total</Txt>
            <Txt style={styles.cartItemsCount}>₹{estimatedTotal}</Txt>
          </Col>
          <Btn 
            onPress={() => router.push('/laundry/pickup')}
            containerColor={Colors.primary}
            textColor={Colors.surface}
            borderRadius={Radii.control}
            height={44}
            style={{ paddingHorizontal: 24 }}
          >
            <Txt variant="button" color={Colors.textInverse}>Schedule Pickup</Txt>
          </Btn>
        </Row>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: '#F8FAFB' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.primaryDark, lineHeight: 34 },
  
  itemsCard: { backgroundColor: Colors.surface, marginHorizontal: 16, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, overflow: 'hidden' },
  itemRow: { padding: 16 },
  itemCategory: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  itemName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  itemQty: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  removeItem: { fontSize: 13, color: Colors.danger, fontWeight: '600' },
  itemTotal: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: 16 },
  addMoreBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, backgroundColor: '#F1F5F9' },
  addMoreText: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginLeft: 6 },
  
  billCard: { backgroundColor: Colors.surface, marginHorizontal: 16, marginTop: 16, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16 },
  billTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  billRow: { flexDirection: 'row', alignItems: 'center' },
  billLabel: { fontSize: 14, color: Colors.textSecondary },
  billValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  dividerDashed: { height: 1, borderWidth: 1, borderColor: Colors.borderSubtle, borderStyle: 'dashed', borderRadius: Radii.badge },
  billTotalLabel: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  billTotalValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  
  warningCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.TintAmber, marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: Radii.card, borderWidth: 1, borderColor: Palette.TintAmber },
  warningText: { fontSize: 12, color: '#92400E', marginLeft: 10, flex: 1, lineHeight: 18 },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
  cartItemsCount: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  cartTotalHint: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
});
