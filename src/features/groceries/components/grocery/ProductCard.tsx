import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SupplyItem } from '@/types';
import { useCartStore } from '../../store/useCartStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';
import { baseProductName } from '../../variantGroups';

interface ProductCardProps {
  product: SupplyItem;
  onPress?: (product: SupplyItem) => void;
  layout?: 'deal' | 'simple';
  style?: StyleProp<ViewStyle>;
  customQuantity?: number;
  onCustomAdd?: () => void;
  onCustomIncrease?: () => void;
  onCustomDecrease?: () => void;
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
  onCustomIncrease,
  onCustomDecrease,
  hideWishlist,
  variants,
}) => {
  const { width } = useWindowDimensions();
  // Deal card: 2-column grid. Simple card: horizontal rail.
  const cardWidth = layout === 'deal'
    ? (width - 44) / 2
    : width > 600 ? 140 : Math.min(width * 0.36, 150);

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
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
  const handleIncrease = onCustomIncrease || (() => updateQuantity(compoundId, quantity + 1));
  const handleDecrease = onCustomDecrease || (() => updateQuantity(compoundId, quantity - 1));

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
          <Txt maxFontSizeMultiplier={1.2} style={styles.simpleUnit}>
            {selectedOption.unit}
          </Txt>
          <View style={styles.simplePriceRow}>
            <Txt maxFontSizeMultiplier={1.2} style={styles.simplePrice}>₹{price}</Txt>
            {originalPrice && (
              <Txt maxFontSizeMultiplier={1.2} style={styles.simpleStrike}>₹{originalPrice}</Txt>
            )}
          </View>
        </View>

        {/* Add / qty control */}
        {quantity > 0 ? (
          <View style={styles.simpleQtyControl}>
            <AnimatedPress
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              style={styles.simpleQtyBtn}
              onPress={handleDecrease}
            >
              <Ionicons name="remove" size={12} color={GroceryColors.white} />
            </AnimatedPress>
            <Txt maxFontSizeMultiplier={1.1} style={styles.simpleQtyText}>{quantity}</Txt>
            <AnimatedPress
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              style={styles.simpleQtyBtn}
              onPress={handleIncrease}
            >
              <Ionicons name="add" size={12} color={GroceryColors.white} />
            </AnimatedPress>
          </View>
        ) : (
          <AnimatedPress
            accessibilityRole="button"
            style={styles.simpleAddBtn}
            onPress={handleAdd}
          >
            <Txt maxFontSizeMultiplier={1.1} style={styles.simpleAddText}>Add</Txt>
          </AnimatedPress>
        )}
      </AnimatedPress>
    );
  }

  // ── Full "deal" layout — 2-column grid card ───────────────────────────────
  return (
    <AnimatedPress
      style={[styles.card, { width: cardWidth }, style]}
      scale={0.97}
      onPress={() => onPress?.(product)}
    >
      {/* Top row: discount badge + wishlist */}
      <View style={styles.topRow}>
        {discountPercent > 0 ? (
          <View style={styles.discountBadge}>
            <Txt maxFontSizeMultiplier={1.1} style={styles.discountText}>
              {discountPercent}% OFF
            </Txt>
          </View>
        ) : (
          <View style={styles.newBadgePlaceholder} />
        )}

        <AnimatedPress
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          style={styles.wishlistBtn}
          onPress={() => toggleItem(product)}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={18}
            color={isWishlisted ? GroceryColors.discountRed : GroceryColors.textMuted}
          />
        </AnimatedPress>
      </View>

      {/* Product image */}
      <View style={styles.imageContainer}>
        <Image
          source={
            product.image_url
              ? { uri: product.image_url }
              : require('../../../../../assets/productimages/d1_nobg.webp')
          }
          style={styles.image}
        />
      </View>

      {/* Product details */}
      <View style={styles.details}>
        <Txt maxFontSizeMultiplier={1.2} style={styles.name} numberOfLines={2}>
          {displayName}
        </Txt>
        {hasSizePicker ? (
          <View style={styles.sizeRow}>
            {packs.map((pack, i) => {
              const active = i === safeIdx;
              return (
                <AnimatedPress
                  key={pack.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${pack.unit_label}, ₹${pack.price}`}
                  accessibilityState={{ selected: active }}
                  style={[styles.sizeChip, active && styles.sizeChipActive]}
                  onPress={() => setSelectedIdx(i)}
                >
                  <Txt
                    maxFontSizeMultiplier={1.1}
                    style={[styles.sizeChipText, active && styles.sizeChipTextActive]}
                  >
                    {pack.unit_label}
                  </Txt>
                </AnimatedPress>
              );
            })}
          </View>
        ) : (
          <Txt maxFontSizeMultiplier={1.2} style={styles.unit}>
            {selectedOption.unit}
          </Txt>
        )}

        <View style={styles.priceRow}>
          <Txt maxFontSizeMultiplier={1.2} style={styles.price}>₹{price}</Txt>
          {originalPrice && (
            <Txt maxFontSizeMultiplier={1.2} style={styles.strikePrice}>
              ₹{originalPrice}
            </Txt>
          )}
        </View>
      </View>

      {/* Add / quantity control */}
      {quantity > 0 ? (
        <View style={styles.qtyControl}>
          <AnimatedPress
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Decrease quantity"
            accessibilityRole="button"
            style={styles.qtyBtn}
            onPress={handleDecrease}
          >
            <Ionicons name="remove" size={15} color={GroceryColors.white} />
          </AnimatedPress>
          <Txt maxFontSizeMultiplier={1.1} style={styles.qtyText}>{quantity}</Txt>
          <AnimatedPress
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Increase quantity"
            accessibilityRole="button"
            style={styles.qtyBtn}
            onPress={handleIncrease}
          >
            <Ionicons name="add" size={15} color={GroceryColors.white} />
          </AnimatedPress>
        </View>
      ) : (
        <AnimatedPress
          accessibilityRole="button"
          style={styles.addBtn}
          onPress={handleAdd}
        >
          <Ionicons name="cart-outline" size={14} color={GroceryColors.white} style={{ marginRight: 4 }} />
          <Txt maxFontSizeMultiplier={1.1} style={styles.addBtnText}>Add</Txt>
        </AnimatedPress>
      )}
    </AnimatedPress>
  );
};

const styles = StyleSheet.create({
  // ── Deal Card ──
  card: {
    backgroundColor: GroceryColors.white,
    borderRadius: Radii.control,
    padding: 8,
    borderWidth: 1,
    borderColor: GroceryColors.border,
    marginRight: 10,
    marginBottom: 10,
    shadowColor: GroceryColors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    minHeight: 22,
  },
  discountBadge: {
    backgroundColor: GroceryColors.discountRed,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.badge,
  },
  discountText: {
    color: GroceryColors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  newBadgePlaceholder: {
    width: 10,
  },
  wishlistBtn: {
    padding: 2,
  },
  imageContainer: {
    height: 85,
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: Radii.badge,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  image: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
  },
  details: {
    flex: 1,
    marginBottom: 6,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: GroceryColors.textPrimary,
    lineHeight: 16,
    minHeight: 32,
  },
  unit: {
    fontSize: 10,
    color: GroceryColors.textSecondary,
    marginTop: 2,
    marginBottom: 2,
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: GroceryColors.primary,
  },
  strikePrice: {
    fontSize: 11,
    color: GroceryColors.textMuted,
    textDecorationLine: 'line-through',
  },
  addBtn: {
    backgroundColor: GroceryColors.primary,
    borderRadius: Radii.control,
    height: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: GroceryColors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GroceryColors.primary,
    borderRadius: Radii.control,
    height: 36,
    paddingHorizontal: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    color: GroceryColors.white,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },

  // ── Simple Card (horizontal rails) ──
  simpleCard: {
    backgroundColor: GroceryColors.white,
    borderRadius: Radii.card,
    padding: 10,
    borderWidth: 1,
    borderColor: GroceryColors.border,
    marginRight: 8,
    shadowColor: GroceryColors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    position: 'relative',
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
    height: 70,
    backgroundColor: 'transparent',
    borderRadius: Radii.control,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  simpleImage: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  simpleInfo: {
    flex: 1,
    marginBottom: 8,
  },
  simpleName: {
    fontSize: 12,
    fontWeight: '600',
    color: GroceryColors.textPrimary,
    lineHeight: 16,
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
    backgroundColor: GroceryColors.primary,
    borderRadius: Radii.badge,
    height: 30,
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
    backgroundColor: GroceryColors.primary,
    borderRadius: Radii.badge,
    height: 30,
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
