import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { AnimatedPress, Txt } from '@/components/ui';

import { Ionicons } from '@expo/vector-icons';
import { SupplyItem } from '@/types';
import { useShoppingModeStore } from '../../store/useShoppingModeStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { useCartStore } from '../../store/useCartStore';
import { Radii, Colors } from '@/theme';
import { PriceDisplay } from './PriceDisplay';

export interface MiniProductCardProps {
  product: SupplyItem;
  onPress: () => void;
  /** Show wishlist heart button. Default: false */
  showWishlist?: boolean;
}

/**
 * Compact horizontal product card used in:
 * - Cart screen "You May Also Need" carousel (replaces RecommendationCard)
 * - Product Detail "You May Also Need" carousel (replaces RelatedProductCard)
 * - Checkout recommendations
 */
export const MiniProductCard: React.FC<MiniProductCardProps> = ({
  product,
  onPress,
  showWishlist = false }) => {
  const mode = useShoppingModeStore((s) => s.mode);
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
          <Txt maxFontSizeMultiplier={1.3} style={styles.discountText}>-{discountPercent}%</Txt>
        </View>
      )}

      {/* Wishlist button */}
      {showWishlist && (
        <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"
          style={styles.wishlistBtn}
          onPress={() => toggleItem(product)}

        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={13}
            color={isWishlisted ? Colors.danger : Colors.textMuted}
          />
        </AnimatedPress>
      )}

      {/* Product image */}
      <AnimatedPress accessibilityRole="button" onPress={onPress} style={styles.imageContainer}>
        <Image
          source={product.image_url ? { uri: product.image_url } : require('../../../../../assets/img_app_icon.jpg')}
          style={styles.image}
          resizeMode="contain"
        />
      </AnimatedPress>

      {/* Name & unit */}
      <Txt maxFontSizeMultiplier={1.3} style={styles.name} numberOfLines={2}>{product.name}</Txt>
      <Txt maxFontSizeMultiplier={1.3} style={styles.unit}>{opt.unit}</Txt>

      {/* No star rating: SupplyItem carries no rating field and there is no per-product
          review system in this app. A fixed "4.8" on every card was fabricated, not real. */}

      {/* Price */}
      <PriceDisplay price={opt.price} originalPrice={opt.originalPrice} size="sm" />

      {/* Add button */}
      <AnimatedPress accessibilityRole="button"
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
    width: 128,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radii.card,
    padding: 10,
    marginRight: 8,
    position: 'relative' },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.danger,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: Radii.badge,
    zIndex: 2 },
  discountText: {
    color: Colors.surface,
    fontSize: 8 },
  wishlistBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    padding: 3 },
  imageContainer: {
    height: 72,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4 },
  image: {
    width: '80%',
    height: '80%' },
  name: {
    fontSize: 11,
    color: Colors.textPrimary,
    marginTop: 4,
    lineHeight: 14 },
  unit: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginBottom: 4 },
  addBtn: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radii.badge,
    paddingVertical: 5,
    alignItems: 'center' },
  addedBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.borderSubtle },
  addBtnText: {
    color: Colors.primary,
    fontSize: 11 },
  addedBtnText: {
    color: Colors.primaryDark } });
