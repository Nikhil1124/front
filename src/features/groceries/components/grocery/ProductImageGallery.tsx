import React from 'react';
import { View, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../theme/AppColors';

export interface ProductImageGalleryProps {
  images: any[];
  isWishlisted: boolean;
  onWishlistToggle: () => void;
  discountPercent: number;
}

/**
 * Product image gallery with paginated scroll, discount badge, and wishlist button.
 * Extracted from product/[id].tsx — Section 3-6 (image left column).
 */
export const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  images,
  isWishlisted,
  onWishlistToggle,
  discountPercent,
}) => {
  return (
    <View style={styles.container}>
      {/* Discount badge */}
      {discountPercent > 0 && (
        <View style={styles.discountBadge}>
          <Ionicons name="pricetag" size={10} color={AppColors.surface} style={{ marginRight: 3 }} />
          <Ionicons name="text" size={0} />
        </View>
      )}

      {/* Wishlist button */}
      <TouchableOpacity
        style={styles.wishlistBtn}
        onPress={onWishlistToggle}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isWishlisted ? 'heart' : 'heart-outline'}
          size={18}
          color={isWishlisted ? AppColors.error : AppColors.textSecondary}
        />
      </TouchableOpacity>

      {/* Paginated image scroll */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.imageScroll}
        contentContainerStyle={styles.imageScrollContent}
      >
        {images.map((imgUrl: any, idx: number) => (
          <View key={idx} style={styles.mainImageWrapper}>
            <Image
              source={typeof imgUrl === 'string' ? { uri: imgUrl } : imgUrl}
              style={styles.mainImage}
              resizeMode="contain"
            />
          </View>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      {images.length > 1 && (
        <View style={styles.paginationRow}>
          {images.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === 0 && styles.activeDot]} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 5,
    backgroundColor: AppColors.error,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  imageScroll: {
    width: '100%',
  },
  imageScrollContent: {
    alignItems: 'center',
  },
  mainImageWrapper: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImage: {
    width: '90%',
    height: '90%',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppColors.border,
  },
  activeDot: {
    backgroundColor: AppColors.primary,
    width: 14,
    borderRadius: 3,
  },
});
