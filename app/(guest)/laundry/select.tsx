import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Palette } from '@/theme';
import { AnimatedPress, Btn, Col, Row, Txt } from '@/components/ui';
import { useLaundryStore, LAUNDRY_SERVICES } from '@/features/laundry/store/useLaundryStore';
import { LaundryCard } from '@/features/laundry/components/LaundryCard';

export default function LaundrySelectScreen() {
  const insets = useSafeAreaInsets();
  
  const cart = useLaundryStore((s) => s.cart);
  const updateCart = useLaundryStore((s) => s.updateCart);

  // Group services by category
  const categories = ['Wash & Fold', 'Wash & Iron', 'Dry Cleaning', 'Shoes & Bags', 'Home Linen'];

  const cartItemCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = LAUNDRY_SERVICES.find((p) => p.id === id);
    return sum + (product ? product.price * qty : 0);
  }, 0);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" gap={16} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
          <Txt style={styles.headerTitle}>Select Laundry Services</Txt>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
          <Txt style={styles.pageTitle}>What would you like us to clean?</Txt>
        </View>

        {categories.map(cat => {
          const items = LAUNDRY_SERVICES.filter(s => s.category === cat);
          if (items.length === 0) return null;
          
          return (
            <View key={cat} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Txt style={styles.categoryTitle}>{cat.toUpperCase()}</Txt>
              </View>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 12 }}>
                {items.map((item) => {
                  const qty = cart[item.id] || 0;
                  return (
                    <LaundryCard 
                      key={item.id} 
                      item={item} 
                      qty={qty} 
                      onUpdateQty={(delta) => updateCart(item.id, delta)} 
                    />
                  );
                })}
              </ScrollView>
            </View>
          );
        })}

      </ScrollView>

      {/* STICKY BOTTOM BAR */}
      {cartItemCount > 0 && (
        <View style={styles.bottomBar}>
          <Row align="center" justify="space-between">
            <Col>
              <Txt style={styles.cartItemsCount}>{cartItemCount} item{cartItemCount > 1 ? 's' : ''} selected</Txt>
              <Txt style={styles.cartTotalHint}>Estimated ₹{cartTotal}</Txt>
            </Col>
            <Btn 
              onPress={() => router.push('/laundry/summary')}
              containerColor={Colors.primary}
              textColor={Colors.surface}
              borderRadius={Radii.control}
              height={44}
              style={{ paddingHorizontal: 24 }}
            >
              <Txt variant="button" color={Colors.textInverse}>Continue</Txt>
            </Btn>
          </Row>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },
  header: { backgroundColor: '#F8FAFB' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.primaryDark, lineHeight: 34 },
  
  categoryBlock: { marginBottom: 24, backgroundColor: Colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderSubtle },
  categoryHeader: { backgroundColor: '#F1F5F9', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  categoryTitle: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1 },
  
  itemRow: { paddingHorizontal: 20, paddingVertical: 16 },
  itemName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  itemPrice: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },
  
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginLeft: 20 },
  
  addButton: { borderWidth: 1, borderColor: Colors.primaryDark, borderRadius: Radii.control, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, width: 90 },
  addButtonText: { color: Colors.primaryDark, fontSize: 14, fontWeight: '700' },
  
  qtyContainer: { borderWidth: 1, borderColor: Colors.primaryDark, borderRadius: Radii.control, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: Palette.TintGreen, width: 100 },
  qtyBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: Colors.primaryDark, fontSize: 15, fontWeight: '800' },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
  cartItemsCount: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  cartTotalHint: { fontSize: 14, color: Colors.primaryDark, marginTop: 2, fontWeight: '700' },
});
