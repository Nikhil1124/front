import React, { useEffect, useMemo, useState } from 'react';
import { Animated, FlatList, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { CategoryGrid } from '../components/grocery/CategoryGrid';
import { ProductCard } from '../components/grocery/ProductCard';
import { ProductRow } from '../components/grocery/ProductRow';
import { MainBannerCarousel } from '../components/grocery/MainBannerCarousel';
import { SearchBar } from '../components/grocery/SearchBar';
import { Header } from '../components/grocery/Header';
import { FilterSheet, FilterState, DEFAULT_FILTERS } from '../components/grocery/FilterSheet';
import { TodaysKitchenNeeds } from '../components/kitchen/TodaysKitchenNeeds';

import { getDealsProducts, mockCategories, mockProducts } from '../data/mockProducts';
import { useCartStore } from '../store/useCartStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { useGroceryUiStore } from '../store/useGroceryUiStore';
import { AppFonts } from '../theme/AppColors';
import { usePGowStore } from '@/store/usePGowStore';

/**
 * Home/catalog screen — the source app let the shopper flip a "PG Stock" /
 * "My Stay" toggle by hand. Here the mode is decided by role instead (Owner/
 * Manager/Chef always shop bulk "owner" stock, Guest always shops personal
 * "guest" items), so there is no toggle UI — see the mode-sync effect below.
 */
export function GroceriesScreen() {
  const { width } = useWindowDimensions();
  const pushScreen = usePGowStore((s) => s.pushScreen);
  const activeRole = usePGowStore((s) => s.activeRole);
  const owner = usePGowStore((s) => s.loggedInOwner);
  const ownerForGuest = usePGowStore((s) => s.currentOwnerForGuest);

  const mode = useShoppingModeStore((s) => s.mode);
  const setMode = useShoppingModeStore((s) => s.setMode);
  const setPgDetails = useShoppingModeStore((s) => s.setPgDetails);

  const cartItems = useCartStore((s) => s.items);
  const getCartTotal = useCartStore((s) => s.getCartTotal);

  const setSelectedProductId = useGroceryUiStore((s) => s.setSelectedProductId);
  const setSelectedCategoryName = useGroceryUiStore((s) => s.setSelectedCategoryName);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Role decides the shopping mode; the PG's own name/address (already on
  // file) replaces the source app's map-based location picker.
  useEffect(() => {
    const isBulkRole = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'CHEF';
    setMode(isBulkRole ? 'owner' : 'guest');
    const pgOwner = isBulkRole ? owner : ownerForGuest;
    if (pgOwner) setPgDetails(pgOwner.pgName, pgOwner.address);
  }, [activeRole, owner, ownerForGuest, setMode, setPgDetails]);

  const dailyEssentials = useMemo(() => {
    const keywords = ['milk', 'curd', 'bread', 'egg', 'banana', 'tomato', 'onion', 'potato', 'water', 'oil'];
    return mockProducts.filter((p) => {
      const isVisible = mode === 'owner' ? p.ownerVisible : p.guestVisible;
      const isEssential = keywords.some((k) => p.id.toLowerCase().includes(k) || p.name.toLowerCase().includes(k));
      return isVisible && isEssential;
    });
  }, [mode]);

  const recommendedProducts = useMemo(
    () => mockProducts.filter((p) => (mode === 'owner' ? p.ownerVisible : p.guestVisible)).slice(0, 6),
    [mode],
  );
  const popularProducts = useMemo(
    () => mockProducts.filter((p) => (mode === 'owner' ? p.ownerVisible : p.guestVisible)).slice(6, 12),
    [mode],
  );

  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const hasActiveFilters =
    filters.sort !== 'popular' || filters.dietary.length > 0 || filters.maxPrice !== undefined || filters.onDealOnly === true;

  const searchResults = useMemo(() => {
    let list = mockProducts.filter((p) => (mode === 'owner' ? p.ownerVisible : p.guestVisible));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    } else if (hasActiveFilters) {
      list = [...list];
    } else {
      return [];
    }
    if (filters.maxPrice !== undefined) {
      list = list.filter((p) => {
        const firstOpt = mode === 'owner' ? p.ownerOptions[0] : p.guestOptions[0];
        return firstOpt ? firstOpt.price <= (filters.maxPrice as number) : true;
      });
    }
    return list;
  }, [searchQuery, filters, hasActiveFilters, mode]);

  const isSearching = searchQuery.trim().length > 0 || hasActiveFilters;

  const [cartAnimY] = useState(() => new Animated.Value(120));
  const [cartOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cartAnimY, { toValue: cartItemCount > 0 ? 0 : 120, useNativeDriver: true, tension: 70, friction: 8 }),
      Animated.timing(cartOpacity, { toValue: cartItemCount > 0 ? 1 : 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [cartItemCount, cartAnimY, cartOpacity]);

  const openProduct = (productId: string) => {
    setSelectedProductId(productId);
    pushScreen('GROCERY_PRODUCT');
  };
  const openCategory = (categoryName: string | null) => {
    setSelectedCategoryName(categoryName);
    pushScreen('GROCERY_CATEGORY');
  };
  const openCart = () => pushScreen('GROCERY_CART');

  const dealsTitle = mode === 'owner' ? "🔥 Today's Bulk Deals" : "🔥 Today's Deals";
  const dealsSub = mode === 'owner' ? 'Save more on your PG kitchen essentials' : 'Everything you need during your stay';
  const deliveryLabel = owner || ownerForGuest ? `${(owner ?? ownerForGuest)?.pgName} • ${(owner ?? ownerForGuest)?.address}` : 'Your PG';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <Header deliveryLabel={deliveryLabel} onProfilePress={() => pushScreen('GROCERY_ORDERS')} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.searchContainer}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFilterPress={() => setIsFilterOpen(true)}
              onCartPress={openCart}
              hasActiveFilters={hasActiveFilters}
              placeholderItems={
                mode === 'owner'
                  ? ["Search 'Rice 25kg, Dal, Oil...'", "Search 'Flour, Spices, Cleaning...'"]
                  : ["Search 'Milk, Bread, Snacks...'", "Search 'Curd, Bananas, Cold Drinks...'"]
              }
            />
          </View>

          <FilterSheet visible={isFilterOpen} onClose={() => setIsFilterOpen(false)} value={filters} onApply={setFilters} />

          {isSearching ? (
            <View style={styles.searchResultsWrapper}>
              <Text style={styles.searchResultsTitle}>
                {searchResults.length > 0 ? `${searchResults.length} results for "${searchQuery}"` : `No results for "${searchQuery}"`}
              </Text>
              {searchResults.length === 0 ? (
                <View style={styles.noResultsBox}>
                  <Ionicons name="search" size={48} color="#98A39B" />
                  <Text style={styles.noResultsText}>Try a different keyword</Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  numColumns={2}
                  contentContainerStyle={styles.searchResultsList}
                  columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
                  renderItem={({ item }) => {
                    const cardWidth = (width - 44) / 2;
                    return (
                      <View style={{ width: cardWidth }}>
                        <ProductCard product={item} onPress={(p) => openProduct(p.id)} style={{ width: '100%', marginRight: 0 }} />
                      </View>
                    );
                  }}
                />
              )}
            </View>
          ) : (
            <>
              <MainBannerCarousel onBannerPress={() => openCategory(null)} />

              {mode === 'owner' && (
                <TodaysKitchenNeeds onProductPress={openProduct} onSeeAllCategoriesPress={() => openCategory(null)} />
              )}

              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>{dealsTitle}</Text>
                    <Text style={styles.sectionSubtitle}>{dealsSub}</Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => openCategory(null)}>
                    <Text style={styles.seeAllText}>See All →</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
                  {getDealsProducts(mode).map((prod) => (
                    <ProductCard key={prod.id} product={prod} layout="deal" onPress={(p) => openProduct(p.id)} />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Daily Essentials</Text>
                    <Text style={styles.sectionSubtitle}>Must-have daily items for your PG</Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => openCategory(null)}>
                    <Text style={styles.seeAllText}>See All →</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
                  {dailyEssentials.map((prod) => (
                    <ProductCard key={prod.id} product={prod} layout="simple" style={{ marginRight: 8 }} onPress={(p) => openProduct(p.id)} />
                  ))}
                </ScrollView>
              </View>

              <CategoryGrid categories={mockCategories} onCategoryPress={(cat) => openCategory(cat.name)} onSeeAllPress={() => openCategory(null)} />

              <ProductRow title="Popular in PGs" products={popularProducts} onProductPress={(p) => openProduct(p.id)} onSeeAllPress={() => openCategory(null)} />
              <ProductRow title="Recommended for You" products={recommendedProducts} onProductPress={(p) => openProduct(p.id)} onSeeAllPress={() => openCategory(null)} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Animated.View style={[styles.floatingCartContainer, { transform: [{ translateY: cartAnimY }], opacity: cartOpacity, bottom: 24 }]}>
        <TouchableOpacity style={styles.floatingCart} onPress={openCart} activeOpacity={0.9}>
          <BlurView intensity={80} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: 32 }]} />
          <View style={styles.cartInfo}>
            <View style={styles.cartIconWrapper}>
              <Ionicons name="cart" size={14} color="#fff" />
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.cartTotalText}>₹{getCartTotal()}</Text>
              <Text style={styles.cartSubtext}>FREE delivery unlocked!</Text>
            </View>
          </View>
          <View style={styles.checkoutBtn}>
            <Text style={styles.checkoutText}>View Cart</Text>
            <MaterialIcons name="keyboard-arrow-right" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9F7' },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 150 },
  searchContainer: { paddingHorizontal: 16, marginTop: 12, marginBottom: 8 },
  floatingCartContainer: {
    position: 'absolute', alignSelf: 'center', width: '85%',
    shadowColor: '#17201A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  floatingCart: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)', borderRadius: 32, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.85)', overflow: 'hidden',
  },
  cartInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartIconWrapper: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#15803D', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  cartBadge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#E53935', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  cartBadgeText: { color: '#FFFFFF', fontSize: 9, fontFamily: AppFonts.bold },
  cartTotalText: { color: '#17201A', fontFamily: AppFonts.bold, fontSize: 14 },
  cartSubtext: { color: '#647067', fontSize: 10, fontFamily: AppFonts.regular, marginTop: 1 },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 1, backgroundColor: '#15803D', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 24 },
  checkoutText: { color: '#FFFFFF', fontFamily: AppFonts.bold, fontSize: 12 },
  searchResultsWrapper: { paddingHorizontal: 16, paddingTop: 4 },
  searchResultsTitle: { fontSize: 13, fontFamily: AppFonts.bold, color: '#647067', marginBottom: 12 },
  searchResultsList: { gap: 10 },
  noResultsBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  noResultsText: { fontSize: 14, color: '#98A39B', fontFamily: AppFonts.semiBold },
  sectionContainer: { marginVertical: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: AppFonts.bold, color: '#17201A' },
  sectionSubtitle: { fontSize: 12, fontFamily: AppFonts.regular, color: '#647067', marginTop: 2 },
  seeAllText: { fontSize: 13, fontFamily: AppFonts.semiBold, color: '#15803D' },
  horizontalListContent: { paddingHorizontal: 16 },
});
