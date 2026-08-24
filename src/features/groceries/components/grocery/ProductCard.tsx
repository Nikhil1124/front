import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, ViewStyle } from 'react-native';
import { SupplyItem } from '@/types';
import { useCartStore } from '../../store/useCartStore';
import { useShoppingModeStore } from '../../store/useShoppingModeStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { Colors } from '@/theme';

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

  // Compact layout — used for dense horizontal strips (e.g. Daily Essentials) where the
  // full deal-card height would overflow the row.
  if (layout === 'simple') {
    return (
      <TouchableOpacity
        style={[styles.simpleCard, { width: cardWidth }, style]}
        activeOpacity={0.95}
        onPress={() => onPress?.(product)}
      >
        <View style={styles.simpleImageContainer}>
          <Image
            source={product.image_url ? { uri: product.image_url } : require('../../../../../assets/img_app_icon.jpg')}
            style={styles.simpleImage}
          />
        </View>
        <View style={styles.simpleDetails}>
          <Text style={styles.simpleName} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.simpleUnit}>{selectedOption.unit}</Text>
          <View style={styles.simpleBottomRow}>
            <View>
              <Text style={styles.simplePrice}>₹{price}</Text>
              {originalPrice && (
                <Text style={styles.simpleStrikePrice}>₹{originalPrice}</Text>
              )}
            </View>
            {quantity > 0 ? (
              <View style={styles.simpleQuantityControl}>
                <TouchableOpacity style={styles.simpleQtyBtn} onPress={handleDecrease}>
                  <Ionicons name="remove" size={12} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.simpleQtyText}>{quantity}</Text>
                <TouchableOpacity style={styles.simpleQtyBtn} onPress={handleIncrease}>
                  <Ionicons name="add" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.simpleAddButton} onPress={handleAdd} activeOpacity={0.85}>
                <Ionicons name="add" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Full Layout (Blinkit Redesign Layout)
  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }, style]}
      activeOpacity={0.95}
      onPress={() => onPress?.(product)}
    >
      {/* Top row containing Discount and Wishlist heart */}
      <View style={styles.topRow}>
        {discountPercent > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
          </View>
        ) : (
          <View />
        )}

        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={() => toggleItem(product)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={18}
            color={isWishlisted ? '#E53935' : '#98A39B'}
          />
        </TouchableOpacity>
      </View>

      {/* Image Container */}
      <View style={styles.imageContainer}>
        <Image
          source={product.image_url ? { uri: product.image_url } : require('../../../../../assets/img_app_icon.jpg')}
          style={styles.image}
        />
        {quantity > 0 && (
          <View style={styles.checkmarkBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#15803D" />
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.detailsContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>

        {/* Selected Unit/Option text */}
        <Text style={styles.unitText}>{selectedOption.unit}</Text>

        {/* Rating and Price Row */}
        <View style={styles.ratingPriceRow}>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{price}</Text>
            {originalPrice && (
              <Text style={styles.strikePrice}>₹{originalPrice}</Text>
            )}
          </View>

          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.ratingText}>4.8</Text>
          </View>
        </View>

        {/* Option selection tabs if multiple exist */}
        {options.length > 1 && (
          <View style={styles.optionsWrapper}>
            {options.map((opt, i) => (
              <TouchableOpacity
                key={opt.unit}
                style={[
                  styles.optionTab,
                  selectedIdx === i && styles.selectedOptionTab,
                ]}
                onPress={() => setSelectedIdx(i)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedIdx === i && styles.selectedOptionText,
                  ]}
                >
                  {opt.unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Action Controls */}
        <View style={styles.actionContainer}>
          {quantity > 0 ? (
            <View style={styles.qtyControl}>
              <TouchableOpacity style={styles.qtyBtn} onPress={handleDecrease}>
                <Ionicons name="remove" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={handleIncrease}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.85}>
              <Text style={styles.addBtnText}>Add to Cart</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E4E9E5',
    marginRight: 10,
    marginBottom: 8,
    position: 'relative',
    height: 290, // clean fixed height to prevent clipping
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  discountBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: '#E53935',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    shadowColor: '#17201A',
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
    color: '#17201A',
  },
  unitText: {
    fontSize: 11,
    color: '#647067',
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
    color: '#15803D',
  },
  strikePrice: {
    fontSize: 11,
    color: '#98A39B',
    textDecorationLine: 'line-through',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  ratingText: {
    fontSize: 10,
    color: '#F59E0B',
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
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E4E9E5',
    backgroundColor: '#FFFFFF',
  },
  selectedOptionTab: {
    borderColor: '#15803D',
    backgroundColor: '#F0FDF4',
  },
  optionText: {
    fontSize: 9,
    color: '#647067',
  },
  selectedOptionText: {
    color: '#15803D',
  },
  actionContainer: {
    marginTop: 6,
  },
  addBtn: {
    backgroundColor: '#15803D',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#15803D',
    borderRadius: 8,
    height: 32,
    paddingHorizontal: 8,
  },
  qtyBtn: {
    padding: 4,
  },
  qtyText: {
    color: '#FFFFFF',
    fontSize: 13,
  },

  // ── Simple Layout Styles ──
  simpleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E4E9E5',
    marginRight: 8,
    marginBottom: 6,
    height: 165,
    justifyContent: 'space-between',
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
    color: '#17201A',
  },
  simpleUnit: {
    fontSize: 10,
    color: '#647067',
  },
  simpleBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  simplePrice: {
    fontSize: 13,
    color: '#15803D',
  },
  simpleStrikePrice: {
    fontSize: 9,
    color: '#98A39B',
    textDecorationLine: 'line-through',
  },
  simpleAddButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#15803D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  simpleQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15803D',
    borderRadius: 6,
    height: 24,
    paddingHorizontal: 2,
    gap: 4,
  },
  simpleQtyBtn: {
    padding: 2,
  },
  simpleQtyText: {
    color: '#FFFFFF',
    fontSize: 11,
    minWidth: 12,
    textAlign: 'center',
  },
});
