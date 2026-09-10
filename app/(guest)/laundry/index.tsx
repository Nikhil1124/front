import { View, ScrollView, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/theme';
import { AnimatedPress, Btn, Col, Row, Spacer, Txt } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';
import { useLaundryStore, LAUNDRY_SERVICES } from '@/features/laundry/store/useLaundryStore';
import { LaundryCard } from '@/features/laundry/components/LaundryCard';


const CATEGORIES = [
  { id: 'c1', title: 'Wash & Fold', desc: 'Clean, dry & neatly folded', img: require('../../../assets/laundry/clothes_stack.png') },
  { id: 'c2', title: 'Wash & Iron', desc: 'Washed, dried & professionally ironed', img: require('../../../assets/laundry/iron.png') },
  { id: 'c3', title: 'Dry Cleaning', desc: 'For delicate & premium clothing', img: require('../../../assets/laundry/suit.png') },
  { id: 'c4', title: 'Home Linen', desc: 'Bedsheets, blankets & towels', img: require('../../../assets/laundry/bedsheet.png') },
  { id: 'c5', title: 'Shoes & Bags', desc: 'Cleaning & care for footwear and bags', img: require('../../../assets/laundry/sneakers.png') },
];

export default function LaundryHomeScreen() {
  const insets = useSafeAreaInsets();
  const guest = usePGowStore((s) => s.loggedInGuest);
  
  const cart = useLaundryStore((s) => s.cart);
  const updateCart = useLaundryStore((s) => s.updateCart);

  // Pick some popular items
  const popularItems = [
    LAUNDRY_SERVICES.find(s => s.name === 'Regular Clothes'),
    LAUNDRY_SERVICES.find(s => s.name === 'Shirt'),
    LAUNDRY_SERVICES.find(s => s.name === 'Bedsheet'),
    LAUNDRY_SERVICES.find(s => s.name === 'Blazer'),
  ].filter(Boolean) as typeof LAUNDRY_SERVICES;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Row align="center" justify="space-between" style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Row align="center" gap={16}>
            <AnimatedPress accessibilityRole="button" onPress={() => router.back()} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </AnimatedPress>
            <Txt maxFontSizeMultiplier={1.3} style={styles.headerTitle}>Laundry</Txt>
          </Row>
          <AnimatedPress accessibilityRole="button" onPress={() => router.push('/laundry/orders')}>
            <Ionicons name="receipt-outline" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
        </Row>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* PG LOCATION BANNER */}
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
          <Txt style={styles.locationText}>PGow • Room {guest?.roomNo || '...'}</Txt>
        </View>

        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          <Txt style={styles.heroTitle}>Fresh clothes, without the hassle.</Txt>
          <Txt style={styles.heroSubtitle}>Book a pickup and we'll take care of the rest.</Txt>
          
          <Btn 
            onPress={() => router.push('/laundry/select')}
            containerColor={Colors.primary}
            textColor={Colors.surface}
            borderRadius={Radii.pill}
            style={{ marginTop: 24, alignSelf: 'flex-start', paddingHorizontal: 24 }}
          >
            <Txt variant="button" color={Colors.textInverse}>Start a Laundry Booking</Txt>
          </Btn>
        </View>

        <Spacer size={32} />

        {/* SERVICE CATEGORIES */}
        <View style={styles.section}>
          <Txt style={styles.sectionTitle}>Service Categories</Txt>
          
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map(cat => (
              <AnimatedPress key={cat.id} style={styles.categoryCard} onPress={() => router.push('/laundry/select')}>
                <View style={styles.categoryImageWrap}>
                  <Image source={cat.img} style={styles.categoryImage} />
                </View>
                <Col style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
                  <Txt style={styles.categoryTitle}>{cat.title}</Txt>
                  <Txt style={styles.categoryDesc} numberOfLines={2}>{cat.desc}</Txt>
                </Col>
                <Ionicons name="chevron-forward" size={16} color={Colors.borderSubtle} style={{ marginRight: 12 }} />
              </AnimatedPress>
            ))}
          </View>
        </View>

        <Spacer size={32} />

        {/* POPULAR SERVICES */}
        <View style={styles.section}>
          <Txt style={styles.sectionTitle}>Popular Services</Txt>
          <Spacer size={16} />
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {popularItems.map(item => (
              <LaundryCard 
                key={item.id} 
                item={item} 
                qty={cart[item.id] || 0} 
                onUpdateQty={(delta) => updateCart(item.id, delta)} 
              />
            ))}
          </ScrollView>
        </View>

      </ScrollView>

      {/* STICKY BOTTOM BAR (if items in cart) */}
      {Object.keys(cart).length > 0 && (
        <View style={styles.bottomBar}>
          <Row align="center" justify="space-between">
            <Col>
              <Txt style={styles.cartItemsCount}>{Object.keys(cart).length} items added</Txt>
              <Txt style={styles.cartTotalHint}>View selected items</Txt>
            </Col>
            <Btn 
              onPress={() => router.push('/laundry/select')}
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  
  locationBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  locationText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginLeft: 6 },
  
  heroSection: { paddingHorizontal: 20, paddingTop: 32 },
  heroTitle: { fontSize: 32, fontWeight: '800', color: Colors.primaryDark, lineHeight: 38 },
  heroSubtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 12, lineHeight: 22, maxWidth: '80%' },
  
  section: { paddingVertical: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 16 },
  
  categoriesGrid: { paddingHorizontal: 16, marginTop: 16, gap: 12 },
  categoryCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderSubtle, overflow: 'hidden', alignItems: 'center' },
  categoryImageWrap: { width: 80, height: 80, backgroundColor: '#EBF4EC' },
  categoryImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  categoryTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  categoryDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
  cartItemsCount: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  cartTotalHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
