import { SupplyCategory } from '@/types';
import { toAmount } from '@/data/mappers';
import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  useWindowDimensions,
  TextInput,
  RefreshControl,
} from 'react-native';
import { FormScroll } from '@/components/ui/FormScroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { categoryPicture, categoryTint } from '../categoryVisuals';
import { Ionicons } from '@expo/vector-icons';

import { ProductCard } from '../components/grocery/ProductCard';
import { useSupplyCategories, useSupplyItems } from '../useSupply';
import { groupByVariant } from '../variantGroups';
import { useAuthStore } from '@/store/authStore';
import { Colors, GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';
import { FloatingCartBar } from '../components/FloatingCartBar';

// Map section filter keys → display info
/** `deals` is the only one of these the app ever pushes — `openDeals()` in GroceriesScreen is
 *  the single caller. `essentials` and `kitchen` sat here with category lists naming the old
 *  mock catalogue, unreachable and unmatchable both. */
const SECTION_FILTERS: Record<string, { label: string; icon: string }> = {
  deals: { label: "Today's Deals", icon: '🔥' },
};



export function GroceryCategoryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { name: initialSupplyCategory, filter } = useLocalSearchParams<{
    name?: string;
    filter?: string;
  }>();

  const activePgId = useAuthStore((s) => s.activePgId) ?? undefined;
  const { data: supplyItems = [], refetch: refetchItems, isRefetching: isRefetchingItems } =
    useSupplyItems(activePgId);
  const { data: categories = [], refetch: refetchCats, isRefetching: isRefetchingCats } =
    useSupplyCategories(activePgId);

  const isRefreshing = isRefetchingItems || isRefetchingCats;
  const handleRefresh = async () => {
    await Promise.all([refetchItems(), refetchCats()]);
  };

  const [activeSupplyCategory, setActiveSupplyCategory] = useState<string | null>(
    initialSupplyCategory ?? null
  );
  const [search, setSearch] = useState('');

  const sectionFilter = filter ? SECTION_FILTERS[filter] : null;

  const products = useMemo(() => {
    let list = activeSupplyCategory
      ? supplyItems.filter(
          (p) =>
            p.category_id === activeSupplyCategory ||
            categories.find(
              (c) => c.name === activeSupplyCategory && c.id === p.category_id
            ) !== undefined
        )
      : filter === 'deals'
      ? supplyItems.filter((p) => p.mrp != null && toAmount(p.mrp) > toAmount(p.price))
      : supplyItems;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category_id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeSupplyCategory, filter, search, supplyItems, categories]);

  // One card per product, not per pack: the catalogue sells "Onion (250 g)" and "Onion (1 kg)"
  // as separate rows, and the card turns a family into a size picker.
  const productFamilies = useMemo(() => groupByVariant(products), [products]);

  const showProductList = activeSupplyCategory !== null || filter === 'deals' || search.trim().length > 0;

  // 2-column grid. Was 3, which left a fourth category alone on a second row and shrank the
  // artwork to the point where two leafy greens were hard to tell apart.
  const catGap = 12;
  const catPadding = 32;
  const catCardWidth = (width - catPadding - catGap) / 2;

  const productCardWidth = (width - 44) / 2;

  const renderSupplyCategoryItem = (cat: SupplyCategory) => (
    <AnimatedPress
      key={cat.id}
      accessibilityRole="button"
      accessibilityLabel={cat.name}
      style={[styles.catItem, { width: catCardWidth }]}
      onPress={() => setActiveSupplyCategory(cat.name)}
    >
      <View
        style={[
          styles.catImageContainer,
          { height: catCardWidth * 0.82, backgroundColor: categoryTint(cat) },
        ]}
      >
        <Image source={categoryPicture(cat)} style={styles.catImage} resizeMode="contain" />
      </View>
      <View style={styles.catLabelStrip}>
        <Txt maxFontSizeMultiplier={1.2} style={styles.catTitle} numberOfLines={2}>
          {cat.name}
        </Txt>
      </View>
    </AnimatedPress>
  );

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 10 }]}>
        <AnimatedPress
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backBtn}
          onPress={() => {
            if (activeSupplyCategory) {
              setActiveSupplyCategory(null);
              setSearch('');
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color={GroceryColors.textPrimary} />
        </AnimatedPress>

        {showProductList ? (
          <Txt maxFontSizeMultiplier={1.2} style={styles.headerTitle} numberOfLines={1}>
            {activeSupplyCategory || sectionFilter?.label || 'Products'}
          </Txt>
        ) : (
          <Txt maxFontSizeMultiplier={1.2} style={styles.headerTitle}>
            Categories
          </Txt>
        )}

        {/* A search icon button with `onPress={() => {}}` used to sit here, directly above
            the real search field a few lines below. It announced itself to TalkBack as a
            button, sprang under a finger, and did nothing. */}
      </View>

      {/* ── Search Field ── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={GroceryColors.textMuted} />
          <TextInput
            maxFontSizeMultiplier={1.3}
            style={styles.searchInput}
            placeholder={
              showProductList
                ? 'Search products in category...'
                : 'Search in categories...'
            }
            placeholderTextColor={GroceryColors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <AnimatedPress
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="button"
              onPress={() => setSearch('')}
            >
              <Ionicons name="close-circle" size={16} color={GroceryColors.textMuted} />
            </AnimatedPress>
          )}
        </View>
      </View>

      {/* ── Product count banner when viewing category ── */}
      {showProductList && (
        <View style={styles.categoryBanner}>
          <Txt maxFontSizeMultiplier={1.2} style={styles.categoryBannerSub}>
            {productFamilies.length} item{productFamilies.length !== 1 ? 's' : ''} available
          </Txt>
        </View>
      )}

      {/* ── Main Content ── */}
      {!showProductList ? (
        <FormScroll
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sectionsScrollContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        >
          {/* One grid, no section headings.
              This was a `NAMED_GROUPS` table sorting categories into "Grocery & Kitchen",
              "Snacks & Drinks" and "Household & Essentials", with anything it could not place
              falling into "More Categories". Every name in that table came from the old mock
              catalogue ('Atta, Rice & Dal', 'Cleaning Supplies', 'Frozen Foods') and none of
              them survives in the real one, so against the four categories actually stocked it
              matched "Vegetables" and "Chicken" and dropped "Leafy Vegetables" and
              "Dairy & Eggs" into "More Categories" — two headings inventing a split between
              four items that belong together. Four tiles need no taxonomy. */}
          <View style={styles.gridRow}>{categories.map(renderSupplyCategoryItem)}</View>

          {/* A "Healthy Choices / Happier You" banner sat here. Its one button searched for
              "organic", a word no item in this catalogue carries, so it always landed on an
              empty result — and the categories above are the reason to be on this screen. */}
        </FormScroll>
      ) : (
        /* ── Product Grid ── */
        <>
          {/* Deals hero banner */}
          {filter === 'deals' && (
            <View style={styles.dealsBanner}>
              <View style={styles.dealsBannerLeft}>
                <Txt maxFontSizeMultiplier={1.1} style={styles.dealsMegaLabel}>MEGA</Txt>
                <Txt maxFontSizeMultiplier={1.1} style={styles.dealsMegaSale}>SALE</Txt>
                <Txt maxFontSizeMultiplier={1.1} style={styles.dealsSubLabel}>UP TO 80% OFF</Txt>
                {/* No "Shop Now" button: it had no `onPress`, and the deals it would open
                    are the grid directly below it. */}
              </View>
              <Image
                source={require('../../../../assets/food_savings_banner.webp')}
                style={styles.dealsBannerImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* One chip, and it is a label rather than a control.
              This was four — All Deals / Fresh Picks / Pantry / Snacks — rendered as plain
              `View`s with `tab === 'All Deals'` hardcoded as the active one. None of them was
              pressable and none of them filtered anything: three names of categories this
              catalogue does not stock, sitting under a heading that says what the list
              already is. */}
          {filter === 'deals' && (
            <View style={styles.filterTabsScroll}>
              <View style={[styles.filterTab, styles.filterTabActive]}>
                <Txt maxFontSizeMultiplier={1.2} style={[styles.filterTabText, styles.filterTabTextActive]}>
                  All Deals
                </Txt>
              </View>
            </View>
          )}

          <FlatList
            data={productFamilies}
            keyExtractor={(family) => family[0].id}
            numColumns={2}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Txt maxFontSizeMultiplier={1.3} style={styles.emptyIcon}>🔍</Txt>
                <Txt maxFontSizeMultiplier={1.3} style={styles.emptyText}>No products found</Txt>
              </View>
            }
            renderItem={({ item: family }) => (
              <View style={{ width: productCardWidth }}>
                <ProductCard
                  product={family[0]}
                  variants={family}
                  onPress={(p) =>
                    router.push({ pathname: '/groceries/product/[id]', params: { id: p.id } })
                  }
                  style={{ width: '100%', marginRight: 0 }}
                />
              </View>
            )}
          />
        </>
      )}

      {/* ── Floating cart bar ── */}
      <FloatingCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GroceryColors.background,
  },

  // ── Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: GroceryColors.white,
    borderBottomWidth: 1,
    borderBottomColor: GroceryColors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
    textAlign: 'center',
  },

  // ── Search ──
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: GroceryColors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GroceryColors.background,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: GroceryColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: GroceryColors.textPrimary,
    padding: 0,
  },

  // ── Category banner ──
  categoryBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: GroceryColors.background,
  },
  categoryBannerSub: {
    fontSize: 12,
    color: GroceryColors.textSecondary,
  },

  // ── Category sections ──
  sectionsScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catItem: {
    marginBottom: 14,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: GroceryColors.surface,
    overflow: 'hidden',
  },
  catImageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catImage: {
    width: '72%',
    height: '82%',
  },
  catLabelStrip: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  catTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
    textAlign: 'center',
    lineHeight: 17,
  },

  // ── Promo banner ──

  // ── Deals hero banner ──
  dealsBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: Radii.card,
    backgroundColor: GroceryColors.primaryDark,
    flexDirection: 'row',
    overflow: 'hidden',
    height: 120,
  },
  dealsBannerLeft: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  dealsMegaLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 2,
  },
  dealsMegaSale: {
    fontSize: 26,
    fontWeight: '900',
    color: GroceryColors.white,
    lineHeight: 30,
  },
  dealsSubLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    marginBottom: 8,
  },
  dealsBannerImage: {
    width: '42%',
  },

  // ── Filter tabs ──
  filterTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: GroceryColors.border,
    backgroundColor: GroceryColors.white,
  },
  filterTabActive: {
    backgroundColor: GroceryColors.primary,
    borderColor: GroceryColors.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: GroceryColors.textSecondary,
  },
  filterTabTextActive: {
    color: GroceryColors.white,
    fontWeight: '700',
  },

  // ── Product grid ──
  gridContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 120,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    fontSize: 15,
    color: GroceryColors.textMuted,
  },
});
