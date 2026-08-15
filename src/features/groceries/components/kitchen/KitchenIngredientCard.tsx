import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuIngredient } from '../../data/WeeklyMenuTypes';
import { AppColors, AppFonts, AppRadius, AppShadow } from '../../theme/AppColors';

interface KitchenIngredientCardProps {
  ingredient: MenuIngredient;
  quantityInCart: number;
  onAddPress: () => void;
  onIncrementPress: () => void;
  onDecrementPress: () => void;
  onCardPress?: () => void;
}

export const KitchenIngredientCard: React.FC<KitchenIngredientCardProps> = ({
  ingredient,
  quantityInCart,
  onAddPress,
  onIncrementPress,
  onDecrementPress,
  onCardPress,
}) => {
  const { name, quantity, price, originalPrice, image } = ingredient;

  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9} 
      onPress={onCardPress}
    >
      {/* Image Container */}
      <View style={styles.imageContainer}>
        <Image source={image} style={styles.image} />
        {quantityInCart > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{quantityInCart}</Text>
          </View>
        )}
      </View>

      {/* Info Container */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.quantity} numberOfLines={1}>
          {quantity}
        </Text>

        {/* Pricing & Control Row */}
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.price}>₹{price}</Text>
            {originalPrice && (
              <Text style={styles.originalPrice}>₹{originalPrice}</Text>
            )}
          </View>

          {quantityInCart > 0 ? (
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={onDecrementPress}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={12} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantityInCart}</Text>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={onIncrementPress}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={onAddPress}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={14} color={AppColors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 135,
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.lg,
    overflow: 'hidden',
    padding: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...AppShadow.card,
  },
  imageContainer: {
    width: '100%',
    height: 95,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.surfaceAlt,
    borderRadius: AppRadius.md,
    position: 'relative',
  },
  image: {
    width: '85%',
    height: '85%',
    resizeMode: 'contain',
  },
  cartBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: AppColors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: AppFonts.extraBold,
  },
  info: {
    marginTop: 8,
  },
  name: {
    fontSize: 12,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  quantity: {
    fontSize: 10,
    fontFamily: AppFonts.semiBold,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  price: {
    fontSize: 12,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  originalPrice: {
    fontSize: 10,
    color: AppColors.textMuted,
    textDecorationLine: 'line-through',
    fontFamily: AppFonts.medium,
  },
  addBtn: {
    backgroundColor: AppColors.primaryLight,
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
  },
  controlBtn: {
    padding: 2,
  },
  qtyText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: AppFonts.extraBold,
  },
});
