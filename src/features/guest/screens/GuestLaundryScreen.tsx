import { useState } from 'react';
import { View, ScrollView, StyleSheet, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Palette } from '@/theme';
import { AnimatedPress, Btn, Col, Row, Spacer, Txt } from '@/components/ui';

const BRAND_BLUE = Colors.primary;
const BRAND_LIGHT_BLUE = '#E6EFEA'; // matching the app's light green tint
const BRAND_GREEN = Colors.primaryDark;
const BRAND_LIGHT_GREEN = '#DCE9EA'; 
const BG_WHITE = Colors.surface;

const LAUNDRY_CATEGORIES = ['Wash & Fold', 'Wash & Iron', 'Dry Cleaning', 'Premium Care', 'Shoes & Bags', 'Home Linen'];

const PRODUCTS = [
  // Wash & Fold
  { id: 'wf1', category: 'Wash & Fold', name: 'Regular Clothes', unit: 'kg', price: 80, imageUrl: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?q=80&w=200&auto=format&fit=crop' },
  { id: 'wf2', category: 'Wash & Fold', name: 'Heavy Clothes', unit: 'kg', price: 120, imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?q=80&w=200&auto=format&fit=crop' },
  { id: 'wf3', category: 'Wash & Fold', name: 'Bedsheets', unit: 'piece', price: 60, imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=200&auto=format&fit=crop' },
  { id: 'wf4', category: 'Wash & Fold', name: 'Towels', unit: 'piece', price: 40, imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?q=80&w=200&auto=format&fit=crop' },
  { id: 'wf5', category: 'Wash & Fold', name: 'Blankets', unit: 'piece', price: 150, imageUrl: 'https://images.unsplash.com/photo-1572973163273-0d3ab96f0148?q=80&w=200&auto=format&fit=crop' },

  // Wash & Iron
  { id: 'wi1', category: 'Wash & Iron', name: 'Shirt', unit: 'piece', price: 15, imageUrl: 'https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?q=80&w=200&auto=format&fit=crop' },
  { id: 'wi2', category: 'Wash & Iron', name: 'T-Shirt', unit: 'piece', price: 12, imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=200&auto=format&fit=crop' },
  { id: 'wi3', category: 'Wash & Iron', name: 'Pants', unit: 'piece', price: 18, imageUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=200&auto=format&fit=crop' },
  { id: 'wi4', category: 'Wash & Iron', name: 'Jeans', unit: 'piece', price: 20, imageUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=200&auto=format&fit=crop' },
  { id: 'wi5', category: 'Wash & Iron', name: 'Kurta', unit: 'piece', price: 20, imageUrl: 'https://images.unsplash.com/photo-1610116306796-6fea9f4fae38?q=80&w=200&auto=format&fit=crop' },
  { id: 'wi6', category: 'Wash & Iron', name: 'Saree', unit: 'piece', price: 35, imageUrl: 'https://images.unsplash.com/photo-1610116306796-6fea9f4fae38?q=80&w=200&auto=format&fit=crop' },
  { id: 'wi7', category: 'Wash & Iron', name: 'Dress', unit: 'piece', price: 30, imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=200&auto=format&fit=crop' },

  // Dry Cleaning
  { id: 'dc1', category: 'Dry Cleaning', name: 'Shirt', unit: 'piece', price: 80, imageUrl: 'https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?q=80&w=200&auto=format&fit=crop' },
  { id: 'dc2', category: 'Dry Cleaning', name: 'Trousers', unit: 'piece', price: 80, imageUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=200&auto=format&fit=crop' },
  { id: 'dc3', category: 'Dry Cleaning', name: 'Blazer', unit: 'piece', price: 180, imageUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=200&auto=format&fit=crop' },
  { id: 'dc4', category: 'Dry Cleaning', name: 'Suit', unit: 'set', price: 300, imageUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=200&auto=format&fit=crop' },
  { id: 'dc5', category: 'Dry Cleaning', name: 'Saree', unit: 'piece', price: 200, imageUrl: 'https://images.unsplash.com/photo-1610116306796-6fea9f4fae38?q=80&w=200&auto=format&fit=crop' },
  { id: 'dc6', category: 'Dry Cleaning', name: 'Lehenga', unit: 'piece', price: 400, imageUrl: 'https://images.unsplash.com/photo-1610116306796-6fea9f4fae38?q=80&w=200&auto=format&fit=crop' },
  { id: 'dc7', category: 'Dry Cleaning', name: 'Jacket', unit: 'piece', price: 180, imageUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=200&auto=format&fit=crop' },

  // Shoes & Bags
  { id: 'sb1', category: 'Shoes & Bags', name: 'Sneakers', unit: 'pair', price: 150, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=200&auto=format&fit=crop' },
  { id: 'sb2', category: 'Shoes & Bags', name: 'Formal Shoes', unit: 'pair', price: 150, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=200&auto=format&fit=crop' },
  { id: 'sb3', category: 'Shoes & Bags', name: 'Sports Shoes', unit: 'pair', price: 150, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=200&auto=format&fit=crop' },
  { id: 'sb4', category: 'Shoes & Bags', name: 'Handbag', unit: 'piece', price: 180, imageUrl: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?q=80&w=200&auto=format&fit=crop' },
  { id: 'sb5', category: 'Shoes & Bags', name: 'Backpack', unit: 'piece', price: 180, imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=200&auto=format&fit=crop' },
];

export function GuestLaundryScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(LAUNDRY_CATEGORIES[0]);
  const [cart, setCart] = useState<Record<string, number>>({});

  const cartItemCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = PRODUCTS.find((p) => p.id === id);
    return sum + (product ? product.price * qty : 0);
  }, 0);

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const copy = { ...prev };
      const current = copy[id] || 0;
      const next = current + delta;
      if (next <= 0) {
        delete copy[id];
      } else {
        copy[id] = next;
      }
      return copy;
    });
  };

  const handleCheckout = () => {
    Alert.alert('Checkout', 'Proceeding to checkout with laundry items.');
  };

  const renderProduct = (item: typeof PRODUCTS[0]) => {
    const qty = cart[item.id] || 0;
    
    // Determine the source for the image
    let imageSource: any;
    if (item.name === 'Bedsheets' || item.name === 'Blankets') imageSource = require('../../../../assets/laundry/bedsheet.png');
    else if (item.name === 'Saree') imageSource = require('../../../../assets/laundry/saree.png');
    else if (item.name === 'Suit' || item.name === 'Blazer' || item.name === 'Jacket') imageSource = require('../../../../assets/laundry/suit.png');
    else if (item.name.includes('Sneakers') || item.name.includes('Shoes')) imageSource = require('../../../../assets/laundry/sneakers.png');
    else if (item.name === 'Handbag' || item.name === 'Backpack') imageSource = require('../../../../assets/laundry/handbag.png');
    else if (item.category === 'Wash & Fold') imageSource = require('../../../../assets/laundry/clothes_stack.png');
    else if (item.category === 'Wash & Iron' || item.category === 'Ironing') imageSource = require('../../../../assets/laundry/iron.png');
    else if (item.category === 'Dry Cleaning' || item.category === 'Home Linen') imageSource = require('../../../../assets/laundry/washing_machine.png');
    else if (item.category === 'Shoes & Bags') imageSource = require('../../../../assets/laundry/laundry_basket.png');
    else imageSource = { uri: item.imageUrl };

    return (
      <AnimatedPress key={item.id} style={styles.cardContainer} accessibilityRole="button">
        {/* Top Image Section */}
        <View style={styles.imageSection}>
          <Image source={imageSource} style={styles.cardImage} />
          
          {/* Discount Badge */}
          <View style={styles.discountBadge}>
            <Txt style={styles.discountText}>15% OFF</Txt>
          </View>
          
          {/* Heart Icon */}
          <View style={styles.heartCircle}>
            <Ionicons name="heart-outline" size={18} color={Colors.textMuted} />
          </View>
          
          {/* Fresh & Clean Badge */}
          <View style={styles.leafBadge}>
            <Ionicons name="leaf" size={12} color={Colors.success} />
            <Txt style={styles.leafText}>Fresh & Clean</Txt>
          </View>
        </View>

        {/* Bottom Details Section */}
        <View style={styles.detailsSection}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.cardTitle} numberOfLines={1}>{item.name}</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.cardSubtitle} numberOfLines={1}>{item.category}</Txt>
          
          <Row style={{ marginTop: 6, gap: 6, alignItems: 'baseline' }}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.cardPrice}>₹{item.price}/{item.unit}</Txt>
            <Txt maxFontSizeMultiplier={1.3} style={styles.cardStrike}>₹{Math.round(item.price * 1.15)}</Txt>
          </Row>

          {/* Add / Qty Button */}
          {qty > 0 ? (
            <Row align="center" justify="space-between" style={styles.qtyContainer}>
              <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => updateQty(item.id, -1)} style={styles.qtyBtn}>
                <Ionicons name="remove" size={16} color={Colors.success} />
              </AnimatedPress>
              <Txt maxFontSizeMultiplier={1.3} style={styles.qtyText}>{qty} {item.unit}</Txt>
              <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => updateQty(item.id, 1)} style={styles.qtyBtn}>
                <Ionicons name="add" size={16} color={Colors.success} />
              </AnimatedPress>
            </Row>
          ) : (
            <AnimatedPress accessibilityRole="button" style={styles.addButton} onPress={() => updateQty(item.id, 1)}>
              <Ionicons name="add" size={16} color={Colors.success} />
              <Txt maxFontSizeMultiplier={1.3} style={styles.addButtonText}>Add</Txt>
            </AnimatedPress>
          )}
        </View>
      </AnimatedPress>
    );
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" justify="space-between" style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Row align="center" gap={12}>
            <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Ionicons name="arrow-back" size={24} color={BG_WHITE} />
            </AnimatedPress>
            <Col>
              <Txt maxFontSizeMultiplier={1.3} style={styles.headerTitle}>Laundry Services</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.headerSubtitle}>Clean Clothes. More Time for What Matters.</Txt>
            </Col>
          </Row>
          <AnimatedPress accessibilityRole="button" style={styles.helpBtn} onPress={() => Alert.alert('Help', 'Contact Support')}>
            <Ionicons name="help-circle-outline" size={16} color={BG_WHITE} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.helpText}>Help</Txt>
          </AnimatedPress>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* VALUE PROPS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.valuePropsScroll}>
          <View style={styles.valuePropCard}>
            <Ionicons name="bicycle" size={24} color={BRAND_BLUE} />
            <Col style={{ marginLeft: 8 }}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.valuePropTitle}>Immediate Pickup & Delivery</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.valuePropDesc}>Fast and hassle-free.</Txt>
            </Col>
          </View>
          <View style={styles.valuePropCard}>
            <Ionicons name="time-outline" size={24} color={BRAND_BLUE} />
            <Col style={{ marginLeft: 8 }}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.valuePropTitle}>Choose Your Preferred Time</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.valuePropDesc}>You pick, we arrive.</Txt>
            </Col>
          </View>
          <View style={styles.valuePropCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color={BRAND_BLUE} />
            <Col style={{ marginLeft: 8 }}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.valuePropTitle}>Clean, Safe & Hygienic</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.valuePropDesc}>Trusted by PG residents.</Txt>
            </Col>
          </View>
        </ScrollView>

        {/* CATEGORY TABS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle }} contentContainerStyle={styles.tabsRow}>
          {LAUNDRY_CATEGORIES.map(cat => {
            let iconName = 'layers';
            if (cat === 'Wash & Fold') iconName = 'basket';
            if (cat === 'Wash & Iron') iconName = 'shirt';
            if (cat === 'Dry Cleaning') iconName = 'sparkles';
            if (cat === 'Premium Care') iconName = 'star';
            if (cat === 'Shoes & Bags') iconName = 'briefcase';
            if (cat === 'Home Linen') iconName = 'bed';
            
            return (
              <AnimatedPress accessibilityRole="button"
                key={cat}
                onPress={() => setActiveTab(cat)}
                style={[styles.tabBtn, activeTab === cat && styles.tabBtnActive]}
              >
                <Ionicons 
                  name={iconName as any} 
                  size={16} 
                  color={activeTab === cat ? BG_WHITE : Colors.textPrimary} 
                />
                <Txt maxFontSizeMultiplier={1.3} style={[styles.tabText, activeTab === cat && styles.tabTextActive]}>{cat}</Txt>
              </AnimatedPress>
            );
          })}
        </ScrollView>

        {/* SECTIONS */}
        <View style={styles.sectionsContainer}>
          {LAUNDRY_CATEGORIES.map(cat => {
            const items = PRODUCTS.filter(p => p.category === cat);
            if (items.length === 0) return null;
            return (
              <View key={cat} style={styles.sectionBlock}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.sectionHeaderTitle}>{cat}</Txt>
                {cat === 'Wash & Fold' && <Txt maxFontSizeMultiplier={1.3} style={styles.sectionHeaderSubtitle}>High-volume basic services</Txt>}
                {cat === 'Wash & Iron' && <Txt maxFontSizeMultiplier={1.3} style={styles.sectionHeaderSubtitle}>Washed and neatly pressed</Txt>}
                {cat === 'Dry Cleaning' && <Txt maxFontSizeMultiplier={1.3} style={styles.sectionHeaderSubtitle}>Special care for delicate items</Txt>}
                {cat === 'Shoes & Bags' && <Txt maxFontSizeMultiplier={1.3} style={styles.sectionHeaderSubtitle}>Premium cleaning and care</Txt>}
                
                <Spacer size={12} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16, paddingBottom: 16 }}>
                  {items.map(renderProduct)}
                </ScrollView>
              </View>
            );
          })}
        </View>
        <Spacer size={120} />
      </ScrollView>

      {/* BOTTOM ACTION BAR */}
      <View style={styles.bottomFixedContainer}>
        {/* Date / Time Selectors */}
        <View style={styles.timeSelectorBox}>
          <Row align="center">
            <Ionicons name="calendar" size={18} color={BRAND_GREEN} style={{ marginRight: 6 }} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.timeSelectorTitle}>Select Pickup & Delivery Time</Txt>
          </Row>
          <Spacer size={8} />
          <Row justify="space-between" gap={8}>
            <AnimatedPress accessibilityRole="button" style={styles.timeField}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Col style={{ marginLeft: 6, flex: 1 }}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.timeFieldLabel}>Pickup Time</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.timeFieldValue}>Today, 10:00 AM</Txt>
              </Col>
              <Ionicons name="chevron-down" size={12} color={Colors.textSecondary} />
            </AnimatedPress>
            <AnimatedPress accessibilityRole="button" style={styles.timeField}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Col style={{ marginLeft: 6, flex: 1 }}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.timeFieldLabel}>Delivery Time</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.timeFieldValue}>Today, 6:30 PM</Txt>
              </Col>
              <Ionicons name="chevron-down" size={12} color={Colors.textSecondary} />
            </AnimatedPress>
          </Row>
        </View>

        {/* Cart Bar */}
        <View style={styles.cartBar}>
          <Row align="center" gap={12}>
            <View>
              <Ionicons name="cart-outline" size={32} color={Colors.textPrimary} />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.cartBadgeText}>{cartItemCount}</Txt>
                </View>
              )}
            </View>
            <Col>
              <Txt maxFontSizeMultiplier={1.3} style={styles.cartTotalText}>₹{cartTotal}</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.viewCartText}>View Cart &gt;</Txt>
            </Col>
          </Row>
          <Btn
            onPress={handleCheckout}
            containerColor={cartItemCount > 0 ? Colors.textPrimary : Colors.borderSubtle}
            textColor={cartItemCount > 0 ? BG_WHITE : Colors.textMuted}
            borderRadius={Radii.control}
            height={44}
            disabled={cartItemCount === 0}
            style={{ flex: 1, marginLeft: 24 }}
          >
            <Txt maxFontSizeMultiplier={1.3} variant="button" color={cartItemCount > 0 ? BG_WHITE : Colors.textMuted}>Proceed to Checkout</Txt>
          </Btn>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_WHITE },
  
  // Header
  header: { backgroundColor: BRAND_BLUE },
  headerTitle: { fontSize: 18, fontWeight: '800', color: BG_WHITE },
  headerSubtitle: { fontSize: 11, color: BRAND_LIGHT_BLUE, marginTop: 2 },
  helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: BRAND_LIGHT_BLUE, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.card },
  helpText: { color: BG_WHITE, fontSize: 12, fontWeight: '600' },
  
  // Value Props
  valuePropsScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  valuePropCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND_LIGHT_BLUE, padding: 8, borderRadius: Radii.card, width: 220 },
  valuePropTitle: { fontSize: 12, fontWeight: '700', color: BRAND_BLUE },
  valuePropDesc: { fontSize: 10, color: BRAND_BLUE, marginTop: 2 },
  
  // Tabs
  tabsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.card, gap: 6 },
  tabBtnActive: { backgroundColor: BRAND_BLUE },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  tabTextActive: { color: BG_WHITE },
  
  // Sections
  sectionsContainer: { paddingHorizontal: 16, paddingTop: 16 },
  sectionBlock: { marginBottom: 24 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sectionHeaderSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  
  // Product Grid
  productGrid: { gap: 12 },
  
  // Custom Laundry Card
  cardContainer: { width: 160, marginRight: 12, backgroundColor: Colors.surface, borderRadius: Radii.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: Colors.surfaceMuted },
  imageSection: { height: 120, backgroundColor: '#EBF4EC', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  discountBadge: { position: 'absolute', top: 0, left: 0, backgroundColor: '#FF5252', borderBottomRightRadius: 12, borderTopLeftRadius: 16, paddingHorizontal: 8, paddingVertical: 4 },
  discountText: { color: Colors.textInverse, fontSize: 10, fontWeight: '800' },
  heartCircle: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, backgroundColor: Colors.surface, borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  leafBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: Palette.TintGreen, borderRadius: Radii.control, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Palette.TintGreen },
  leafText: { color: '#064E3B', fontSize: 9, fontWeight: '700' },
  
  detailsSection: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  cardSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: '800', color: Colors.success },
  cardStrike: { fontSize: 11, color: Colors.textMuted, textDecorationLine: 'line-through', fontWeight: '500' },
  
  addButton: { marginTop: 10, borderWidth: 1, borderColor: Colors.success, borderRadius: Radii.badge, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addButtonText: { color: Colors.success, fontSize: 13, fontWeight: '700' },
  
  qtyContainer: { marginTop: 10, borderWidth: 1, borderColor: Colors.success, borderRadius: Radii.badge, paddingVertical: 4, paddingHorizontal: 6, backgroundColor: Palette.TintGreen },
  qtyBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: Colors.success, fontSize: 13, fontWeight: '800' },
  
  // Bottom Bar
  bottomFixedContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: BG_WHITE, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, paddingBottom: 16 },
  timeSelectorBox: { backgroundColor: BRAND_LIGHT_GREEN, padding: 8, marginHorizontal: 16, marginTop: 12, borderRadius: Radii.card },
  timeSelectorTitle: { fontSize: 11, fontWeight: '700', color: BRAND_GREEN },
  timeField: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: BG_WHITE, padding: 6, borderRadius: Radii.control, borderWidth: 1, borderColor: '#D1EAE0' },
  timeFieldLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: '600' },
  timeFieldValue: { fontSize: 9, color: Colors.textPrimary, fontWeight: '700', marginTop: 1 },
  
  cartBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  cartBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: 'red', borderRadius: Radii.control, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { color: BG_WHITE, fontSize: 9, fontWeight: '700' },
  cartTotalText: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  viewCartText: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 }
});
