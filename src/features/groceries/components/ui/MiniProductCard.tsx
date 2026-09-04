import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupplyItem } from '@/types';
import { useShoppingModeStore } from '../../store/useShoppingModeStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { useCartStore } from '../../store/useCartStore';
import { Colors } from '@/theme';
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
  showWishlist = false,
}) => {
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
          <Text maxFontSizeMultiplier={1.3} style={styles.discountText}>-{discountPercent}%</Text>
        </View>
      )}

      {/* Wishlist button */}
      {showWishlist && (
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"
          style={styles.wishlistBtn}
          onPress={() => toggleItem(product)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={13}
            color={isWishlisted ? Colors.danger : Colors.textMuted}
          />
        </TouchableOpacity>
      )}

      {/* Product image */}
      <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.9} style={styles.imageContainer}>
        <Image
          source={product.image_url ? { uri: product.image_url } : require('../../../../../assets/img_app_icon.jpg')}
          style={styles.image}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Name & unit */}
      <Text maxFontSizeMultiplier={1.3} style={styles.name} numberOfLines={2}>{product.name}</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.unit}>{opt.unit}</Text>

      {/* No star rating: SupplyItem carries no rating field and there is no per-product
          review system in this app. A fixed "4.8" on every card was fabricated, not real. */}

      {/* Price */}
      <PriceDisplay price={opt.price} originalPrice={opt.originalPrice} size="sm" />

      {/* Add button */}
      <TouchableOpacity accessibilityRole="button"
        style={[styles.addBtn, inCart && styles.addedBtn]}
        onPress={handleAdd}
        activeOpacity={0.8}
      >
        <Text maxFontSizeMultiplier={1.3} style={[styles.addBtnText, inCart && styles.addedBtnText]}>
          {inCart ? '✓ Added' : '+ Add'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 128,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 14,
    padding: 10,
    marginRight: 8,
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.danger,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  discountText: {
    color: Colors.surface,
    fontSize: 8,
  },
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
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  image: {
    width: '80%',
    height: '80%',
  },
  name: {
    fontSize: 11,
    color: Colors.textPrimary,
    marginTop: 4,
    lineHeight: 14,
  },
  unit: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  addBtn: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 6,
    paddingVertical: 5,
    alignItems: 'center',
  },
  addedBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: '#DCFCE7',
  },
  addBtnText: {
    color: Colors.primary,
    fontSize: 11,
  },
  addedBtnText: {
    color: Colors.primaryDark,
  },
});
