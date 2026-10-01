import { useEffect, useMemo, useState } from 'react';
import { toAmount } from '@/data/mappers';
import { useQueryClient } from '@tanstack/react-query';
import {
  Linking,
  RefreshControl,
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
import { PromotionalBanner } from '../components/grocery/PromotionalBanner';
import { PromoCards } from '../components/grocery/PromoCards';
import { QuickCategoryRow } from '../components/grocery/QuickCategoryRow';
import { DussehraPromoLayer } from '../components/grocery/DussehraPromoLayer';
import { FloatingCartBar } from '../components/FloatingCartBar';
import { groupByVariant } from '../variantGroups';
import { useSupplyCategories, useSupplyItems } from '../useSupply';
import { PGowApiError } from '@/data/apiClient';
import { useStorefront, type StorefrontLink, type StorefrontSection } from '../useStorefront';

import { useCartStore } from '../store/useCartStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { GroceryColors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';

/**
 * Home/catalog screen. Shopping mode is decided by role (Owner/Manager/Chef → bulk;
 * Guest → personal). No manual toggle UI needed.
 */
import { useActiveProperty } from '@/features/properties/useProperties';
import { ErrorState, LoadingState, Txt } from '@/components/ui';

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
  // The home's layout — banners, cards, rows, headings, colours — comes from the backend.
  const {
    data: storefront,
    isLoading: storefrontLoading,
    error: storefrontError,
    refetch: refetchStorefront,
  } = useStorefront(activePgId ?? undefined);

  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await Promise.all([
      refetchItems(),
      refetchCategories(),
      refetchStorefront(),
      queryClient.invalidateQueries({ queryKey: ['kitchen_menu', activePgId ?? undefined] }),
    ]);
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  // The chip chosen along the top: a category id, or null for All.
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const isBulkRole = activeRole === 'OWNER' || activeRole === 'MANAGER' || activeRole === 'CHEF';
    setMode(isBulkRole ? 'owner' : 'guest');
    const pgOwner = isBulkRole ? owner : ownerForGuest;
    if (pgOwner) setPgDetails(pgOwner.pgName, pgOwner.address);
  }, [activeRole, owner, ownerForGuest, setMode, setPgDetails]);

  const itemsById = useMemo(() => new Map(supplyItems.map((i) => [i.id, i])), [supplyItems]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const activeCategory = activeCategoryId ? categoriesById.get(activeCategoryId) ?? null : null;

  const hasActiveFilters =
    filters.sort !== 'popular' || filters.maxPrice !== undefined || filters.onDealOnly === true;

  const searchResults = useMemo(() => {
    let list = supplyItems;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // A product's own name, or its category's ("dairy" finds the whole Dairy shelf).
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (categoriesById.get(p.category_id)?.name.toLowerCase().includes(q) ?? false)
      );
    } else if (activeCategoryId) {
      list = list.filter((p) => p.category_id === activeCategoryId);
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
    activeCategoryId,
    categoriesById,
  ]);

  // One card per product. The count below follows it: "142 products in Vegetables" over a grid
  // of 36 cards is a number nothing on screen can account for.
  const searchFamilies = useMemo(() => groupByVariant(searchResults), [searchResults]);
  const isSearching = searchQuery.trim().length > 0 || hasActiveFilters || activeCategoryId !== null;

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

  /** Where a tap on a banner, card or "See All" goes — set per block in the portal. */
  const followLink = (link: StorefrontLink) => {
    switch (link.type) {
      case 'category':
        openSupplyCategory(categoriesById.get(link.target_id)?.name ?? null);
        break;
      case 'item':
        openProduct(link.target_id);
        break;
      case 'deals':
        openDeals();
        break;
      case 'all_products':
        openSupplyCategory(null);
        break;
      case 'url':
        Linking.openURL(link.url).catch(() => {});
        break;
      default:
        break;
    }
  };

  // The header takes the leading banner's colour; links on white use it too — it is dark
  // enough for white text, so it is readable as text on white as well.
  const themeColor = storefront?.theme.primary_color ?? null;
  const accentColor = themeColor ?? GroceryColors.primary;

  const renderSection = (section: StorefrontSection, onColour: boolean) => {
    switch (section.kind) {
      case 'hero':
      case 'banner':
        return (
          <PromotionalBanner
            key={section.id}
            variant={section.kind}
            imageUrl={section.data.image_url}
            builtinImage={section.data.builtin_image}
            onPress={() => followLink(section.data.link)}
          />
        );
      case 'promo_cards':
        return (
          <View key={section.id} style={styles.promoCardsWrap}>
            {section.title ? (
              <Txt
                maxFontSizeMultiplier={1.3}
                style={[styles.promoHeading, { color: onColour ? GroceryColors.white : GroceryColors.textPrimary }]}
              >
                {section.title}
              </Txt>
            ) : null}
            <PromoCards cards={section.data.cards} onCardPress={(card) => followLink(card.link)} />
          </View>
        );
      case 'categories': {
        const chosen = section.data.category_ids.length
          ? section.data.category_ids.flatMap((id) => categoriesById.get(id) ?? [])
          : categories;
        return (
          <SupplyCategoryGrid
            key={section.id}
            categories={chosen}
            title={section.title}
            columns={section.data.columns}
            accentColor={accentColor}
            onSupplyCategoryPress={(cat) => openSupplyCategory(cat.name)}
            onSeeAllPress={() => openSupplyCategory(null)}
          />
        );
      }
      case 'products':
        return (
          <ProductRow
            key={section.id}
            title={section.title}
            subtitle={section.subtitle}
            products={section.data.item_ids.flatMap((id) => itemsById.get(id) ?? [])}
            layout={section.data.layout}
            columns={section.data.columns}
            accentColor={accentColor}
            onProductPress={(p) => openProduct(p.id)}
            onSeeAllPress={() => followLink(section.data.see_all)}
          />
        );
      default:
        // A block this version of the app does not know yet: skipped, not a crash.
        return null;
    }
  };

  // Leading banners and promo cards sit on the coloured top; from the first other block on,
  // everything is on the white sheet — in the portal's order either way.
  const sections = storefront?.sections ?? [];
  const firstOnSheet = sections.findIndex((s) => s.kind !== 'hero' && s.kind !== 'promo_cards');
  const topSections = firstOnSheet === -1 ? sections : sections.slice(0, firstOnSheet);
  const sheetSections = firstOnSheet === -1 ? [] : sections.slice(firstOnSheet);
  /**
   * Sparkles ride the banner, rather than running for ever.
   *
   * The layer was rendered unconditionally, so a festival's decoration stayed on the screen
   * long after the festival — in December as much as in October. The server only sends
   * sections that are live (`_is_live` honours `is_active` and the start/end dates) and the
   * built-in layout carries no hero at all, so a hero arriving here means somebody put a
   * banner up on purpose. Tying the two together means the decoration turns up with the
   * banner and leaves when its schedule ends, with nothing to remember to switch off.
   */
  const hasBanner = sections.some((s) => s.kind === 'hero');
  const deliveryLabel =
    owner || ownerForGuest
      ? `${(owner ?? ownerForGuest)?.pgName}`
      : 'Your PG';

  return (
    <View style={[styles.container, { backgroundColor: themeColor ?? GroceryColors.primaryDark }]}>
      {hasBanner && <DussehraPromoLayer />}
      {/* ── Green Header ── */}
      <Header
        deliveryLabel={deliveryLabel}
        cartItemCount={cartItemCount}
        onCartPress={openCart}
        onSubscriptionsPress={() => router.push('/groceries/subscriptions')}
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
      {(!isSearching || activeCategoryId !== null) && (
        <QuickCategoryRow
          categories={categories}
          activeId={activeCategoryId}
          onSelect={setActiveCategoryId}
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
                ? `${searchFamilies.length} products ${searchQuery ? `for "${searchQuery}"` : activeCategory ? `in ${activeCategory.name}` : 'found'}`
                : `No products ${searchQuery ? `for "${searchQuery}"` : activeCategory ? `in ${activeCategory.name}` : 'found'}`}
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
        ) : itemsLoading || storefrontLoading ? (
          <View style={styles.errorWrapper}>
            <LoadingState label="Loading catalog…" fill={false} />
          </View>
        ) : storefrontError ? (
          /* The layout did not load but the catalog did: the categories are still a real way
             in, so show those rather than a dead end. Nothing made up in between. */
          <View style={styles.bottomWhiteSection}>
            <SupplyCategoryGrid
              categories={categories}
              title="Shop by category"
              columns={4}
              accentColor={GroceryColors.primary}
              onSupplyCategoryPress={(cat) => openSupplyCategory(cat.name)}
              onSeeAllPress={() => openSupplyCategory(null)}
            />
          </View>
        ) : (
          <>
            {topSections.map((section) => renderSection(section, true))}

            <View style={styles.bottomWhiteSection}>
              {sheetSections.map((section) => renderSection(section, false))}
              
              {/* ── PGow Brand Footer ── */}
              <View style={styles.footerBrand}>
                <Ionicons name="leaf" size={28} color="#00845B" />
                <Txt maxFontSizeMultiplier={1.3} style={styles.footerBrandTitle}>PGow Grocery</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.footerBrandSub}>Fresh & Fast • Delivered to your PG</Txt>
              </View>
            </View>
          </>
        )}
      </FormScroll>

      <FloatingCartBar />
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
    paddingTop: 24,
    paddingBottom: 60, // Reduced padding since the footer takes up space
  },
  footerBrand: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 60, // Shifted some of the padding here so the floating cart doesn't cover it
    opacity: 0.6,
  },
  footerBrandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00845B',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  footerBrandSub: {
    fontSize: 11,
    color: GroceryColors.textMuted,
    marginTop: 4,
    fontWeight: '600',
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
  noResultsBox: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  promoCardsWrap: {
    marginTop: 16,
    marginBottom: 16,
    zIndex: 10,
  },
  promoHeading: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 8,
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
