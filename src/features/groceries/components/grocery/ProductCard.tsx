import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  ScrollView,
} from 'react-native';
import { SupplyItem } from '@/types';
import { useCartStore } from '../../store/useCartStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';
import { baseProductName } from '../../variantGroups';
import { useResponsive, useResponsivePadding } from '@/utils/responsive';

interface ProductCardProps {
  product: SupplyItem;
  onPress?: (product: SupplyItem) => void;
  layout?: 'deal' | 'simple';
  style?: StyleProp<ViewStyle>;
  customQuantity?: number;
  onCustomAdd?: () => void;
  // onCustomIncrease?: () => void;
  // onCustomDecrease?: () => void;
  hideWishlist?: boolean;
  /**
   * The pack sizes of this product, smallest first, from `groupByVariant`. Give the card the
   * whole family and it shows a size picker; give it nothing and it behaves exactly as before,
   * one pack per card.
   *
   * Each entry is a real catalogue row with its own id and price — picking a chip changes
   * which ROW the card is showing, it does not scale one price by a weight.
   */
  variants?: SupplyItem[];
}

/**
 * Memoised: the catalog screen renders this dozens of times across six sections, and every
 * one of them re-rendered whenever anything on that screen changed state — a search
 * keystroke, a filter toggle, the cart badge incrementing. Each card carries several
 * `AnimatedPress` instances, and each of those owns a Reanimated shared value, so the cost
 * of a needless re-render here is not the View tree alone.
 */
const ProductCardBase: React.FC<ProductCardProps> = ({
  product,
  onPress,
  layout = 'deal',
  style,
  customQuantity,
  onCustomAdd,
  // onCustomIncrease,
  // onCustomDecrease,
  hideWishlist,
  variants,
}) => {
  const { width, isTablet } = useResponsive();
  const padding = useResponsivePadding();
  // Deal card: 2-column grid. Simple card: horizontal rail.
  const cardWidth = layout === 'deal'
    ? (width - (padding * 2) - 12) / 2
    : isTablet ? 140 : Math.min(width * 0.36, 150);

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  // const updateQuantity = useCartStore((s) => s.updateQuantity);
  const isWishlistedStore = useWishlistStore((s) => s.isWishlisted(product.id));
  // Wishlist stays on the product, not the pack — someone saves "Onion", not "Onion (500 g)".
  const toggleItemStore = useWishlistStore((s) => s.toggleItem);

  const isWishlisted = hideWishlist ? false : isWishlistedStore;
  const toggleItem = hideWishlist ? () => {} : toggleItemStore;

  // `product` is the family's default (the first pack); `packs` is every pack it sells.
  const packs = variants && variants.length > 0 ? variants : [product];
  const hasSizePicker = packs.length > 1;

  const [selectedIdx, setSelectedIdx] = useState(0);

  // Clamped during render, not in an effect. The family can get shorter between renders (a
  // search narrowing, a pack going out of stock) while a later chip is selected, and an
  // effect would leave the index out of range for a frame — long enough for the card to price
  // one pack while Add adds another.
  const safeIdx = selectedIdx < packs.length ? selectedIdx : 0;
  const selectedPack = packs[safeIdx];
  // With chips under it, "Onion (250 g)" says the size twice — and the bracketed size is the
  // half that made four packs of one vegetable look like four different products.
  const displayName = hasSizePicker ? baseProductName(product.name) : product.name;
  const selectedOption = {
    price: selectedPack.price,
    unit: selectedPack.unit_label || 'piece',
    originalPrice: selectedPack.mrp ?? undefined,
  };
  const compoundId = `${selectedPack.id}-${selectedOption.unit}`;
  const cartItem = cartItems.find((item) => item.id === compoundId);
  const quantity = customQuantity !== undefined ? customQuantity : (cartItem ? cartItem.quantity : 0);

  const price = selectedOption.price;
  const originalPrice = selectedOption.originalPrice;
  const discountPercent = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  const handleAdd = onCustomAdd || (() => addItem(selectedPack, selectedOption, 1));
  // const handleIncrease = onCustomIncrease || (() => updateQuantity(compoundId, quantity + 1));
  // const handleDecrease = onCustomDecrease || (() => updateQuantity(compoundId, quantity - 1));

  // ── Compact "simple" layout for horizontal rails ──────────────────────────
  if (layout === 'simple') {
    return (
      <AnimatedPress
        style={[styles.simpleCard, { width: cardWidth }, style]}
        scale={0.97}
        onPress={() => onPress?.(product)}
      >
        {/* Discount badge */}
        {discountPercent > 0 && (
          <View style={styles.simpleDiscountBadge}>
            <Txt maxFontSizeMultiplier={1.1} style={styles.simpleDiscountText}>
              {discountPercent}% OFF
            </Txt>
          </View>
        )}

        {/* Image */}
        <View style={styles.simpleImageContainer}>
          <Image
            source={
              product.image_url
                ? { uri: product.image_url }
                : require('../../../../../assets/productimages/d1_nobg.webp')
            }
            style={styles.simpleImage}
          />
        </View>

        {/* Info */}
        <View style={styles.simpleInfo}>
          <Txt maxFontSizeMultiplier={1.2} style={styles.simpleName} numberOfLines={2}>
            {displayName}
          </Txt>
          {hasSizePicker ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.sizeRow, styles.sizeRowCompact]}
            >
              {packs.map((pack, i) => {
                const active = i === safeIdx;
                return (
                  <AnimatedPress
                    key={pack.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${pack.unit_label}, ₹${pack.price}`}
                    accessibilityState={{ selected: active }}
                    style={[styles.sizeChip, styles.sizeChipCompact, active && styles.sizeChipActive]}
                    onPress={() => setSelectedIdx(i)}
                  >
                    <Txt
                      maxFontSizeMultiplier={1.1}
                      style={[styles.sizeChipText, styles.sizeChipTextCompact, active && styles.sizeChipTextActive]}
                    >
                      {pack.unit_label}
                    </Txt>
                  </AnimatedPress>
                );
              })}
            </ScrollView>
          ) : (
            <Txt maxFontSizeMultiplier={1.2} style={styles.simpleUnit}>
              {selectedOption.unit}
            </Txt>
          )}
        </View>

        {/* Bottom Section (Price + Add) locked to the bottom */}
        <View style={styles.simpleBottomSection}>
          <View style={styles.simplePriceRow}>
            <Txt maxFontSizeMultiplier={1.2} style={styles.simplePrice}>₹{price}</Txt>
            {originalPrice && (
              <Txt maxFontSizeMultiplier={1.2} style={styles.simpleStrike}>₹{originalPrice}</Txt>
            )}
          </View>

        {/* Add / qty control */}
        <AnimatedPress
          accessibilityRole="button"
          style={quantity > 0 ? [styles.simpleAddBtn, { backgroundColor: GroceryColors.lightGreen }] : styles.simpleAddBtn}
          onPress={quantity > 0 ? undefined : handleAdd}
        >
          <Txt maxFontSizeMultiplier={1.1} style={quantity > 0 ? [styles.simpleAddText, { color: GroceryColors.primary }] : styles.simpleAddText}>
            {quantity > 0 ? 'Added' : 'Add'}
          </Txt>
        </AnimatedPress>
        </View>
      </AnimatedPress>
    );
  }

  // ── Full "deal" layout — Reference UI ───────────────────────────────
  return (
    <AnimatedPress
      style={[styles.card, { width: cardWidth }, style]}
      scale={0.97}
      onPress={() => onPress?.(product)}
    >
      {/* Product Image Section */}
      <View style={styles.imageContainer}>
        <Image
          source={
            product.image_url
              ? { uri: product.image_url }
              : require('../../../../../assets/productimages/d1_nobg.webp')
          }
          style={styles.image}
        />
        
        {/* Top Left Badge */}
        {discountPercent > 0 ? (
          <View style={[styles.imageBadge, { backgroundColor: GroceryColors.discountRed }]}>
            <Txt maxFontSizeMultiplier={1.1} style={styles.imageBadgeText}>BESTSELLER</Txt>
          </View>
        ) : (
          <View style={[styles.imageBadge, { backgroundColor: GroceryColors.primary }]}>
            <Txt maxFontSizeMultiplier={1.1} style={styles.imageBadgeText}>FRESH</Txt>
          </View>
        )}

        {/* Top Right Wishlist */}
        <AnimatedPress
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          style={styles.wishlistBtn}
          onPress={() => toggleItem(product)}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={18}
            color={isWishlisted ? GroceryColors.discountRed : GroceryColors.white}
          />
        </AnimatedPress>

        {/* Bottom Left Veg Icon */}
        <View style={styles.vegIconWrap}>
          <View style={styles.vegIconInner} />
        </View>

        {/* Floating Add/Qty Button (Overlaps image bottom edge) */}
        <View style={styles.floatingActionBtn}>
          {quantity > 0 ? (
            <AnimatedPress
              accessibilityRole="button"
              style={[styles.floatingAddBtn, { backgroundColor: GroceryColors.lightGreen }]}
              onPress={undefined}
            >
              <Ionicons name="checkmark" size={20} color={GroceryColors.primary} />
            </AnimatedPress>
          ) : (
            <AnimatedPress
              accessibilityRole="button"
              style={styles.floatingAddBtn}
              onPress={handleAdd}
            >
              <Ionicons name="add" size={20} color={GroceryColors.primary} />
            </AnimatedPress>
          )}
        </View>
      </View>

      {/* Product Details Section */}
      <View style={styles.details}>
        {/* Size Pill */}
        {hasSizePicker ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sizeRow}
          >
            {packs.map((pack, i) => {
              const active = i === safeIdx;
              return (
                <AnimatedPress
                  key={pack.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.sizePill, active && styles.sizePillActive]}
                  onPress={() => setSelectedIdx(i)}
                >
                  <Txt
                    maxFontSizeMultiplier={1.1}
                    style={[styles.sizePillText, active && styles.sizePillTextActive]}
                  >
                    {pack.unit_label}
                  </Txt>
                </AnimatedPress>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.sizePill}>
            <Txt maxFontSizeMultiplier={1.1} style={styles.sizePillText}>
              {selectedOption.unit}
            </Txt>
          </View>
        )}

        {/* Price */}
        <View style={styles.priceRow}>
          <Txt maxFontSizeMultiplier={1.2} style={styles.price}>₹{price}</Txt>
          {originalPrice && (
            <Txt maxFontSizeMultiplier={1.2} style={styles.strikePrice}>₹{originalPrice}</Txt>
          )}
        </View>

        {/* Unit Price */}
        <Txt maxFontSizeMultiplier={1.1} style={styles.unitPriceText}>
          ₹{price}/{selectedOption.unit}
        </Txt>

        {/* Discount */}
        {discountPercent > 0 && (
          <Txt maxFontSizeMultiplier={1.1} style={styles.discountTextGreen}>
            {discountPercent}% OFF
          </Txt>
        )}

        {/* Name */}
        <Txt maxFontSizeMultiplier={1.2} style={styles.name} numberOfLines={2}>
          {displayName}
        </Txt>

        {/* Rating & Delivery */}
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={10} color="#00845B" />
          <Txt maxFontSizeMultiplier={1.1} style={styles.ratingText}>
            4.4  <Txt style={{ color: GroceryColors.textMuted }}>1.8k | 18 MINS</Txt>
          </Txt>
        </View>
      </View>
    </AnimatedPress>
  );
};

const styles = StyleSheet.create({
  // ── Deal Card (Reference UI) ──
  card: {
    backgroundColor: 'transparent',
    marginRight: 10,
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: Radii.card,
  },
  imageBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 15,
  },
  imageBadgeText: {
    color: GroceryColors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: Radii.control,
    padding: 4,
  },
  vegIconWrap: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: '#00845B',
    backgroundColor: GroceryColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.mark,
  },
  vegIconInner: {
    width: 6,
    height: 6,
    borderRadius: Radii.pill,
    backgroundColor: '#00845B',
  },
  floatingActionBtn: {
    position: 'absolute',
    bottom: -16,
    right: 8,
    zIndex: 10,
  },
  floatingAddBtn: {
    backgroundColor: GroceryColors.white,
    borderWidth: 1,
    borderColor: GroceryColors.primary,
    borderRadius: Radii.control,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GroceryColors.white,
    borderWidth: 1,
    borderColor: GroceryColors.primary,
    borderRadius: Radii.control,
    height: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingQtyBtn: {
    width: 28,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingQtyText: {
    color: GroceryColors.primary,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 14,
    textAlign: 'center',
  },
  details: {
    padding: 8,
    paddingTop: 8,
  },
  sizePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.badge,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  sizePillActive: {
    backgroundColor: GroceryColors.primary,
  },
  sizePillText: {
    fontSize: 10,
    color: GroceryColors.primary,
    fontWeight: '600',
  },
  sizePillTextActive: {
    color: GroceryColors.white,
  },
  // Wraps: four chips do not fit one line of a half-width grid card at every font scale.
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
    marginBottom: 1 },
  sizeChip: {
    minWidth: 42,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radii.badge,
    borderWidth: 1,
    borderColor: GroceryColors.border,
    backgroundColor: GroceryColors.white,
    alignItems: 'center',
    justifyContent: 'center' },
  sizeChipActive: {
    backgroundColor: GroceryColors.primary,
    borderColor: GroceryColors.primary },
  sizeChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: GroceryColors.textSecondary },
  sizeChipTextActive: {
    color: GroceryColors.white },
  // The rail card is ~140px wide, so its chips have to give up the 42px floor the grid's keep.
  sizeRowCompact: { gap: 4, marginTop: 4 },
  sizeChipCompact: { minWidth: 0, paddingHorizontal: 5, paddingVertical: 3 },
  sizeChipTextCompact: { fontSize: 9.5 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  strikePrice: {
    fontSize: 11,
    color: GroceryColors.textMuted,
    textDecorationLine: 'line-through',
  },
  unitPriceText: {
    fontSize: 10,
    color: GroceryColors.textMuted,
    marginTop: 2,
  },
  discountTextGreen: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00845B',
    marginTop: 4,
    marginBottom: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 10,
    color: '#00845B',
    fontWeight: '700',
  },

  // ── Simple Card (horizontal rails) ──
  simpleCard: {
    backgroundColor: GroceryColors.white,
    borderRadius: Radii.card,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F2F2F2',
    marginRight: 10,
    position: 'relative',
    height: 255, // Fixed height so all cards are perfectly uniform
    flexDirection: 'column',
  },
  simpleDiscountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: GroceryColors.discountRed,
    borderRadius: Radii.badge,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 2,
  },
  simpleDiscountText: {
    fontSize: 8,
    fontWeight: '700',
    color: GroceryColors.white,
  },
  simpleImageContainer: {
    width: '100%',
    height: 80, // Taller
    backgroundColor: 'transparent',
    borderRadius: Radii.control,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  simpleImage: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  simpleInfo: {
    marginBottom: 0,
  },
  simpleBottomSection: {
    marginTop: 'auto',
  },
  simpleName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 18,
    minHeight: 36, // Ensure 2 lines are always reserved
  },
  simpleUnit: {
    fontSize: 10,
    color: GroceryColors.textSecondary,
    marginTop: 2,
  },
  simplePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  simplePrice: {
    fontSize: 13,
    fontWeight: '700',
    color: GroceryColors.primary,
  },
  simpleStrike: {
    fontSize: 10,
    color: GroceryColors.textMuted,
    textDecorationLine: 'line-through',
  },
  simpleAddBtn: {
    backgroundColor: '#00845B',
    borderRadius: Radii.pill,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simpleAddText: {
    color: GroceryColors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  simpleQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#00845B',
    borderRadius: Radii.pill,
    height: 32,
    paddingHorizontal: 4,
  },
  simpleQtyBtn: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simpleQtyText: {
    color: GroceryColors.white,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
});

export const ProductCard = React.memo(ProductCardBase);
