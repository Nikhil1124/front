import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, StyleProp, StyleSheet, TouchableOpacity, useWindowDimensions, View, ViewStyle } from 'react-native';
import { SupplyItem } from '@/types';
import { useCartStore } from '../../store/useCartStore';
import { useShoppingModeStore } from '../../store/useShoppingModeStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { Radii, Palette, Colors } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';


interface ProductCardProps {
  product: SupplyItem;
  onPress?: (product: SupplyItem) => void;
  layout?: 'deal' | 'simple';
  style?: StyleProp<ViewStyle>;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  layout = 'deal',
  style
}) => {
  const { width } = useWindowDimensions();
  const cardWidth = width > 600 ? 165 : width * 0.43;

  const mode = useShoppingModeStore((s) => s.mode);
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const isWishlisted = useWishlistStore((s) => s.isWishlisted(product.id));
  const toggleItem = useWishlistStore((s) => s.toggleItem);

  const options = [{ price: product.price, unit: product.unit_label, originalPrice: product.mrp ?? undefined }];

  const [selectedIdx, setSelectedIdx] = useState(0);

  // Reset selected option index when mode switches
  useEffect(() => {
    if (selectedIdx !== 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIdx(0);
    }
  }, [mode, selectedIdx]);

  if (!options || options.length === 0) {
    return null; // Not visible/available in this mode
  }

  const selectedOption = options[selectedIdx] || options[0];
  const compoundId = `${product.id}-${selectedOption.unit}`;
  const cartItem = cartItems.find((item) => item.id === compoundId);
  const quantity = cartItem ? cartItem.quantity : 0;

  // Calculations
  const price = selectedOption.price;
  const originalPrice = selectedOption.originalPrice;
  const discountPercent = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  const handleAdd = () => {
    addItem(product, selectedOption, 1);
  };

  const handleIncrease = () => {
    updateQuantity(compoundId, quantity + 1);
  };

  const handleDecrease = () => {
    updateQuantity(compoundId, quantity - 1);
  };

  // Compact layout for dense horizontal rails (e.g. Daily Essentials) — the `simple*`
  // styles below used to be dead code: this component always rendered the full "deal"
  // layout regardless of what `layout` was passed, so every caller asking for `simple`
  // got an oversized card anyway.
  if (layout === 'simple') {
    return (
      <AnimatedPress
        style={[styles.simpleCard, { width: cardWidth }, style]}
        scale={0.96}
        onPress={() => onPress?.(product)}
      >
        <View style={styles.simpleImageContainer}>
          <Image
            source={product.image_url ? { uri: product.image_url } : require('../../../../../assets/img_app_icon.jpg')}
            style={styles.simpleImage}
          />
        </View>
        <View style={styles.simpleDetails}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.simpleName} numberOfLines={1}>{product.name}</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.simpleUnit}>{selectedOption.unit}</Txt>
          <View style={styles.simpleBottomRow}>
            <View>
              <Txt maxFontSizeMultiplier={1.3} style={styles.simplePrice}>₹{price}</Txt>
              {originalPrice && <Txt maxFontSizeMultiplier={1.3} style={styles.simpleStrikePrice}>₹{originalPrice}</Txt>}
            </View>
            {quantity > 0 ? (
              <View style={styles.simpleQuantityControl}>
                <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Decrease quantity" accessibilityRole="button" style={styles.simpleQtyBtn} onPress={handleDecrease}>
                  <Ionicons name="remove" size={12} color={Colors.textInverse} />
                </AnimatedPress>
                <Txt maxFontSizeMultiplier={1.3} style={styles.simpleQtyText}>{quantity}</Txt>
                <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Increase quantity" accessibilityRole="button" style={styles.simpleQtyBtn} onPress={handleIncrease}>
                  <Ionicons name="add" size={12} color={Colors.textInverse} />
                </AnimatedPress>
              </View>
            ) : (
              <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Increase quantity" accessibilityRole="button" style={styles.simpleAddButton} onPress={handleAdd}>
                <Ionicons name="add" size={16} color={Colors.textInverse} />
              </AnimatedPress>
            )}
          </View>
        </View>
      </AnimatedPress>
    );
  }

  // Full Layout (Premium Redesign Layout)
  return (
    <AnimatedPress
      style={[styles.card, { width: cardWidth }, style]}
      scale={0.96}
      onPress={() => onPress?.(product)}
    >
      {/* Top row containing Discount and Wishlist heart */}
      <View style={styles.topRow}>
        {discountPercent > 0 ? (
          <View style={styles.discountBadge}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.discountBadgeText}>-{discountPercent}%</Txt>
          </View>
        ) : (
          <View />
        )}

        <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"
          style={styles.wishlistBtn}
          onPress={() => toggleItem(product)}

        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={18}
            color={isWishlisted ? Colors.danger : Colors.textMuted}
          />
        </AnimatedPress>
      </View>

      {/* Image Container */}
      <View style={styles.imageContainer}>
        <Image
          source={product.image_url ? { uri: product.image_url } : require('../../../../../assets/img_app_icon.jpg')}
          style={styles.image}
        />
        {quantity > 0 && (
          <View style={styles.checkmarkBadge}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.detailsContainer}>
        <Txt maxFontSizeMultiplier={1.3} style={styles.name} numberOfLines={1}>
          {product.name}
        </Txt>

        {/* Selected Unit/Option text */}
        <Txt maxFontSizeMultiplier={1.3} style={styles.unitText}>{selectedOption.unit}</Txt>

        {/* Price Row — no star rating here: SupplyItem carries no rating field, and there
            is no per-product review system anywhere in this app. A fixed "4.8" on every
            item was fabricated social proof, not a real number. */}
        <View style={styles.ratingPriceRow}>
          <View style={styles.priceContainer}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.price}>₹{price}</Txt>
            {originalPrice && (
              <Txt maxFontSizeMultiplier={1.3} style={styles.strikePrice}>₹{originalPrice}</Txt>
            )}
          </View>
        </View>

        {/* Option selection tabs if multiple exist */}
        {options.length > 1 && (
          <View style={styles.optionsWrapper}>
            {options.map((opt, i) => (
              <AnimatedPress accessibilityRole="button"
                key={opt.unit}
                style={[
                  styles.optionTab,
                  selectedIdx === i && styles.selectedOptionTab,
                ]}
                onPress={() => setSelectedIdx(i)}
              >
                <Txt maxFontSizeMultiplier={1.3}
                  style={[
                    styles.optionText,
                    selectedIdx === i && styles.selectedOptionText,
                  ]}
                >
                  {opt.unit}
                </Txt>
              </AnimatedPress>
            ))}
          </View>
        )}

        {/* Action Controls */}
        <View style={styles.actionContainer}>
          {quantity > 0 ? (
            <View style={styles.qtyControl}>
              <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Decrease quantity" accessibilityRole="button" style={styles.qtyBtn} onPress={handleDecrease}>
                <Ionicons name="remove" size={16} color={Colors.textInverse} />
              </AnimatedPress>
              <Txt maxFontSizeMultiplier={1.3} style={styles.qtyText}>{quantity}</Txt>
              <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Increase quantity" accessibilityRole="button" style={styles.qtyBtn} onPress={handleIncrease}>
                <Ionicons name="add" size={16} color={Colors.textInverse} />
              </AnimatedPress>
            </View>
          ) : (
            <AnimatedPress accessibilityRole="button" style={styles.addBtn} onPress={handleAdd}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.addBtnText}>Add to Cart</Txt>
            </AnimatedPress>
          )}
        </View>
      </View>
    </AnimatedPress>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radii.card,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginRight: 10,
    marginBottom: 8,
    position: 'relative',
    height: 300,
    justifyContent: 'space-between',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  discountBadge: {
    backgroundColor: Palette.TintRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.badge,
  },
  discountBadgeText: {
    color: Colors.danger,
    fontSize: 9,
  },
  wishlistBtn: {
    padding: 2,
  },
  imageContainer: {
    height: 100,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    position: 'relative',
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  image: {
    width: '85%',
    height: '85%',
    resizeMode: 'contain',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  unitText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  ratingPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  strikePrice: {
    fontSize: 11,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  optionsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 4,
  },
  optionTab: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.badge,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  selectedOptionTab: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  optionText: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  selectedOptionText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  actionContainer: {
    marginTop: 6,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.control,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: Radii.control,
    height: 34,
    paddingHorizontal: 8,
  },
  qtyBtn: {
    padding: 4,
  },
  qtyText: {
    color: Colors.textInverse,
    fontSize: 13,
  },

  // ── Simple Layout Styles ──
  simpleCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radii.card,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginRight: 8,
    marginBottom: 6,
    height: 175,
    justifyContent: 'space-between',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  simpleImageContainer: {
    width: '100%',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simpleImage: {
    width: '85%',
    height: '85%',
    resizeMode: 'contain',
  },
  simpleDetails: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  simpleName: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  simpleUnit: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  simpleBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  simplePrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  simpleStrikePrice: {
    fontSize: 9,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  simpleAddButton: {
    width: 26,
    height: 26,
    borderRadius: Radii.control,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simpleQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radii.control,
    height: 26,
    paddingHorizontal: 4,
    gap: 4,
  },
  simpleQtyBtn: {
    padding: 2,
  },
  simpleQtyText: {
    color: Colors.textInverse,
    fontSize: 11,
    minWidth: 12,
    textAlign: 'center',
  },
});
