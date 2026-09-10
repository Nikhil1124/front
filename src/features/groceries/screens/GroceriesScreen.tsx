import { useEffect, useMemo, useState } from 'react';
import { toAmount } from '@/data/mappers';
import { useQueryClient } from '@tanstack/react-query';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions } from 'react-native';
import { FormScroll } from '@/components/ui/FormScroll';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { SupplyCategoryGrid } from '../components/grocery/CategoryGrid';
import { ProductCard } from '../components/grocery/ProductCard';
import { ProductRow } from '../components/grocery/ProductRow';
import { Header } from '../components/grocery/Header';
import { SearchBar } from '../components/grocery/SearchBar';
import { FilterSheet, FilterState, DEFAULT_FILTERS } from '../components/grocery/FilterSheet';
import { HeroBanner } from '../components/grocery/HeroBanner';
import { PromoCards } from '../components/grocery/PromoCards';
import { QuickCategoryRow } from '../components/grocery/QuickCategoryRow';
import { useSupplyCategories, useSupplyItems, useDeals } from '../useSupply';

import { useCartStore } from '../store/useCartStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { GroceryColors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

/**
 * Home/catalog screen. Shopping mode is decided by role (Owner/Manager/Chef → bulk;
 * Guest → personal). No manual toggle UI needed.
 */
import { useActiveProperty } from '@/features/properties/useProperties';
import { AnimatedPress, ErrorState, LoadingState, Txt } from '@/components/ui';

export function GroceriesScreen() {
  const { width } = useWindowDimensions();
  const activeRole = usePGowStore((s) => s.activeRole);
  const { activeEntity: owner, activePgId } = useActiveProperty();
  const ownerForGuest = owner;

  const mode = useShoppingModeStore((s) => s.mode);
  const setMode = useShoppingModeStore((s) => s.setMode);
  const setPgDetails = useShoppingModeStore((s) => s.setPgDetails);

  const cartItemCount = useCartStore((s) => s.getItemCount());

  const {
    data: supplyItems = [],
    isLoading: itemsLoading,
    error: itemsError,
    refetch: refetchItems,
    isRefetching: isRefetchingItems,
  } = useSupplyItems(activePgId ?? undefined);
  const { data: categories = [], refetch: refetchCategories } = useSupplyCategories(activePgId ?? undefined);
  const { data: deals = [], refetch: refetchDeals } = useDeals(activePgId ?? undefined);

  const queryClient = useQueryClient();

  const handleRefresh = async () => {
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
  const [activeQuickCategory, setActiveQuickCategory] = useState<string | null>(null);

  useEffect(() => {
    const isBulkRole = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'CHEF';
    setMode(isBulkRole ? 'owner' : 'guest');
    const pgOwner = isBulkRole ? owner : ownerForGuest;
    if (pgOwner) setPgDetails(pgOwner.pgName, pgOwner.address);
  }, [activeRole, owner, ownerForGuest, setMode, setPgDetails]);

  // Derived product lists
  const dailyEssentials = useMemo(() => {
    const keywords = ['milk', 'curd', 'bread', 'egg', 'banana', 'tomato', 'onion', 'potato', 'water', 'oil'];
    return supplyItems.filter((p) =>
      keywords.some((k) => p.id.toLowerCase().includes(k) || p.name.toLowerCase().includes(k))
    );
  }, [supplyItems]);

  const recommendedProducts = useMemo(() => supplyItems.slice(0, 6), [supplyItems]);
  const popularProducts = useMemo(() => supplyItems.slice(6, 12), [supplyItems]);

  const vegetablesList = useMemo(() => supplyItems.filter(p => p.category_id.toLowerCase().includes('vegetable')), [supplyItems]);
  const leafyItemsList = useMemo(() => supplyItems.filter(p => p.category_id.toLowerCase().includes('leafy')), [supplyItems]);
  const dairyAndEggsList = useMemo(() => supplyItems.filter(p => p.category_id.toLowerCase().includes('dairy') || p.category_id.toLowerCase().includes('egg')), [supplyItems]);
  const meatsList = useMemo(() => supplyItems.filter(p => p.category_id.toLowerCase().includes('meat') || p.category_id.toLowerCase().includes('chicken') || p.category_id.toLowerCase().includes('fish')), [supplyItems]);

  const hasActiveFilters =
    filters.sort !== 'popular' || filters.maxPrice !== undefined || filters.onDealOnly === true;

  const searchResults = useMemo(() => {
    let list = supplyItems;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category_id.toLowerCase().includes(q)
      );
    } else if (activeQuickCategory) {
      const q = activeQuickCategory.toLowerCase();
      if (q.includes('vegetable')) list = vegetablesList;
      else if (q.includes('leafy')) list = leafyItemsList;
      else if (q.includes('dairy') || q.includes('egg')) list = dairyAndEggsList;
      else if (q.includes('meat')) list = meatsList;
      else list = [];
    } else if (hasActiveFilters) {
      list = [...list];
    } else {
      return [];
    }
    if (filters.maxPrice !== undefined) {
      list = list.filter((p) => p.price <= (filters.maxPrice as number));
    }
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

  const isSearching = searchQuery.trim().length > 0 || hasActiveFilters || activeQuickCategory !== null;

  const openProduct = (productId: string) => {
    router.push({ pathname: '/groceries/product/[id]', params: { id: productId } });
  };
  const openSupplyCategory = (categoryName: string | null) => {
    router.push({ pathname: '/groceries/categories', params: categoryName ? { name: categoryName } : {} });
  };
  const openDeals = () => router.push({ pathname: '/groceries/categories', params: { filter: 'deals' } });
  const openCart = () => router.push('/groceries/cart');

  const dealsTitle = mode === 'owner' ? 'Deals for Your PG' : 'Deals for You';
  const deliveryLabel =
    owner || ownerForGuest
      ? `${(owner ?? ownerForGuest)?.pgName}`
      : 'Your PG';

  return (
    <View style={styles.container}>
      {/* ── Green Header ── */}
      <Header
        deliveryLabel={deliveryLabel}
        cartItemCount={cartItemCount}
        onCartPress={openCart}
        onNotificationPress={() => router.push('/notifications')}
      />

      {/* ── Search Bar (still green background below header) ── */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onFilterPress={() => setIsFilterOpen(true)}
        onCartPress={openCart}
        hasActiveFilters={hasActiveFilters}
        placeholderItems={
          mode === 'owner'
            ? ["Search 'Rice 25kg, Dal, Oil...'", "Search 'Flour, Spices, Cleaning...'"]
            : ["Search groceries, fruits, snacks...", "Search 'Milk, Bread, Bananas...'"]
        }
      />

      {/* ── Quick Category Row ── */}
      {(!isSearching || activeQuickCategory !== null) && (
        <QuickCategoryRow
          onCategoryPress={(name) => {
            setActiveQuickCategory(name);
          }}
        />
      )}


      <FilterSheet
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        value={filters}
        onApply={setFilters}
      />

      <FormScroll
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetchingItems} onRefresh={handleRefresh} />
        }
      >
        {isSearching ? (
          /* ── Search results ── */
          <View style={styles.searchResultsWrapper}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.searchResultsTitle}>
              {searchResults.length > 0
                ? `${searchResults.length} products ${searchQuery ? `for "${searchQuery}"` : activeQuickCategory ? `in ${activeQuickCategory}` : 'found'}`
                : `No products ${searchQuery ? `for "${searchQuery}"` : activeQuickCategory ? `in ${activeQuickCategory}` : 'found'}`}
            </Txt>
            {itemsLoading ? (
              <LoadingState label="Loading catalog…" fill={false} />
            ) : itemsError ? (
              <ErrorState
                error={itemsError}
                title="Could not load the catalog"
                onRetry={refetchItems}
                fill={false}
              />
            ) : searchResults.length === 0 ? (
              <View style={styles.noResultsBox}>
                <Ionicons name="search" size={48} color={GroceryColors.textMuted} />
                <Txt maxFontSizeMultiplier={1.3} style={styles.noResultsText}>
                  Try a different keyword
                </Txt>
              </View>
            ) : (
              /* A `FlatList scrollEnabled={false}` used to render this grid. Nested inside
                 the screen's ScrollView a VirtualizedList cannot virtualise — it renders
                 every row eagerly regardless — so it was paying for windowing machinery it
                 could never use, plus RN's "VirtualizedLists should never be nested"
                 warning on every render. A wrapped map does the identical work without it. */
              <View style={styles.searchResultsGrid}>
                {searchResults.map((item) => (
                  <View key={item.id} style={{ width: (width - 44) / 2 }}>
                    <ProductCard
                      product={item}
                      onPress={(p) => openProduct(p.id)}
                      style={{ width: '100%', marginRight: 0 }}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : itemsError ? (
          /* The catalog is the screen. A failure here — most often AREA_NOT_SERVICED, a
             403 for a PG whose `area_id` is null or whose area has no warehouse yet — used
             to fall through to the browse layout below and render banners, category tiles
             and a dozen empty product rows: a shop that looks open and stocks nothing.
             `categories` still answers 200 in that state, which is what made it convincing.
             Say what actually happened instead. */
          <View style={styles.errorWrapper}>
            <ErrorState
              error={itemsError}
              title="Groceries aren't available here yet"
              onRetry={refetchItems}
              fill={false}
            />
          </View>
        ) : itemsLoading ? (
          <View style={styles.errorWrapper}>
            <LoadingState label="Loading catalog…" fill={false} />
          </View>
        ) : (
          <>
            {/* ── Hero Banner (Mega Sale) ── */}
            <HeroBanner onPress={() => openSupplyCategory(null)} />

            {/* ── Promo Cards ── */}
            <PromoCards onCardPress={(_id) => openDeals()} />

            <View style={styles.bottomWhiteSection}>
              {/* ── Kitchen needs (owner/chef only) ── */}
              {/* {mode === 'owner' && (
                <TodaysKitchenNeeds
                  onProductPress={openProduct}
                  onSeeAllCategoriesPress={() => openSupplyCategory(null)}
                  products={supplyItems}
                  pgId={activePgId ?? undefined}
                />
              )} */}


              {/* ── Popular Categories ── */}
              <SupplyCategoryGrid
                categories={categories}
                onSupplyCategoryPress={(cat) => openSupplyCategory(cat.name)}
                onSeeAllPress={() => openSupplyCategory(null)}
              />


            {/* ── Deals for Your PG ── */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>{dealsTitle}</Txt>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.sectionSubtitle}>
                    {mode === 'owner'
                      ? 'Save more on your PG kitchen essentials'
                      : 'Everything you need during your stay'}
                  </Txt>
                </View>
                <AnimatedPress accessibilityRole="button" onPress={openDeals}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.seeAllText}>
                    See All →
                  </Txt>
                </AnimatedPress>
              </View>

              {/* 2-column grid for deals */}
              {deals.length > 0 ? (
                /* Same reasoning as the search grid above: six cards, nested in a
                   ScrollView, so a FlatList bought nothing here. */
                <View style={styles.dealsGrid}>
                  {deals.slice(0, 6).map((item) => (
                    <View key={item.id} style={{ width: (width - 44) / 2 }}>
                      <ProductCard
                        product={item}
                        layout="deal"
                        onPress={(p) => openProduct(p.id)}
                        style={{ width: '100%', marginRight: 0 }}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
                  {supplyItems.slice(0, 4).map((prod) => (
                    <ProductCard key={prod.id} product={prod} layout="deal" onPress={(p) => openProduct(p.id)} />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* ── Buy Again / Popular PG Essentials ── */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>
                  Popular PG Essentials
                </Txt>
                <AnimatedPress accessibilityRole="button" onPress={() => openSupplyCategory(null)}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.seeAllText}>
                    See All →
                  </Txt>
                </AnimatedPress>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalListContent}
              >
                {(dailyEssentials.length > 0 ? dailyEssentials : supplyItems.slice(0, 8)).map(
                  (prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      layout="simple"
                      onPress={(p) => openProduct(p.id)}
                    />
                  )
                )}
              </ScrollView>
            </View>

            {/* ── Popular with PG Residents ── */}
            <ProductRow
              title="Popular with PG Residents"
              products={popularProducts}
              onProductPress={(p) => openProduct(p.id)}
              onSeeAllPress={() => openSupplyCategory(null)}
            />

            {/* ── Dynamic Category Rows ── */}
            {vegetablesList.length > 0 && (
              <ProductRow
                title="Fresh Vegetables"
                products={vegetablesList}
                onProductPress={(p) => openProduct(p.id)}
                onSeeAllPress={() => openSupplyCategory('Vegetables')}
              />
            )}
            
            {leafyItemsList.length > 0 && (
              <ProductRow
                title="Leafy Items"
                products={leafyItemsList}
                onProductPress={(p) => openProduct(p.id)}
                onSeeAllPress={() => openSupplyCategory('Leafy Items')}
              />
            )}

            {dairyAndEggsList.length > 0 && (
              <ProductRow
                title="Dairy & Eggs"
                products={dairyAndEggsList}
                onProductPress={(p) => openProduct(p.id)}
                onSeeAllPress={() => openSupplyCategory('Dairy & Eggs')}
              />
            )}

            {meatsList.length > 0 && (
              <ProductRow
                title="Meats & Poultry"
                products={meatsList}
                onProductPress={(p) => openProduct(p.id)}
                onSeeAllPress={() => openSupplyCategory('Meats')}
              />
            )}

            {/* ── Recommended for You ── */}
            <ProductRow
              title="Recommended for You"
              products={recommendedProducts}
              onProductPress={(p) => openProduct(p.id)}
              onSeeAllPress={() => openSupplyCategory(null)}
            />
            </View>
          </>
        )}
      </FormScroll>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GroceryColors.primaryDark,
  },
  scrollContent: {
    // Transparent so the green container shows through for the top half
  },
  bottomWhiteSection: {
    backgroundColor: GroceryColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 120, // Moved from scrollContent
  },

  errorWrapper: {
    backgroundColor: GroceryColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 120,
    minHeight: '100%',
  },
  searchResultsWrapper: {
    backgroundColor: GroceryColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120, // Add padding bottom here
    minHeight: '100%',
  },

  searchResultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  dealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  noResultsBox: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  sectionContainer: {
    marginTop: 20,
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  horizontalListContent: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: GroceryColors.textSecondary,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: GroceryColors.primary,
  },
  searchResultsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: GroceryColors.textMuted,
    marginBottom: 12,
  },
  noResultsText: {
    fontSize: 14,
    color: GroceryColors.textMuted,
    fontWeight: '600',
  },
});
