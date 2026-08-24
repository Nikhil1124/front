import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { SupplyItem } from '@/types';
import { Colors, Layout, Radii } from '@/theme';

export function GroceryWishlistScreen() {
  const insets = useSafeAreaInsets();
  const mode = useShoppingModeStore((s) => s.mode);
  const { items, toggleItem } = useWishlistStore();
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  const handleAddToCart = (product: SupplyItem, option: { unit: string; price: number; originalPrice?: number }) => {
    addItem(product, option);
  };

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.safeArea}>
          <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
            <Text style={styles.headerTitle}>My Wishlist</Text>
          </View>
          <View style={styles.emptyContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="heart" size={60} color={Colors.danger} />
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
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.safeArea}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.headerTitle}>My Wishlist</Text>
          <Text style={styles.headerCount}>{items.length} items</Text>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const options = [{ price: item.price, unit: item.unit_label, originalPrice: item.mrp ?? undefined }];
            const option = options[0];
            if (!option) return null;
            const compoundId = `${item.id}-${option.unit}`;
            const inCart = cartItems.find((c) => c.id === compoundId);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => router.push({ pathname: '/groceries/product/[id]', params: { id: item.id } })}
              >
                <Image
                  source={item.image_url ? { uri: item.image_url } : require('../../../../assets/img_app_icon.jpg')}
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
                  <Ionicons name="heart" size={20} color={Colors.danger} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
  headerCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Layout.shadowCard,
  },
  cardImage: {
    width: 80,
    height: 80,
    borderRadius: Radii.xl,
    resizeMode: 'contain',
    backgroundColor: Colors.surfaceMuted,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  cardName: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardUnit: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardPrice: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  cardMRP: {
    fontSize: 11,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  addBtnFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  addBtnText: {
    fontSize: 11,
    color: Colors.primary,
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
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  shopBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Radii.pill,
  },
  shopBtnText: {
    color: '#fff',
    fontSize: 15,
  },
});
