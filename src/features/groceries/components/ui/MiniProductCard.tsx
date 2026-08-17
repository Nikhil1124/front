import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnrichedProduct } from '../../data/mockProducts';
import { useShoppingModeStore } from '../../store/useShoppingModeStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { useCartStore } from '../../store/useCartStore';
import { Colors } from '@/theme';
import { PriceDisplay } from './PriceDisplay';

export interface MiniProductCardProps {
  product: EnrichedProduct;
  onPress: () => void;
  /** Show wishlist heart button. Default: false */
  showWishlist?: boolean;
  /** Show star rating. Default: false */
  showRating?: boolean;
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
  showRating = false,
}) => {
  const mode = useShoppingModeStore((s) => s.mode);
  const options = mode === 'owner' ? product.ownerOptions : product.guestOptions;

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
          <Text style={styles.discountText}>-{discountPercent}%</Text>
        </View>
      )}

      {/* Wishlist button */}
      {showWishlist && (
        <TouchableOpacity
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
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.imageContainer}>
        <Image
          source={typeof product.image === 'string' ? { uri: product.image } : product.image}
          style={styles.image}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Name & unit */}
      <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
      <Text style={styles.unit}>{opt.unit}</Text>

      {/* Rating */}
      {showRating && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={9} color={Colors.warning} />
          <Text style={styles.ratingText}>{product.rating || 4.5}</Text>
        </View>
      )}

      {/* Price */}
      <PriceDisplay price={opt.price} originalPrice={opt.originalPrice} size="sm" />

      {/* Add button */}
      <TouchableOpacity
        style={[styles.addBtn, inCart && styles.addedBtn]}
        onPress={handleAdd}
        activeOpacity={0.8}
      >
        <Text style={[styles.addBtnText, inCart && styles.addedBtnText]}>
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 3,
  },
  ratingText: {
    fontSize: 9,
    color: Colors.textSecondary,
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
