import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SupplyItem } from '@/types';
import { useWishlistStore } from '../../store/useWishlistStore';
import { useCartStore } from '../../store/useCartStore';
import { GroceryColors, Radii } from '@/theme';
import { PriceDisplay } from './PriceDisplay';
import { AnimatedPress, Txt } from '@/components/ui';

export interface MiniProductCardProps {
  product: SupplyItem;
  onPress: () => void;
  /** Show wishlist heart button. Default: false */
  showWishlist?: boolean;
}

/**
 * Compact horizontal product card used in:
 * - Cart screen "You May Also Need" carousel
 * - Product Detail "You May Also Need" carousel
 * - Checkout recommendations
 */
export const MiniProductCard: React.FC<MiniProductCardProps> = ({
  product,
  onPress,
  showWishlist = false,
}) => {
  const options = [{ price: product.price, unit: product.unit_label, originalPrice: product.mrp ?? undefined }];

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const isWishlisted = useWishlistStore((s) => s.isWishlisted(product.id));
  const toggleItem = useWishlistStore((s) => s.toggleItem);

  if (!options || options.length === 0) return null;

  const opt = options[0];
  const discountPercent = opt.originalPrice
    ? Math.round(((opt.originalPrice - opt.price) / opt.originalPrice) * 100)
    : 0;

  const compoundId = `${product.id}-${opt.unit}`;
  const cartItem = cartItems.find((i) => i.id === compoundId);
  const inCart = (cartItem?.quantity ?? 0) > 0;

  const handleAdd = () => {
    if (cartItem) {
      updateQuantity(compoundId, cartItem.quantity + 1);
    } else {
      addItem(product, opt, 1);
    }
  };

  return (
    <View style={styles.card}>
      {/* Discount badge */}
      {discountPercent > 0 && (
        <View style={styles.discountBadge}>
          <Txt maxFontSizeMultiplier={1.2} style={styles.discountText}>{discountPercent}% OFF</Txt>
        </View>
      )}

      {/* Wishlist button */}
      {showWishlist && (
        <AnimatedPress
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          style={styles.wishlistBtn}
          onPress={() => toggleItem(product)}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={13}
            color={isWishlisted ? GroceryColors.discountRed : GroceryColors.textMuted}
          />
        </AnimatedPress>
      )}

      {/* Product image */}
      <AnimatedPress accessibilityRole="button" onPress={onPress} style={styles.imageContainer}>
        <Image
          source={
            product.image_url
              ? { uri: product.image_url }
              : require('../../../../../assets/productimages/d1_nobg.webp')
          }
          style={styles.image}
          resizeMode="contain"
        />
      </AnimatedPress>

      {/* Name & unit */}
      <Txt maxFontSizeMultiplier={1.3} style={styles.name} numberOfLines={2}>{product.name}</Txt>
      <Txt maxFontSizeMultiplier={1.3} style={styles.unit}>{opt.unit}</Txt>

      {/* Price */}
      <PriceDisplay price={opt.price} originalPrice={opt.originalPrice} size="sm" />

      {/* Add button */}
      <AnimatedPress
        accessibilityRole="button"
        style={[styles.addBtn, inCart && styles.addedBtn]}
        onPress={handleAdd}
      >
        <Txt maxFontSizeMultiplier={1.3} style={[styles.addBtnText, inCart && styles.addedBtnText]}>
          {inCart ? '✓ Added' : '+ Add'}
        </Txt>
      </AnimatedPress>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 142,
    backgroundColor: GroceryColors.white,
    borderWidth: 1,
    borderColor: GroceryColors.border,
    borderRadius: Radii.card,
    padding: 10,
    marginRight: 8,
    position: 'relative',
    shadowColor: GroceryColors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: GroceryColors.discountRed,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radii.badge,
    zIndex: 2,
  },
  discountText: { color: GroceryColors.white, fontSize: 8, fontWeight: '700' },
  wishlistBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    padding: 3,
  },
  imageContainer: {
    height: 72,
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: Radii.control,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  image: { width: '80%', height: '80%' },
  name: {
    fontSize: 11,
    fontWeight: '600',
    color: GroceryColors.textPrimary,
    lineHeight: 14,
    minHeight: 28,
  },
  unit: {
    fontSize: 9,
    color: GroceryColors.textSecondary,
    marginBottom: 4,
  },
  addBtn: {
    marginTop: 8,
    backgroundColor: GroceryColors.white,
    borderWidth: 1.5,
    borderColor: GroceryColors.primary,
    borderRadius: Radii.badge,
    paddingVertical: 5,
    alignItems: 'center',
  },
  addedBtn: {
    backgroundColor: GroceryColors.lightGreen,
    borderColor: GroceryColors.primary,
  },
  addBtnText: { color: GroceryColors.primary, fontSize: 11, fontWeight: '700' },
  addedBtnText: { color: GroceryColors.primary },
});
