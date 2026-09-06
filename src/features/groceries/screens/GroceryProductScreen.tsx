import { SupplyItem } from '@/types';
import { useState, useMemo, useEffect } from 'react';
import { Share, StyleSheet, View, TouchableOpacity, ScrollView, Image } from 'react-native';

import { AnimatedPress, Txt } from '@/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import { useSupplyItems } from '../useSupply';
import { useAuthStore } from '@/store/authStore';

import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { useActiveProperty } from '@/features/properties/useProperties';
import { Radii, Palette, Colors } from '@/theme';

// Extracted shared components
import { MiniProductCard } from '../components/ui/MiniProductCard';
import { QuantityStepper } from '../components/ui/QuantityStepper';
import { SectionHeader } from '../components/ui/SectionHeader';
import { BulkPricingGrid } from '../components/grocery/BulkPricingGrid';
import { parseUnitQuantity } from '../utils/pricing';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Product attribute rows — real fields only. This used to invent a brand name, a rice
 * variety, a shelf life and an "origin" per category regardless of what the actual product
 * was (every rice item claimed to be "Sona Masoori" from "Agri-Gold Premium" with a 12-month
 * shelf life, even when it wasn't) — specifications a buyer could reasonably rely on, made
 * up. `SupplyItem` only actually carries `description`, `unit_label`, `gst_rate` and
 * `hsn_code`; this shows those, and nothing this screen doesn't actually know.
 */
const getProductDetails = (prod: SupplyItem, selectedUnit: string) => {
  const rows: { label: string; value: string }[] = [{ label: 'Pack Size', value: selectedUnit }];
  if (prod.gst_rate != null) rows.push({ label: 'GST', value: `${prod.gst_rate}%` });
  if (prod.hsn_code) rows.push({ label: 'HSN Code', value: prod.hsn_code });
  return rows;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export function GroceryProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const { data: supplyItems = [] } = useSupplyItems(activePgId);
  const { activeEntity: property } = useActiveProperty();

  const product = supplyItems.find((p) => p.id === id);
  const mode = useShoppingModeStore((s) => s.mode);

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

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);

  useEffect(() => {
    if (selectedIdx !== 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIdx(0);
    }
  }, [mode, selectedIdx]);

  const currentSavings = useMemo(() => {
    if (!options || options.length <= 1) return 0;
    const base = options[0];
    const rate = base.price / parseUnitQuantity(base.unit);
    const cur = options[selectedIdx];
    if (!base || !cur) return 0;
    return Math.max(0, Math.round(rate * parseUnitQuantity(cur.unit) - cur.price));
  }, [options, selectedIdx]);

  // ── 404 state ──
  if (!product || options.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
          <Txt maxFontSizeMultiplier={1.3} style={styles.errorText}>Product not found</Txt>
          <AnimatedPress accessibilityRole="button" style={styles.backBtnError} onPress={() => router.back()}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.backBtnText}>Go Back</Txt>
          </AnimatedPress>
        </View>
      </View>
    );
  }

  // ── Derived values ──
  const selectedOption = options[selectedIdx] || options[0];
  const compoundId = `${product.id}-${selectedOption.unit}`;
  const cartItem = cartItems.find((c) => c.id === compoundId);
  const quantity = cartItem?.quantity ?? 0;
  const cartItemCount = getItemCount();

  const price = selectedOption.price;
  const originalPrice = selectedOption.originalPrice;
  const discountPercent = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const savingsAmount = originalPrice ? originalPrice - price : 0;

  const imagesList = [product.image_url ? { uri: product.image_url } : require('../../../../assets/img_app_icon.jpg')];
  const productDetails = getProductDetails(product, selectedOption.unit);

  const relatedProducts = supplyItems.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 6);

  // ── Handlers ──
  const handleShare = async () => {
    try {
      await Share.share({ title: product.name, message: `Check out ${product.name} at only ₹${price} on SLV Premium PG Groceries!` });
    } catch (_) { /* cancelled */ }
  };

  const handleAdd = () => addItem(product, selectedOption, 1);
  const handleIncrease = () => updateQuantity(compoundId, quantity + 1);
  const handleDecrease = () => updateQuantity(compoundId, quantity - 1);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Floating top header — position: absolute + top: 0, so unlike the rest of this
          screen (which already uses insets.top below), its own top padding has to account
          for the notch/status bar directly rather than sitting in normal flow under it.
          insets.top + 14 matches every other grocery screen's header. */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 14 }]}>
        <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Go back" accessibilityRole="button" style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </AnimatedPress>
        <View style={styles.headerRight}>
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Share" accessibilityRole="button" style={styles.headerBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={18} color={Colors.textPrimary} />
          </AnimatedPress>
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Search" accessibilityRole="button" style={styles.headerBtn} onPress={() => router.push('/groceries/categories')}>
            <Ionicons name="search" size={18} color={Colors.textPrimary} />
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button" style={styles.headerBtn} onPress={() => router.push('/groceries/cart')}>
            <Ionicons name="cart-outline" size={18} color={Colors.textPrimary} />
            {cartItemCount > 0 && (
              <View style={styles.headerCartBadge}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.headerCartBadgeText}>{cartItemCount}</Txt>
              </View>
            )}
          </AnimatedPress>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Top split: image + title ── */}
        {/* Clears the floating header above (insets.top + 14 padding + ~36px buttons). */}
        <View style={[styles.topRowSection, { paddingTop: insets.top + 60 }]}>

          {/* Left: product image */}
          <View style={styles.leftImageColumn}>
            {discountPercent > 0 && (
              <View style={styles.discountBadge}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.discountBadgeText}>-{discountPercent}%</Txt>
              </View>
            )}
            <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"
              style={styles.wishlistBtn}
              onPress={() => toggleWishlist(product)}

            >
              <Ionicons
                name={isWishlisted ? 'heart' : 'heart-outline'}
                size={18}
                color={isWishlisted ? Colors.danger : Colors.textSecondary}
              />
            </AnimatedPress>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {imagesList.map((imgUrl: any, idx: number) => (
                <View key={idx} style={styles.mainImageWrapper}>
                  <Image
                    source={typeof imgUrl === 'string' ? { uri: imgUrl } : imgUrl}
                    style={styles.mainImage}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>
            {imagesList.length > 1 && (
              <View style={styles.paginationRow}>
                {imagesList.map((_: any, idx: number) => (
                  <View key={idx} style={[styles.dot, idx === 0 && styles.activeDot]} />
                ))}
              </View>
            )}
          </View>

          {/* Right: title, price. No "HIGH DEMAND" badge or star rating here — neither was
              real: every product showed the identical fixed "4.8 | 1K+ ratings" and the same
              demand badge regardless of the actual item, and `SupplyItem` has no rating or
              demand field to base either on. The subtitle now shows the product's real
              `description` when the catalog has one, instead of a fabricated one guessed
              from whether the name contains "rice". */}
          <View style={styles.rightInfoColumn}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.productTitle} numberOfLines={2}>{product.name}</Txt>
            {!!product.description && (
              <Txt maxFontSizeMultiplier={1.3} style={styles.productSubtitle} numberOfLines={2}>{product.description}</Txt>
            )}
            <Txt maxFontSizeMultiplier={1.3} style={styles.currentPrice}>₹{price}</Txt>
            {originalPrice ? (
              <View style={styles.mrpRow}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.mrpText}>MRP: ₹{originalPrice}</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.savingsAmountText}> (Save ₹{savingsAmount})</Txt>
              </View>
            ) : null}
            {savingsAmount > 0 && (
              <View style={styles.miniWholesaleCard}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.miniWholesaleText} numberOfLines={2}>
                  🎉 Special PG Wholesale Deal  <Txt maxFontSizeMultiplier={1.3} style={styles.greenBold}>Saved ₹{savingsAmount}!</Txt>
                </Txt>
              </View>
            )}
          </View>
        </View>

        {/* ── Body content ── */}
        <View style={styles.bodyContent}>

          {/* Pack size + quantity row */}
          <View style={styles.packQtyCard}>
            <View style={styles.packLeftSection}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.sectionHeading}>Choose Pack Size</Txt>
              <View style={styles.packSizesRow}>
                {options.map((opt, i) => {
                  const isSelected = selectedIdx === i;
                  return (
                    <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                      key={opt.unit}
                      style={[styles.packTab, isSelected && styles.selectedPackTab]}
                      onPress={() => setSelectedIdx(i)}

                    >
                      <Txt maxFontSizeMultiplier={1.3} style={[styles.packText, isSelected && styles.selectedPackText]}>
                        {opt.unit}{isSelected ? ' ✓' : ''}
                      </Txt>
                    </AnimatedPress>
                  );
                })}
              </View>
            </View>
            <View style={styles.qtyRightSection}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.quantityLabel}>Quantity</Txt>
              {quantity > 0 ? (
                <QuantityStepper quantity={quantity} onIncrease={handleIncrease} onDecrease={handleDecrease} />
              ) : (
                <AnimatedPress accessibilityRole="button" style={styles.inlineAddBtn} onPress={handleAdd}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.inlineAddText}>Add to Cart</Txt>
                </AnimatedPress>
              )}
            </View>
          </View>

          {/* Bulk pricing grid — owner mode only */}
          {mode === 'owner' && options.length > 1 && (
            <BulkPricingGrid
              options={options}
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
              currentSavings={currentSavings}
            />
          )}

          {/* Delivery card — this used to show a fixed "HSR Layout, Bangalore - 560102" and
              "Today, 6:00 PM - 8:00 PM" on every product page regardless of which property
              or resident was looking, which is simply the wrong address for almost everyone
              who ever saw it. The real address is the active property's own (same source
              GroceryCheckoutScreen uses); the specific delivery window is dropped rather
              than replaced with a different invented one — checkout is where a real slot is
              actually chosen. */}
          <View style={styles.deliveryCard}>
            <View style={styles.deliveryLeft}>
              <View style={styles.deliveryHeaderRow}>
                <Ionicons name="bicycle" size={16} color={Colors.info} />
                <Txt maxFontSizeMultiplier={1.3} style={styles.deliveryTitle}>Delivery to</Txt>
              </View>
              <Txt maxFontSizeMultiplier={1.3} style={styles.deliveryAddress} numberOfLines={1}>
                {property?.address || 'Your PG address'}
              </Txt>
            </View>
            <View style={styles.deliveryRight}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.deliveryRightLabel}>Delivery</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.deliveryTimeText}>Slots available at checkout</Txt>
            </View>
          </View>

          {/* Reassurance strip */}
          <View style={styles.reassuranceStrip}>
            {['Quality Checked', 'Hygienically Packed', 'Easy Replacement'].map((item) => (
              <View key={item} style={styles.reassuranceItem}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                <Txt maxFontSizeMultiplier={1.3} style={styles.reassuranceText}>{item}</Txt>
              </View>
            ))}
          </View>

          {/* Collapsible product details */}
          <View style={styles.detailsAccordionCard}>
            <AnimatedPress accessibilityRole="button"
              style={styles.accordionHeader}
              onPress={() => setIsDetailsExpanded(!isDetailsExpanded)}

            >
              <Txt maxFontSizeMultiplier={1.3} style={styles.accordionHeading}>Product Details</Txt>
              <Ionicons
                name={isDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.textPrimary}
              />
            </AnimatedPress>
            {isDetailsExpanded && (
              <View style={styles.accordionContent}>
                {productDetails.map((detail, idx) => (
                  <View key={idx} style={styles.accordionRow}>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.accordionLabel}>{detail.label}</Txt>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.accordionValue}>{detail.value}</Txt>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* You May Also Need — shared MiniProductCard */}
          <View style={styles.relatedSection}>
            <SectionHeader
              title="You May Also Need"
              actionLabel="View All →"
              onAction={() => router.push('/groceries/categories')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScrollContent}>
              {relatedProducts.map((p) => (
                <MiniProductCard
                  key={p.id}
                  product={p}
                  onPress={() => router.push({ pathname: '/groceries/product/[id]', params: { id: p.id } })}
                  showWishlist
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      {/* Sticky purchase bar */}
      <View style={[styles.stickyPurchaseBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.stickyBarLeft}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.stickyPrice}>₹{price}</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.stickyInfoText}>{selectedOption.unit} • Qty: {quantity || 1}</Txt>
        </View>

        {cartItemCount > 0 && (
          <AnimatedPress accessibilityRole="button" style={styles.stickyBarMiddle} onPress={() => router.push('/groceries/cart')}>
            <Ionicons name="cart-outline" size={14} color={Colors.primary} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.stickyCartText}>View Cart ({cartItemCount})</Txt>
          </AnimatedPress>
        )}

        {quantity > 0 ? (
          <AnimatedPress accessibilityRole="button" style={[styles.stickyAddBtn, styles.addedBtn]} onPress={() => router.push('/groceries/cart')}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Colors.surface} style={{ marginRight: 4 }} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.stickyAddBtnText}>Added ✓</Txt>
          </AnimatedPress>
        ) : (
          <AnimatedPress accessibilityRole="button" style={styles.stickyAddBtn} onPress={handleAdd}>
            <Ionicons name="cart" size={16} color={Colors.surface} style={{ marginRight: 4 }} />
            <Txt maxFontSizeMultiplier={1.3} style={styles.stickyAddBtnText}>Add to Cart</Txt>
          </AnimatedPress>
        )}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.canvas },
  scrollContent: { paddingBottom: 110 },
  errorContainer: { flex: 1, backgroundColor: Colors.surface },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  backBtnError: { backgroundColor: Colors.primary, borderRadius: Radii.control, paddingVertical: 10, paddingHorizontal: 20, marginTop: 8 },

  floatingHeader: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 36, height: 36, borderRadius: Radii.pill, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3, position: 'relative' },
  headerCartBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.primary, borderRadius: Radii.control, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },

  topRowSection: { flexDirection: 'row', backgroundColor: Colors.surface, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle, gap: 14 },
  leftImageColumn: { width: '44%', height: 170, justifyContent: 'center', alignItems: 'center', position: 'relative', backgroundColor: Colors.surface },
  discountBadge: { position: 'absolute', top: 2, left: 2, backgroundColor: Colors.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.badge, zIndex: 3 },
  wishlistBtn: { position: 'absolute', top: 2, right: 2, width: 28, height: 28, borderRadius: Radii.pill, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.textPrimary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2, zIndex: 3 },
  imageScroll: { width: '100%' },
  mainImageWrapper: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center' },
  mainImage: { width: '90%', height: '90%', resizeMode: 'contain' },
  paginationRow: { flexDirection: 'row', gap: 3, position: 'absolute', bottom: -6, alignSelf: 'center' },
  dot: { width: 4, height: 4, borderRadius: Radii.pill, backgroundColor: Colors.borderSubtle },
  activeDot: { width: 10, backgroundColor: Colors.primary },

  rightInfoColumn: { width: '52%', justifyContent: 'center' },
  mrpRow: { flexDirection: 'row', alignItems: 'center' },
  miniWholesaleCard: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: Radii.badge, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },

  bodyContent: { paddingHorizontal: 16, paddingTop: 16 },

  packQtyCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 12, borderWidth: 1, borderColor: Colors.borderSubtle, marginBottom: 16, alignItems: 'center' },
  packLeftSection: { flex: 1, paddingRight: 8 },
  packSizesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  packTab: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: Radii.badge, borderWidth: 1.2, borderColor: Colors.borderSubtle, backgroundColor: Colors.surface },
  selectedPackTab: { borderColor: Colors.primary, backgroundColor: Colors.surfaceElevated },
  selectedPackText: { color: Colors.primary },
  qtyRightSection: { width: 100, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: Colors.borderSubtle, paddingLeft: 8 },
  inlineAddBtn: { backgroundColor: Colors.primary, borderRadius: Radii.control, paddingVertical: 6, paddingHorizontal: 12 },

  deliveryCard: { flexDirection: 'row', backgroundColor: Palette.TintBlue, borderRadius: Radii.card, padding: 12, borderWidth: 1, borderColor: Colors.borderSubtle, marginBottom: 16 },
  deliveryLeft: { flex: 1.2, justifyContent: 'center' },
  deliveryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  deliveryRight: { flex: 1, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: Colors.borderSubtle, justifyContent: 'center' },

  reassuranceStrip: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 10, borderWidth: 1, borderColor: Colors.borderSubtle, marginBottom: 16 },
  reassuranceItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  detailsAccordionCard: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 14, borderWidth: 1, borderColor: Colors.borderSubtle, marginBottom: 20 },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accordionContent: { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, paddingTop: 6 },
  accordionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.canvas },

  relatedSection: { marginBottom: 10 },
  relatedScrollContent: { gap: 8 },

  stickyPurchaseBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, paddingHorizontal: 16, paddingTop: 10, alignItems: 'center', justifyContent: 'space-between', shadowColor: Colors.textPrimary, shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 8 },
  stickyBarLeft: { justifyContent: 'center' },
  stickyBarMiddle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stickyAddBtn: { backgroundColor: Colors.primary, borderRadius: Radii.card, paddingVertical: 10, paddingHorizontal: 18, minWidth: 120, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  addedBtn: { backgroundColor: Colors.primaryDark },
  errorText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '700' as const },
  backBtnText: { color: Colors.surface, fontWeight: '700' as const, fontSize: 13 },
  headerCartBadgeText: { color: Colors.surface, fontSize: 9, fontWeight: '700' as const },
  discountBadgeText: { color: Colors.surface, fontSize: 9, fontWeight: '700' as const },
  productTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary, marginBottom: 2 },
  productSubtitle: { fontSize: 12, color: Colors.textSecondary, fontWeight: '400' as const, marginBottom: 8 },
  currentPrice: { fontSize: 20, fontWeight: '700' as const, color: Colors.primary, marginBottom: 4 },
  mrpText: { fontSize: 11, color: Colors.textMuted, textDecorationLine: 'line-through' as const, fontWeight: '400' as const },
  savingsAmountText: { fontSize: 11, color: Colors.danger, fontWeight: '700' as const },
  miniWholesaleText: { fontSize: 10, fontWeight: '700' as const, color: Colors.primary, lineHeight: 14 },
  greenBold: { color: Colors.primary, fontWeight: '700' as const },
  sectionHeading: { fontSize: 12, fontWeight: '700' as const, color: Colors.textPrimary, marginBottom: 6 },
  packText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '700' as const },
  quantityLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.textPrimary, marginBottom: 6 },
  inlineAddText: { color: Colors.surface, fontSize: 11, fontWeight: '700' as const },
  deliveryTitle: { fontSize: 10, color: Colors.textSecondary, fontWeight: '700' as const },
  deliveryAddress: { fontSize: 12, fontWeight: '700' as const, color: Colors.textPrimary },
  deliveryRightLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '700' as const, marginBottom: 2 },
  deliveryTimeText: { color: Colors.info, fontWeight: '700' as const, fontSize: 12 },
  reassuranceText: { fontSize: 9, fontWeight: '700' as const, color: Colors.textPrimary },
  accordionHeading: { fontSize: 14, fontWeight: '700' as const, color: Colors.textPrimary },
  accordionLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' as const },
  accordionValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '700' as const },
  stickyPrice: { fontSize: 18, fontWeight: '700' as const, color: Colors.primary },
  stickyInfoText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '400' as const, marginTop: 1 },
  stickyCartText: { color: Colors.primary, fontSize: 11, fontWeight: '700' as const },
  stickyAddBtnText: { color: Colors.surface, fontWeight: '700' as const, fontSize: 13 } });
