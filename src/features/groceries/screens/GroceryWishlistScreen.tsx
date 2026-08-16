import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { AppColors, AppFonts, AppRadius, AppShadow } from '../theme/AppColors';

export function GroceryWishlistScreen() {
  const mode = useShoppingModeStore((s) => s.mode);
  const { items, toggleItem } = useWishlistStore();
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  const handleAddToCart = (product: any, option: any) => {
    addItem(product, option);
  };

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={AppColors.background} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Wishlist</Text>
          </View>
          <View style={styles.emptyContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="heart" size={60} color={AppColors.error} />
            </View>
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySub}>
              Tap the ♡ on any product to save it here.
            </Text>
            <TouchableOpacity
              style={styles.shopBtn}
              onPress={() => router.push('/groceries')}
              activeOpacity={0.8}
            >
              <Text style={styles.shopBtnText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.background} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wishlist</Text>
          <Text style={styles.headerCount}>{items.length} items</Text>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const options = mode === 'owner' ? item.ownerOptions : item.guestOptions;
            const option = options[0];
            if (!option) return null;
            const compoundId = `${item.id}-${option.unit}`;
            const inCart = cartItems.find((c) => c.id === compoundId);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => router.push(`/groceries/product/${item.id}`)}
              >
                <Image
                  source={
                    typeof item.image === 'string'
                      ? { uri: item.image }
                      : item.image
                  }
                  style={styles.cardImage}
                />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardUnit}>{option.unit}</Text>
                  <View style={styles.cardBottom}>
                    <View>
                      <Text style={styles.cardPrice}>₹{option.price}</Text>
                      {option.originalPrice && (
                        <Text style={styles.cardMRP}>₹{option.originalPrice}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.addBtn, inCart && styles.addBtnFilled]}
                      onPress={() => handleAddToCart(item, option)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.addBtnText, inCart && styles.addBtnTextFilled]}>
                        {inCart ? `In Cart (${inCart.quantity})` : '+ Add'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => toggleItem(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="heart" size={20} color={AppColors.error} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
    backgroundColor: AppColors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  headerCount: {
    fontSize: 13,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.medium,
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.lg,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: AppColors.border,
    ...AppShadow.card,
  },
  cardImage: {
    width: 80,
    height: 80,
    borderRadius: AppRadius.md,
    resizeMode: 'contain',
    backgroundColor: AppColors.surfaceAlt,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  cardName: {
    fontSize: 14,
    fontFamily: AppFonts.bold,
    color: AppColors.textPrimary,
    marginBottom: 2,
  },
  cardUnit: {
    fontSize: 11,
    color: AppColors.textMuted,
    fontFamily: AppFonts.semiBold,
    marginBottom: 8,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardPrice: {
    fontSize: 16,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  cardMRP: {
    fontSize: 11,
    color: AppColors.textMuted,
    textDecorationLine: 'line-through',
    fontFamily: AppFonts.medium,
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: AppRadius.pill,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
  },
  addBtnFilled: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  addBtnText: {
    fontSize: 11,
    fontFamily: AppFonts.bold,
    color: AppColors.primary,
  },
  addBtnTextFilled: {
    color: '#fff',
  },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AppColors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: AppColors.error,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: AppColors.textSecondary,
    fontFamily: AppFonts.medium,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  shopBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: AppRadius.pill,
  },
  shopBtnText: {
    color: '#fff',
    fontFamily: AppFonts.extraBold,
    fontSize: 15,
  },
});
