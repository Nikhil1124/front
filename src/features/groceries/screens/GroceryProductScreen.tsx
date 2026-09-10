import { useMemo } from 'react';
import { Share, StyleSheet, View, ScrollView, Image } from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import { useSupplyItems } from '../useSupply';
import { useAuthStore } from '@/store/authStore';


import { MiniProductCard } from '../components/ui/MiniProductCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { AnimatedPress, Txt } from '@/components/ui';
import { Radii, Colors } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function GroceryProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const { data: supplyItems = [] } = useSupplyItems(activePgId);

  const product = supplyItems.find((p) => p.id === id);

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const getItemCount = useCartStore((s) => s.getItemCount);

  const isWishlisted = useWishlistStore((s) => s.isWishlisted(product?.id || ''));
  const toggleWishlist = useWishlistStore((s) => s.toggleItem);

  const options = useMemo(() => {
    if (!product) return [];
    return [{ price: product.price, unit: product.unit_label, originalPrice: product.mrp ?? undefined }];
  }, [product]);

  const selectedIdx = 0;

  if (!product || options.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color="#777" />
          <Txt maxFontSizeMultiplier={1.3} style={styles.errorText}>Product not found</Txt>
          <AnimatedPress accessibilityRole="button" style={styles.backBtnError} onPress={() => router.back()}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.backBtnText}>Go Back</Txt>
          </AnimatedPress>
        </View>
      </View>
    );
  }

  const selectedOption = options[selectedIdx] || options[0];
  const compoundId = `${product.id}-${selectedOption.unit}`;
  const cartItem = cartItems.find((c) => c.id === compoundId);
  const quantity = cartItem?.quantity ?? 0;
  const cartItemCount = getItemCount();

  const price = selectedOption.price;
  const originalPrice = selectedOption.originalPrice;
  const discountPercent = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  const relatedProducts = supplyItems
    .filter((p) => p.category_id === product.category_id && p.id !== product.id)
    .slice(0, 6);

  const handleShare = async () => {
    try {
      await Share.share({
        title: product.name,
        message: `Check out ${product.name} at only ₹${price}!`,
      });
    } catch (_) { /* cancelled */ }
  };

  const handleAdd = () => addItem(product, selectedOption, 1);
  const handleIncrease = () => updateQuantity(compoundId, quantity + 1);
  const handleDecrease = () => updateQuantity(compoundId, quantity - 1);

  // `description` is the only per-item copy the catalog actually carries (`ItemResponse`).
  // There was a hardcoded subtitle here — "Soft, fluffy rotis for a healthier family" —
  // rendered under EVERY product regardless of what it was, plus a "brand" invented by
  // splitting the product name on its first space. Both are gone; a product with no
  // description now shows none.
  const description = product.description?.trim() || null;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* ── Immersive Hero Section ── */}
        <View style={styles.heroArea}>
          <LinearGradient 
            colors={['#E8F5E9', Colors.surface]} 
            style={StyleSheet.absoluteFill} 
          />
          <Image
            source={
              product.image_url
                ? { uri: product.image_url }
                : require('../../../../assets/productimages/d1_nobg.webp')
            }
            style={styles.mainImage}
            resizeMode="cover"
          />

          {discountPercent > 0 && (
            <View style={styles.discountBadgeHero}>
              <Ionicons name="pricetag" size={12} color={Colors.textInverse} style={{ marginRight: 4 }} />
              <Txt maxFontSizeMultiplier={1} style={styles.discountBadgeHeroText}>
                {discountPercent}% OFF
              </Txt>
            </View>
          )}

          {/* Dots */}
          <View style={styles.paginationDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={[styles.dot, styles.dotInactive]} />
            <View style={[styles.dot, styles.dotInactive]} />
          </View>
        </View>

        {/* ── Details Sheet ── */}
        <View style={styles.sheetContainer}>
          
          <View style={styles.titleRow}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.productName}>
              {product.name}
            </Txt>
          </View>

          {description ? (
            <Txt maxFontSizeMultiplier={1.2} style={styles.subtitleText}>{description}</Txt>
          ) : null}

          {/* A rating badge ("⭐ 4.6 (12.4K reviews)"), a "#1 Best Seller" badge and a
              "Made from 100% Natural Wheat" callout used to render here. All three were
              fixed strings on every product in the catalog — there is no rating, review
              count, sales rank or ingredient field on `ItemResponse`, and no endpoint that
              could supply one. Removed rather than left inventing social proof. */}

          {/* Pricing Row */}
          <View style={styles.priceRow}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.price}>₹{Number(price || 0).toFixed(2)}</Txt>
            {originalPrice ? (
              <Txt maxFontSizeMultiplier={1.3} style={styles.strikePrice}>₹{Number(originalPrice).toFixed(2)}</Txt>
            ) : null}
            {discountPercent > 0 && (
              <View style={styles.savingsPillInline}>
                <Txt maxFontSizeMultiplier={1} style={styles.savingsTextInline}>Save {discountPercent}%</Txt>
              </View>
            )}
          </View>
          <Txt maxFontSizeMultiplier={1} style={styles.taxText}>Inclusive of all taxes</Txt>

          {/* Inline Action Row */}
          <View style={styles.inlineActionRow}>
            <View style={styles.inlineQtyControl}>
              <AnimatedPress style={styles.inlineQtyBtn} onPress={quantity > 0 ? handleDecrease : undefined}>
                <Ionicons name="remove" size={20} color={quantity > 0 ? '#1A1A1A' : '#CCC'} />
              </AnimatedPress>
              <Txt maxFontSizeMultiplier={1.2} style={styles.inlineQtyText}>{quantity > 0 ? quantity : 1}</Txt>
              <AnimatedPress style={styles.inlineQtyBtn} onPress={handleIncrease}>
                <Ionicons name="add" size={20} color="#1A1A1A" />
              </AnimatedPress>
            </View>
            <AnimatedPress style={styles.inlineAddBtn} onPress={quantity > 0 ? () => router.push('/groceries/cart') : handleAdd}>
              <Ionicons name="cart-outline" size={18} color={Colors.textInverse} style={{ marginRight: 8 }} />
              <Txt maxFontSizeMultiplier={1.2} style={styles.inlineAddText}>
                {quantity > 0 ? 'Go to Cart' : 'Add to Cart'}
              </Txt>
            </AnimatedPress>
          </View>

          {/* A four-icon "benefit strip" (Fresh & Pure Ingredients / Trusted Brand / Rich in
              Nutrition / Quality Checked) rendered here on every product, cleaning supplies
              and cooking gas included. Nothing backed it. Removed. */}

          {/* Product Details Box — only fields the catalog genuinely returns. `Brand`
              (invented from the name), `Type: Grocery` and `Shelf Life: 6 Months` were
              fixed strings on every item and are gone; pack size is real (`unit_label`). */}
          <View style={styles.detailsBox}>
            <View style={styles.detailsHeaderRow}>
              <Ionicons name="document-text-outline" size={18} color="#1A1A1A" />
              <Txt maxFontSizeMultiplier={1.1} style={styles.detailsHeaderText}>Product Details</Txt>
            </View>
            <View style={styles.detailsDivider} />

            <View style={styles.detailRow}>
              <Txt maxFontSizeMultiplier={1.1} style={styles.detailLabel}>Pack Size</Txt>
              <Txt maxFontSizeMultiplier={1.1} style={styles.detailValue}>{selectedOption.unit}</Txt>
            </View>
          </View>

          {/* Related products */}
          {relatedProducts.length > 0 && (
            <View style={styles.relatedSection}>
              <SectionHeader
                title="You May Also Need"
                actionLabel="View All →"
                onAction={() => router.push('/groceries/categories')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {relatedProducts.map((p) => (
                  <MiniProductCard
                    key={p.id}
                    product={p}
                    onPress={() =>
                      router.push({ pathname: '/groceries/product/[id]', params: { id: p.id } })
                    }
                    showWishlist
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Floating Top Header ── */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 8 }]}>
        <AnimatedPress style={styles.headerCircleBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
        </AnimatedPress>

        <View style={styles.headerRight}>
          <AnimatedPress style={styles.headerCircleBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={18} color="#1A1A1A" />
          </AnimatedPress>
          <AnimatedPress style={[styles.headerCircleBtn, { position: 'relative' }]} onPress={() => router.push('/groceries/cart')}>
            <Ionicons name="cart-outline" size={18} color="#1A1A1A" />
            {cartItemCount > 0 && (
              <View style={styles.cartBadge}>
                <Txt maxFontSizeMultiplier={1} style={styles.cartBadgeText}>{cartItemCount}</Txt>
              </View>
            )}
          </AnimatedPress>
        </View>
      </View>
      
      {/* Wishlist Heart sits right below the header icons */}
      <AnimatedPress
        style={[styles.headerCircleBtn, { position: 'absolute', top: insets.top + 56, right: 16, zIndex: 20 }]}
        onPress={() => toggleWishlist(product)}
      >
        <Ionicons
          name={isWishlisted ? 'heart' : 'heart'}
          size={20}
          color={isWishlisted ? '#FF4B4B' : '#999'}
        />
      </AnimatedPress>

      {/* ── Bottom Sticky Bar (Always visible in screenshot) ── */}
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.stickyLeft}>
          <Txt maxFontSizeMultiplier={1.2} style={styles.stickyPrice}>₹{Number(price || 0).toFixed(2)}</Txt>
          <Txt maxFontSizeMultiplier={1} style={styles.stickyUnit}>{selectedOption.unit}</Txt>
        </View>
        <AnimatedPress style={styles.stickyAddBtn} onPress={quantity > 0 ? () => router.push('/groceries/cart') : handleAdd}>
          <Ionicons name={quantity > 0 ? 'cart' : 'cart-outline'} size={18} color={Colors.textInverse} style={{ marginRight: 8 }} />
          <Txt maxFontSizeMultiplier={1.2} style={styles.stickyAddText}>
            {quantity > 0 ? 'Go to Cart' : 'Add to Cart'}
          </Txt>
        </AnimatedPress>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scrollContent: { paddingBottom: 140 },

  // Header
  floatingHeader: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerRight: { flexDirection: 'row', gap: 12 },
  headerCircleBtn: {
    width: 38, height: 38, borderRadius: Radii.feature,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  cartBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#FF4B4B', borderRadius: Radii.control, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.textInverse },

  // Hero
  heroArea: { width: '100%', height: 380, position: 'relative' },
  mainImage: { width: '100%', height: '100%' },
  discountBadgeHero: {
    position: 'absolute', bottom: 40, left: 16,
    backgroundColor: '#FF4B4B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.badge,
    flexDirection: 'row', alignItems: 'center'
  },
  discountBadgeHeroText: { color: Colors.textInverse, fontSize: 10, fontWeight: '700' },
  paginationDots: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: Radii.badge },
  dotActive: { backgroundColor: '#008040' },
  dotInactive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#CCC' },

  // Sheet
  sheetContainer: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -20, paddingHorizontal: 16, paddingTop: 20, zIndex: 5,
  },
  brandText: { fontSize: 12, color: '#777', marginBottom: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  productName: { flex: 1, fontSize: 22, fontWeight: '800', color: '#1A1A1A', lineHeight: 28 },
  subtitleText: { fontSize: 13, color: '#777', marginTop: 4, marginBottom: 12 },

  // Badges
  topBadgesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 8 },
  badgesLeft: { flexDirection: 'column', gap: 6, alignItems: 'flex-start' },
  ratingBadge: { backgroundColor: '#FFF9E6', paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radii.badge },
  ratingText: { fontSize: 10, fontWeight: '600', color: '#B8860B' },
  bestSellerBadge: { backgroundColor: '#FFF3E0', paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radii.badge },
  bestSellerText: { fontSize: 10, fontWeight: '700', color: '#E65100' },
  calloutRight: {
    backgroundColor: '#E8F5E9', borderRadius: Radii.badge, padding: 6,
    flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 6
  },
  calloutIcon: { opacity: 0.8 },
  calloutText: { fontSize: 9, fontWeight: '600', color: '#2E7D32', lineHeight: 12, flex: 1 },

  // Price
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2 },
  price: { fontSize: 28, fontWeight: '800', color: '#008040', lineHeight: 34 },
  strikePrice: { fontSize: 16, color: '#999', textDecorationLine: 'line-through', fontWeight: '500' },
  savingsPillInline: { backgroundColor: '#E8F5E9', paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radii.badge, marginLeft: 4 },
  savingsTextInline: { fontSize: 11, color: '#008040', fontWeight: '700' },
  taxText: { fontSize: 11, color: '#888', marginBottom: 16 },

  // Inline Actions
  inlineActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  inlineQtyControl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: Radii.feature,
    height: 48, width: 110, justifyContent: 'space-between', paddingHorizontal: 4
  },
  inlineQtyBtn: { width: 36, height: 40, justifyContent: 'center', alignItems: 'center' },
  inlineQtyText: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  inlineAddBtn: {
    flex: 1, backgroundColor: '#008040', borderRadius: Radii.feature, height: 48,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center'
  },
  inlineAddText: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },

  // Benefit Strip
  benefitStrip: {
    flexDirection: 'row', backgroundColor: '#F1F8F5', borderRadius: Radii.badge,
    paddingVertical: 12, marginBottom: 20,
  },
  benefitItem: { flex: 1, alignItems: 'center', gap: 4 },
  benefitDivider: { borderLeftWidth: 1, borderLeftColor: '#D1E8DD' },
  benefitItemText: { fontSize: 9, fontWeight: '600', color: '#2E7D32', textAlign: 'center', lineHeight: 12 },

  // Product Details Box
  detailsBox: { borderWidth: 1, borderColor: '#E8E8E8', borderRadius: Radii.control, padding: 16, marginBottom: 24 },
  detailsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  detailsHeaderText: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  detailsDivider: { height: 1, backgroundColor: '#E8E8E8', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  detailLabel: { fontSize: 12, color: '#777' },
  detailValue: { fontSize: 12, color: '#1A1A1A', fontWeight: '600' },

  // Related
  relatedSection: { marginBottom: 20 },

  // Sticky Bottom Bar
  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: '#EEE',
    paddingHorizontal: 16, paddingTop: 12,
  },
  stickyLeft: { justifyContent: 'center', flex: 1, paddingRight: 10 },
  stickyPrice: { fontSize: 20, fontWeight: '800', color: '#008040' },
  stickyUnit: { fontSize: 11, color: '#777', marginTop: 2 },
  stickyAddBtn: {
    backgroundColor: '#008040', borderRadius: Radii.feature, height: 44, width: 160,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center'
  },
  stickyAddText: { color: Colors.textInverse, fontSize: 14, fontWeight: '700' },

  // Error state
  errorContainer: { flex: 1, backgroundColor: Colors.surface },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  errorText: { fontSize: 16, color: '#777', fontWeight: '700' },
  backBtnError: { backgroundColor: '#008040', borderRadius: Radii.badge, paddingVertical: 10, paddingHorizontal: 20, marginTop: 8 },
  backBtnText: { color: Colors.textInverse, fontWeight: '700', fontSize: 13 },
});
