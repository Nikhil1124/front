import { SupplyCategory, SupplyItem } from '@/types';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, useWindowDimensions, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { ProductCard } from '../components/grocery/ProductCard';
import { useCartStore } from '../store/useCartStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { useSupplyCategories, useSupplyItems } from '../useSupply';
import { useAuthStore } from '@/store/authStore';
import { Colors, Layout, Radii } from '@/theme';
import { FormScroll } from '@/components/ui/FormScroll';

export function GroceryCategoryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { name: initialSupplyCategory } = useLocalSearchParams<{ name?: string }>();

  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const { data: supplyItems = [] } = useSupplyItems(activePgId);
  const { data: categories = [], error: categoriesError } = useSupplyCategories(activePgId);

  const mode = useShoppingModeStore((s) => s.mode);
  const getCartTotal = useCartStore((s) => s.getCartTotal);
  const cartItemCount = useCartStore((s) => s.getItemCount());

  // Active category state (null = show category section groups; string = show products of that category)
  const [activeSupplyCategory, setActiveSupplyCategory] = useState<string | null>(initialSupplyCategory ?? null);
  const [search, setSearch] = useState('');

  // Products for the active category
  const products = useMemo(() => {
    let list = activeSupplyCategory
      ? supplyItems.filter(
          (p) =>
            p.category_id === activeSupplyCategory ||
            categories.find((c) => c.name === activeSupplyCategory && c.id === p.category_id) !== undefined
        )
      : supplyItems;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category_id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeSupplyCategory, search, supplyItems, categories]);

  const showProductList = activeSupplyCategory !== null || search.trim().length > 0;

  // 4 items per row grid math matching the photo
  const cardGap = 10;
  const paddingHorizontal = 16;
  const itemWidth = (width - (paddingHorizontal * 2) - (cardGap * 3)) / 4;

  const productCardWidth = (width - 36) / 2;

  // Render a single category item card in the 4-column layout
  const renderSupplyCategoryItem = (cat: SupplyCategory) => (
    <TouchableOpacity
      key={cat.id}
      style={[styles.catItem, { width: itemWidth }]}
      activeOpacity={0.85}
      onPress={() => setActiveSupplyCategory(cat.name)}
    >
      <View style={[styles.imageContainer, { width: itemWidth, height: itemWidth, backgroundColor: '#EBF6F6' }]}>
        <Image
          source={require('../../../../assets/img_app_icon.jpg')}
          style={styles.catImage}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.catTitle} numberOfLines={2}>
        {cat.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        {/* Top Header Search Bar */}
        <View style={[styles.topHeader, { paddingTop: insets.top + 14 }]}>
          {showProductList ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (activeSupplyCategory) {
                  setActiveSupplyCategory(null);
                  setSearch('');
                } else {
                  router.back();
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color={Colors.primary} />
            <TextInput
              style={styles.headerSearchInput}
              placeholder={showProductList ? "Search products in category..." : 'Search "eggs", "milk", "rice"...'}
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {!showProductList && (
              <Ionicons name="mic-outline" size={20} color={Colors.textSecondary} />
            )}
            {search.length > 0 && showProductList && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Title Banner when viewing an active category product grid */}
        {showProductList && (
          <View style={styles.activeSupplyCategoryHeader}>
            <Text style={styles.activeSupplyCategoryTitle}>{activeSupplyCategory || 'Products'}</Text>
            <Text style={styles.activeSupplyCategorySub}>{products.length} items available</Text>
          </View>
        )}

        {/* MAIN CONTENT AREA */}
        {!showProductList ? (
          /* ── ALL CATEGORIES (flat grid) ── */
          <FormScroll
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sectionsScrollContent}
          >
            {categoriesError ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>⚠️</Text>
                <Text style={styles.emptyText}>
                  {categoriesError instanceof Error ? categoriesError.message : 'Could not load categories.'}
                </Text>
              </View>
            ) : categories.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🗂️</Text>
                <Text style={styles.emptyText}>No categories available yet</Text>
              </View>
            ) : (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>All Categories</Text>
                <View style={styles.gridRow}>
                  {categories.map(renderSupplyCategoryItem)}
                </View>
              </View>
            )}
          </FormScroll>
        ) : (
          /* ── PRODUCT GRID (When a Category is Tapped) ── */
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={{ width: productCardWidth }}>
                <ProductCard
                  product={item}
                  onPress={(p) => router.push({ pathname: '/groceries/product/[id]', params: { id: p.id } })}
                  style={{ width: '100%', marginRight: 0 }}
                />
              </View>
            )}
          />
        )}
      </View>

      {/* Floating Cart Bar */}
      {cartItemCount > 0 && (
        <View style={[styles.floatingCartContainer, { bottom: Math.max(insets.bottom + 85, 105) }]}>
          <TouchableOpacity
            style={styles.floatingCart}
            onPress={() => router.push('/groceries/cart')}
            activeOpacity={0.9}
          >
            <BlurView
              intensity={80}
              tint="light"
              style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
            />
            <View style={styles.cartInfo}>
              <View style={styles.cartIconWrapper}>
                <Ionicons name="cart" size={18} color="#fff" />
              </View>
              <View>
                <Text style={styles.cartTotal}>₹{getCartTotal()}</Text>
                <Text style={styles.cartSub}>{cartItemCount} item{cartItemCount > 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View style={styles.viewCartBtn}>
              <Text style={styles.viewCartText}>View Cart →</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Layout.shadowCard,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Layout.shadowCard,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },
  chipRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 6,
  },
  activeChipText: {
    fontSize: 12,
    color: Colors.primary,
  },
  activeSupplyCategoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  activeSupplyCategoryTitle: {
    fontSize: 20,
    color: Colors.textPrimary,
  },
  activeSupplyCategorySub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionsScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 150,
  },
  sectionBlock: {
    marginTop: 18,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catItem: {
    alignItems: 'center',
    marginBottom: 16,
  },
  imageContainer: {
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  catImage: {
    width: '82%',
    height: '82%',
  },
  catTitle: {
    fontSize: 11,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
    paddingHorizontal: 2,
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 160,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  floatingCartContainer: {
    position: 'absolute',
    alignSelf: 'center',
    width: '85%',
    ...Layout.shadowFloatingBar,
  },
  floatingCart: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
  },
  cartInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartTotal: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  cartSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  viewCartBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  viewCartText: {
    color: '#fff',
    fontSize: 12,
  },
});
