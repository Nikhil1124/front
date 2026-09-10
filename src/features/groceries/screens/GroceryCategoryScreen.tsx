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
  ScrollView,
} from 'react-native';
import { FormScroll } from '@/components/ui/FormScroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ProductCard } from '../components/grocery/ProductCard';
import { useCartStore } from '../store/useCartStore';
import { useSupplyCategories, useSupplyItems } from '../useSupply';
import { useAuthStore } from '@/store/authStore';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

// Map section filter keys → display info
const SECTION_FILTERS: Record<string, { label: string; icon: string; categoryNames: string[] }> = {
  deals: { label: "Today's Deals", icon: '🔥', categoryNames: [] },
  essentials: {
    label: 'Daily Essentials',
    icon: '🛒',
    categoryNames: ['Dairy, Bread & Eggs', 'Atta, Rice & Dal', 'Oil, Ghee & Masala'],
  },
  kitchen: {
    label: "Today's Kitchen Needs",
    icon: '🍳',
    categoryNames: ['Vegetables & Fruits', 'Oil, Ghee & Masala', 'Chicken, Meat & Fish', 'PG Kitchen Needs'],
  },
};

// Category name → grocery image asset
const getCategoryImage = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('fruit') || n.includes('veg'))
    return require('../../../../assets/productimages/cat_fruits_veg_nobg.webp');
  if (n.includes('dairy') || n.includes('milk') || n.includes('bread') || n.includes('egg'))
    return require('../../../../assets/productimages/cat_dairy_nobg.webp');
  if (n.includes('chicken') || n.includes('meat') || n.includes('fish'))
    return require('../../../../assets/productimages/cat_chicken_eggs_nobg.webp');
  if (n.includes('oil') || n.includes('masala') || n.includes('ghee') || n.includes('spice') || n.includes('atta') || n.includes('rice') || n.includes('dal'))
    return require('../../../../assets/productimages/cat_masala_nobg.webp');
  return require('../../../../assets/productimages/cat_addons_nobg.webp');
};

const getCategoryBg = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('fruit') || n.includes('veg')) return '#EDF7ED';
  if (n.includes('dairy') || n.includes('milk') || n.includes('bread')) return '#FFF8ED';
  if (n.includes('chicken') || n.includes('meat') || n.includes('egg')) return '#FFF0ED';
  if (n.includes('oil') || n.includes('masala') || n.includes('ghee')) return '#FFF8ED';
  if (n.includes('snack') || n.includes('beverage')) return '#F0F4FF';
  return GroceryColors.lightGreen;
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

  const getCartTotal = useCartStore((s) => s.getCartTotal);
  const cartItemCount = useCartStore((s) => s.getItemCount());

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

  const showProductList = activeSupplyCategory !== null || filter === 'deals' || search.trim().length > 0;

  // 3-column grid math for categories screen
  const catGap = 10;
  const catPadding = 32;
  const catCardWidth = (width - catPadding - catGap * 2) / 3;

  const productCardWidth = (width - 44) / 2;

  const renderSupplyCategoryItem = (cat: SupplyCategory) => (
    <AnimatedPress
      key={cat.id}
      accessibilityRole="button"
      style={[styles.catItem, { width: catCardWidth }]}
      onPress={() => setActiveSupplyCategory(cat.name)}
    >
      <View
        style={[
          styles.catImageContainer,
          { width: catCardWidth, height: catCardWidth, backgroundColor: getCategoryBg(cat.name) },
        ]}
      >
        <Image
          source={getCategoryImage(cat.name)}
          style={styles.catImage}
          resizeMode="contain"
        />
      </View>
      <Txt maxFontSizeMultiplier={1.2} style={styles.catTitle} numberOfLines={2}>
        {cat.name}
      </Txt>
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
            {products.length} item{products.length !== 1 ? 's' : ''} available
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
          {(() => {
            const NAMED_GROUPS: { title: string; names: string[] }[] = [
              {
                title: 'Grocery & Kitchen',
                names: [
                  'Vegetables & Fruits', 'Fruits & Vegetables',
                  'Atta, Rice & Dal', 'Dal, Atta & Rice',
                  'Dairy, Bread & Eggs', 'Eggs, Bread & Dairy',
                  'Oil, Ghee & Masala', 'Oils & Masala',
                  'Chicken, Meat & Fish', 'Meat & Fish',
                  'PG Kitchen Needs', 'Kitchen Essentials',
                ],
              },
              {
                title: 'Snacks & Drinks',
                names: [
                  'Snacks', 'Beverages', 'Drinks',
                  'Frozen Foods', 'Sauces & Spreads', 'Sweets & Chocolates',
                  'Canned & Ready-to-eat',
                ],
              },
              {
                title: 'Household & Essentials',
                names: ['Cleaning Supplies', 'Household', 'Cleaning', 'Packaging', 'Custom Supplies'],
              },
            ];

            const claimedIds = new Set<string>();
            const grouped: { title: string; cats: SupplyCategory[] }[] = [];

            for (const g of NAMED_GROUPS) {
              const matched = categories.filter((c) =>
                g.names.some(
                  (n) =>
                    c.name.toLowerCase().includes(n.toLowerCase()) ||
                    n.toLowerCase().includes(c.name.toLowerCase())
                )
              );
              if (matched.length > 0) {
                matched.forEach((c) => claimedIds.add(c.id));
                const filtered =
                  sectionFilter && sectionFilter.categoryNames.length > 0
                    ? matched.filter((c) => sectionFilter.categoryNames.includes(c.name))
                    : matched;
                if (filtered.length > 0) grouped.push({ title: g.title, cats: filtered });
              }
            }

            const unclaimed = categories.filter((c) => !claimedIds.has(c.id));
            const unclaimedFiltered =
              sectionFilter && sectionFilter.categoryNames.length > 0
                ? unclaimed.filter((c) => sectionFilter.categoryNames.includes(c.name))
                : unclaimed;
            if (unclaimedFiltered.length > 0) {
              grouped.push({ title: 'More Categories', cats: unclaimedFiltered });
            }

            if (grouped.length === 0 && categories.length > 0) {
              grouped.push({ title: 'All Categories', cats: categories });
            }

            return grouped.map((g) => (
              <View key={g.title} style={styles.sectionBlock}>
                <Txt maxFontSizeMultiplier={1.2} style={styles.sectionHeading}>
                  {g.title}
                </Txt>
                <View style={styles.gridRow}>
                  {g.cats.map(renderSupplyCategoryItem)}
                </View>
              </View>
            ));
          })()}

          {/* ── Promo banner at bottom of categories ── */}
          <View style={styles.promoBanner}>
            <View style={styles.promoBannerLeft}>
              <Txt maxFontSizeMultiplier={1.1} style={styles.promoBannerTitle}>
                {'Healthy Choices\nHappier You'}
              </Txt>
              <AnimatedPress
                accessibilityRole="button"
                style={styles.promoBannerBtn}
                onPress={() => setSearch('organic')}
              >
                <Txt maxFontSizeMultiplier={1.1} style={styles.promoBannerBtnText}>
                  Explore Organic Products
                </Txt>
              </AnimatedPress>
            </View>
            <Image
              source={require('../../../../assets/pg_grocery_eggs_1785343431667.webp')}
              style={styles.promoBannerImage}
              resizeMode="cover"
            />
          </View>
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
                <AnimatedPress
                  accessibilityRole="button"
                  style={styles.dealsShopNowBtn}
                >
                  <Txt maxFontSizeMultiplier={1.1} style={styles.dealsShopNowText}>Shop Now →</Txt>
                </AnimatedPress>
              </View>
              <Image
                source={require('../../../../assets/food_savings_banner.webp')}
                style={styles.dealsBannerImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Filter tabs for deals */}
          {filter === 'deals' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterTabsScroll}
            >
              {['All Deals', 'Fresh Picks', 'Pantry', 'Snacks'].map((tab) => (
                <View key={tab} style={[styles.filterTab, tab === 'All Deals' && styles.filterTabActive]}>
                  <Txt
                    maxFontSizeMultiplier={1.2}
                    style={[styles.filterTabText, tab === 'All Deals' && styles.filterTabTextActive]}
                  >
                    {tab}
                  </Txt>
                </View>
              ))}
            </ScrollView>
          )}

          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
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
            renderItem={({ item }) => (
              <View style={{ width: productCardWidth }}>
                <ProductCard
                  product={item}
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
      {cartItemCount > 0 && (
        <View style={styles.floatingCartBar}>
          <AnimatedPress
            accessibilityRole="button"
            style={styles.floatingCart}
            onPress={() => router.push('/groceries/cart')}
          >
            <View style={styles.cartLeft}>
              <View style={styles.cartIconCircle}>
                <Ionicons name="cart" size={16} color={GroceryColors.white} />
              </View>
              <View>
                <Txt maxFontSizeMultiplier={1.2} style={styles.cartTotal}>
                  ₹{getCartTotal()}
                </Txt>
                <Txt maxFontSizeMultiplier={1.2} style={styles.cartSub}>
                  {cartItemCount} item{cartItemCount > 1 ? 's' : ''}
                </Txt>
              </View>
            </View>
            <View style={styles.viewCartBtn}>
              <Txt maxFontSizeMultiplier={1.2} style={styles.viewCartText}>
                View Cart →
              </Txt>
            </View>
          </AnimatedPress>
        </View>
      )}
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
  sectionBlock: {
    marginTop: 20,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catItem: {
    alignItems: 'center',
    marginBottom: 14,
  },
  catImageContainer: {
    borderRadius: Radii.card,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  catImage: {
    width: '80%',
    height: '80%',
  },
  catTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: GroceryColors.textPrimary,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 2,
  },

  // ── Promo banner ──
  promoBanner: {
    marginTop: 20,
    marginBottom: 8,
    borderRadius: Radii.card,
    backgroundColor: GroceryColors.primaryDark,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 120,
  },
  promoBannerLeft: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  promoBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: GroceryColors.white,
    lineHeight: 24,
    marginBottom: 12,
  },
  promoBannerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: GroceryColors.white,
    borderRadius: Radii.control,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  promoBannerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: GroceryColors.primaryDark,
  },
  promoBannerImage: {
    width: '40%',
  },

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
  dealsShopNowBtn: {
    alignSelf: 'flex-start',
    backgroundColor: GroceryColors.white,
    borderRadius: Radii.control,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dealsShopNowText: {
    fontSize: 11,
    fontWeight: '700',
    color: GroceryColors.primaryDark,
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

  // ── Floating cart ──
  floatingCartBar: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    shadowColor: GroceryColors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingCart: {
    backgroundColor: GroceryColors.primaryDark,
    borderRadius: Radii.sheet,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cartLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartIconCircle: {
    width: 34,
    height: 34,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: GroceryColors.white,
  },
  cartSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  viewCartBtn: {
    backgroundColor: GroceryColors.white,
    borderRadius: Radii.control,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  viewCartText: {
    color: GroceryColors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
});
