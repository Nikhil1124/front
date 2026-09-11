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
import { groupByVariant } from '../variantGroups';
import { useSupplyCategories, useSupplyItems, useDeals } from '../useSupply';
import { PGowApiError } from '@/data/apiClient';

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

  /**
   * Items in whichever categories match a predicate on the category NAME.
   *
   * All four lists below used to test `p.category_id.toLowerCase().includes('vegetable')`.
   * `category_id` is a UUID (`schemas.py` types it `uuid.UUID`), and a UUID never contains
   * the word "vegetable" — so every one of these lists was permanently empty, which is why
   * the quick-category chips reported "No products in Vegetables" and the home screen's
   * category sections never rendered. The name lives on the category, so the name is what
   * has to be matched, and the ids it resolves to are what the items carry.
   */
  const itemsInCategories = useMemo(
    () => (matches: (name: string) => boolean) => {
      const ids = new Set(categories.filter((c) => matches(c.name.toLowerCase())).map((c) => c.id));
      return supplyItems.filter((p) => ids.has(p.category_id));
    },
    [supplyItems, categories],
  );

  // "Leafy Vegetables" contains "vegetable", so plain Vegetables has to exclude it or the two
  // chips would show the same list.
  const vegetablesList = useMemo(
    () => itemsInCategories((n) => n.includes('vegetable') && !n.includes('leafy')),
    [itemsInCategories],
  );
  const leafyItemsList = useMemo(() => itemsInCategories((n) => n.includes('leafy')), [itemsInCategories]);
  const dairyAndEggsList = useMemo(
    () => itemsInCategories((n) => n.includes('dairy') || n.includes('egg')),
    [itemsInCategories],
  );
  // The catalogue's meat category is named "Chicken"; keep the other two so a later "Mutton"
  // or "Fish" category lands here without another edit.
  const meatsList = useMemo(
    () => itemsInCategories((n) => n.includes('meat') || n.includes('chicken') || n.includes('fish')),
    [itemsInCategories],
  );

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
  }, [
    searchQuery,
    filters,
    hasActiveFilters,
    supplyItems,
    activeQuickCategory,
    vegetablesList,
    leafyItemsList,
    dairyAndEggsList,
    meatsList,
  ]);

  // One card per product. The count below follows it: "142 products in Vegetables" over a grid
  // of 36 cards is a number nothing on screen can account for.
  const searchFamilies = useMemo(() => groupByVariant(searchResults), [searchResults]);
  // Group BEFORE slicing, always: slicing pack rows first can cut a family in half and leave a
  // card offering "1 kg, 2 kg" for a product whose 250 g and 500 g packs fell off the end.
  const dealFamilies = useMemo(() => groupByVariant(deals), [deals]);
  const essentialFamilies = useMemo(
    () => groupByVariant(dailyEssentials.length > 0 ? dailyEssentials : supplyItems),
    [dailyEssentials, supplyItems],
  );
  const allFamilies = useMemo(() => groupByVariant(supplyItems), [supplyItems]);

  const isSearching = searchQuery.trim().length > 0 || hasActiveFilters || activeQuickCategory !== null;

  /**
   * AREA_NOT_SERVICED is not a failure — it is an answer. The server is saying this property
   * has no warehouse within range (`area_id IS NULL`, or an area with no hub), which no
   * amount of retrying changes. Offering "Tap to retry" on it invites someone to sit there
   * pulling a lever that is wired to nothing.
   *
   * The browse branch below already said this; the search branch did not, so tapping a quick
   * category on an unserved property swapped the honest message for "Could not load the
   * catalog" and a retry. One helper now, so the two cannot drift apart again.
   */
  const catalogError = useMemo(() => {
    if (!itemsError) return null;
    const unserved = itemsError instanceof PGowApiError && itemsError.code === 'AREA_NOT_SERVICED';
    return {
      title: unserved ? "Groceries aren't available here yet" : 'Could not load the catalog',
      onRetry: unserved ? undefined : refetchItems,
    };
  }, [itemsError, refetchItems]);

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
              {searchFamilies.length > 0
                ? `${searchFamilies.length} products ${searchQuery ? `for "${searchQuery}"` : activeQuickCategory ? `in ${activeQuickCategory}` : 'found'}`
                : `No products ${searchQuery ? `for "${searchQuery}"` : activeQuickCategory ? `in ${activeQuickCategory}` : 'found'}`}
            </Txt>
            {itemsLoading ? (
              <LoadingState label="Loading catalog…" fill={false} />
            ) : catalogError ? (
              <ErrorState
                error={itemsError}
                title={catalogError.title}
                onRetry={catalogError.onRetry}
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
                {searchFamilies.map((family) => (
                  <View key={family[0].id} style={{ width: (width - 44) / 2 }}>
                    <ProductCard
                      product={family[0]}
                      variants={family}
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
              title={catalogError?.title ?? "Groceries aren't available here yet"}
              onRetry={catalogError?.onRetry}
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
              {/* "Today's Kitchen Needs" sat here (owner/chef only, the weekly menu planner
                  over `GET/PUT /v1/supply/kitchen-menu`). Removed from the shop home on
                  request. The planner's own components are still in
                  `components/kitchen/` and its endpoints are still live, so it can be
                  reinstated — or given its own screen — without rebuilding anything. */}

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
                  {dealFamilies.slice(0, 6).map((family) => (
                    <View key={family[0].id} style={{ width: (width - 44) / 2 }}>
                      <ProductCard
                        product={family[0]}
                        variants={family}
                        layout="deal"
                        onPress={(p) => openProduct(p.id)}
                        style={{ width: '100%', marginRight: 0 }}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
                  {allFamilies.slice(0, 4).map((family) => (
                    <ProductCard
                      key={family[0].id}
                      product={family[0]}
                      variants={family}
                      layout="deal"
                      onPress={(p) => openProduct(p.id)}
                    />
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
                {essentialFamilies.slice(0, 8).map((family) => (
                  <ProductCard
                    key={family[0].id}
                    product={family[0]}
                    variants={family}
                    layout="simple"
                    onPress={(p) => openProduct(p.id)}
                  />
                ))}
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
                onSeeAllPress={() => openSupplyCategory('Leafy Vegetables')}
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
                onSeeAllPress={() => openSupplyCategory('Chicken')}
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
