import { useEffect, useMemo, useState } from 'react';
import { toAmount } from '@/data/mappers';
import { useQueryClient } from '@tanstack/react-query';
import { Animated, FlatList, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { AnimatedPress, ErrorState, FormScroll, LoadingState, Txt } from '@/components/ui';

import { router } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { SupplyCategoryGrid } from '../components/grocery/CategoryGrid';
import { ProductCard } from '../components/grocery/ProductCard';
import { ProductRow } from '../components/grocery/ProductRow';
import { MainBannerCarousel } from '../components/grocery/MainBannerCarousel';
import { SearchBar } from '../components/grocery/SearchBar';
import { Header } from '../components/grocery/Header';
import { FilterSheet, FilterState, DEFAULT_FILTERS } from '../components/grocery/FilterSheet';
import { TodaysKitchenNeeds } from '../components/kitchen/TodaysKitchenNeeds';
import { useSupplyCategories, useSupplyItems, useDeals } from '../useSupply';

import { useCartStore } from '../store/useCartStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { Radii, Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

/**
 * Home/catalog screen — the source app let the shopper flip a "PG Stock" /
 * "My Stay" toggle by hand. Here the mode is decided by role instead (Owner/
 * Manager/Chef always shop bulk "owner" stock, Guest always shops personal
 * "guest" items), so there is no toggle UI — see the mode-sync effect below.
 */
import { useActiveProperty } from '@/features/properties/useProperties';

export function GroceriesScreen() {
  const { width } = useWindowDimensions();
  const activeRole = usePGowStore((s) => s.activeRole);
  const { activeEntity: owner, activePgId } = useActiveProperty();
  const ownerForGuest = owner;

  const mode = useShoppingModeStore((s) => s.mode);
  const setMode = useShoppingModeStore((s) => s.setMode);
  const setPgDetails = useShoppingModeStore((s) => s.setPgDetails);

  const cartItemCount = useCartStore((s) => s.getItemCount());
  const getCartTotal = useCartStore((s) => s.getCartTotal);

  const { data: supplyItems = [], isLoading: itemsLoading, error: itemsError, refetch: refetchItems, isRefetching: isRefetchingItems } = useSupplyItems(activePgId ?? undefined);
  const { data: categories = [], refetch: refetchCategories } = useSupplyCategories(activePgId ?? undefined);
  const { data: deals = [], refetch: refetchDeals } = useDeals(activePgId ?? undefined);

  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    // `kitchen_menu` is owned by TodaysKitchenNeeds further down this screen, so pulling to
    // refresh used to reload everything except the one section a chef comes here to check.
    // Invalidated by key rather than lifting that query up a level for one call site.
    await Promise.all([
      refetchItems(),
      refetchCategories(),
      refetchDeals(),
      queryClient.invalidateQueries({ queryKey: ['kitchen_menu', activePgId ?? undefined] }),
    ]);
  };

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

  // Hardware back / iOS swipe-back are handled by the Stack navigator itself now — no manual
  // BackHandler listener needed, unlike the old custom screen-stack this replaced.

  const dailyEssentials = useMemo(() => {
    const keywords = ['milk', 'curd', 'bread', 'egg', 'banana', 'tomato', 'onion', 'potato', 'water', 'oil'];
    return supplyItems.filter((p) => {
      const isEssential = keywords.some((k) => p.id.toLowerCase().includes(k) || p.name.toLowerCase().includes(k));
      return isEssential;
    });
  }, [supplyItems]);

  const recommendedProducts = useMemo(
    () => supplyItems.slice(0, 6),
    [supplyItems],
  );
  const popularProducts = useMemo(
    () => supplyItems.slice(6, 12),
    [supplyItems],
  );

  const hasActiveFilters =
    filters.sort !== 'popular' || filters.maxPrice !== undefined || filters.onDealOnly === true;

  const searchResults = useMemo(() => {
    let list = supplyItems;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category_id.toLowerCase().includes(q));
    } else if (hasActiveFilters) {
      list = [...list];
    } else {
      return [];
    }
    if (filters.maxPrice !== undefined) {
      list = list.filter((p) => p.price <= (filters.maxPrice as number));
    }
    // Same "on deal" test as useDeals, and the same reason for toAmount() rather than a bare
    // `>`: mrp/price come back as Decimal-on-the-wire strings despite the SupplyItem type
    // claiming `number` — comparing them directly is lexicographic ("90.00" > "100.00" is
    // true because "9" > "1"), which would advertise markups as deals.
    if (filters.onDealOnly) {
      list = list.filter((p) => p.mrp != null && toAmount(p.mrp) > toAmount(p.price));
    }
    if (filters.sort === 'price-asc') {
      list = [...list].sort((a, b) => toAmount(a.price) - toAmount(b.price));
    } else if (filters.sort === 'price-desc') {
      list = [...list].sort((a, b) => toAmount(b.price) - toAmount(a.price));
    } else if (filters.sort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [searchQuery, filters, hasActiveFilters, supplyItems]);

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
    router.push({ pathname: '/groceries/product/[id]', params: { id: productId } });
  };
  const openSupplyCategory = (categoryName: string | null) => {
    router.push({ pathname: '/groceries/categories', params: categoryName ? { name: categoryName } : {} });
  };
  const openDeals = () => router.push({ pathname: '/groceries/categories', params: { filter: 'deals' } });
  const openCart = () => router.push('/groceries/cart');

  const dealsTitle = mode === 'owner' ? "🔥 Today's Bulk Deals" : "🔥 Today's Deals";
  const dealsSub = mode === 'owner' ? 'Save more on your PG kitchen essentials' : 'Everything you need during your stay';
  const deliveryLabel = owner || ownerForGuest ? `${(owner ?? ownerForGuest)?.pgName} • ${(owner ?? ownerForGuest)?.address}` : 'Your PG';

  return (
    <View style={styles.container}>
      {/* No local StatusBar override — the root layout's expo-status-bar + app.json's
          androidStatusBar.translucent:true already make it seamless everywhere else in the
          app; a per-screen React Native StatusBar here fought that and painted an opaque
          bar over it. */}
      <View style={styles.safeArea}>
        <Header deliveryLabel={deliveryLabel} onProfilePress={() => router.push('/groceries/profile')} onBack={() => router.back()} />

        <FormScroll
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefetchingItems} onRefresh={handleRefresh} />}
        >
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
              <Txt maxFontSizeMultiplier={1.3} style={styles.searchResultsTitle}>
                {searchResults.length > 0 ? `${searchResults.length} results for "${searchQuery}"` : `No results for "${searchQuery}"`}
              </Txt>
              {itemsLoading ? (
                <LoadingState label="Loading catalog…" fill={false} />
              ) : itemsError ? (
                <ErrorState error={itemsError} title="Could not load the catalog" onRetry={refetchItems} fill={false} />
              ) : searchResults.length === 0 ? (
                <View style={styles.noResultsBox}>
                  <Ionicons name="search" size={48} color={Colors.textMuted} />
                  <Txt maxFontSizeMultiplier={1.3} style={styles.noResultsText}>Try a different keyword</Txt>
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
              <MainBannerCarousel onBannerPress={() => openSupplyCategory(null)} />

              {mode === 'owner' && (
                <TodaysKitchenNeeds onProductPress={openProduct} onSeeAllCategoriesPress={() => openSupplyCategory(null)} products={supplyItems} pgId={activePgId ?? undefined} />
              )}

              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>{dealsTitle}</Txt>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.sectionSubtitle}>{dealsSub}</Txt>
                  </View>
                  <AnimatedPress accessibilityRole="button" onPress={openDeals}>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.seeAllText}>See All →</Txt>
                  </AnimatedPress>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
                  {deals.map((prod) => (
                    <ProductCard key={prod.id} product={prod} layout="deal" onPress={(p) => openProduct(p.id)} />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Daily Essentials</Txt>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.sectionSubtitle}>Must-have daily items for your PG</Txt>
                  </View>
                  <AnimatedPress accessibilityRole="button" onPress={() => openSupplyCategory(null)}>
                    <Txt maxFontSizeMultiplier={1.3} style={styles.seeAllText}>See All →</Txt>
                  </AnimatedPress>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
                  {dailyEssentials.map((prod) => (
                    <ProductCard key={prod.id} product={prod} layout="simple" style={{ marginRight: 8 }} onPress={(p) => openProduct(p.id)} />
                  ))}
                </ScrollView>
              </View>

              <SupplyCategoryGrid categories={categories} onSupplyCategoryPress={(cat) => openSupplyCategory(cat.name)} onSeeAllPress={() => openSupplyCategory(null)} />

              <ProductRow title="Popular in PGs" products={popularProducts} onProductPress={(p) => openProduct(p.id)} onSeeAllPress={() => openSupplyCategory(null)} />
              <ProductRow title="Recommended for You" products={recommendedProducts} onProductPress={(p) => openProduct(p.id)} onSeeAllPress={() => openSupplyCategory(null)} />
            </>
          )}
        </FormScroll>
      </View>

      <Animated.View style={[styles.floatingCartContainer, { transform: [{ translateY: cartAnimY }], opacity: cartOpacity, bottom: 24 }]}>
        <AnimatedPress accessibilityRole="button" style={styles.floatingCart} onPress={openCart}>
          <BlurView intensity={80} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: Radii.sheet }]} />
          <View style={styles.cartInfo}>
            <View style={styles.cartIconWrapper}>
              <Ionicons name="cart" size={14} color={Colors.textInverse} />
              <View style={styles.cartBadge}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.cartBadgeText}>{cartItemCount}</Txt>
              </View>
            </View>
            <View>
              <Txt maxFontSizeMultiplier={1.3} style={styles.cartTotalText}>₹{getCartTotal()}</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.cartSubtext}>FREE delivery unlocked!</Txt>
            </View>
          </View>
          <View style={styles.checkoutBtn}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.checkoutText}>View Cart</Txt>
            <MaterialIcons name="keyboard-arrow-right" size={18} color={Colors.textInverse} />
          </View>
        </AnimatedPress>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.canvas },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 150 },
  searchContainer: { paddingHorizontal: 16, marginTop: 12, marginBottom: 8 },
  floatingCartContainer: {
    position: 'absolute', alignSelf: 'center', width: '85%',
    shadowColor: Colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  floatingCart: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)', borderRadius: Radii.sheet, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.85)', overflow: 'hidden' },
  cartInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartIconWrapper: { width: 32, height: 32, borderRadius: Radii.pill, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  cartBadge: { position: 'absolute', top: -2, right: -4, backgroundColor: Colors.accentRose, borderRadius: Radii.control, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 1, backgroundColor: Colors.primary, paddingVertical: 7, paddingHorizontal: 12, borderRadius: Radii.sheet },
  searchResultsWrapper: { paddingHorizontal: 16, paddingTop: 4 },
  searchResultsList: { gap: 10 },
  noResultsBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  sectionContainer: { marginVertical: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  horizontalListContent: { paddingHorizontal: 16 },
  cartBadgeText: { color: Colors.textInverse, fontSize: 9, fontWeight: '700' as const },
  cartTotalText: { color: Colors.textPrimary, fontWeight: '700' as const, fontSize: 14 },
  cartSubtext: { color: Colors.textSecondary, fontSize: 10, fontWeight: '400' as const, marginTop: 1 },
  checkoutText: { color: Colors.textInverse, fontWeight: '700' as const, fontSize: 12 },
  searchResultsTitle: { fontSize: 13, fontWeight: '700' as const, color: Colors.textMuted, marginBottom: 12 },
  noResultsText: { fontSize: 14, color: Colors.textMuted, fontWeight: '600' as const },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary },
  sectionSubtitle: { fontSize: 12, fontWeight: '400' as const, color: Colors.textSecondary, marginTop: 2 },
  seeAllText: { fontSize: 13, fontWeight: '600' as const, color: Colors.primary } });
