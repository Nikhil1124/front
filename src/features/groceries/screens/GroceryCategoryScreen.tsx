import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, useWindowDimensions, StatusBar, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { mockCategories, mockProducts, getProductsByCategory, Category } from '../data/mockProducts';
import { ProductCard } from '../components/grocery/ProductCard';
import { useCartStore } from '../store/useCartStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { Colors, Layout, Radii } from '@/theme';
import { FormScroll } from '@/components/ui/FormScroll';

// Section Grouping Definition
interface CategoryGroup {
  id: string;
  title: string;
  categoryIds: string[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'grocery-kitchen',
    title: 'Grocery & Kitchen',
    categoryIds: [
      'cat-fruitsveg',
      'cat-flours',
      'cat-oils',
      'cat-dairy',
      'cat-bakery',
      'cat-pulses',
      'cat-chicken',
      'cat-addons',
    ],
  },
  {
    id: 'snacks-drinks',
    title: 'Snacks & Drinks',
    categoryIds: [
      'cat-canned',
      'cat-sweets',
      'cat-beverages',
      'cat-frozen',
      'cat-sauces',
    ],
  },
  {
    id: 'household-essentials',
    title: 'Household & Essentials',
    categoryIds: [
      'cat-cleaning',
      'cat-packaging',
      'cat-custom',
    ],
  },
];

// Map section filter keys → display info
const SECTION_FILTERS: Record<string, { label: string; icon: string; categoryNames: string[] }> = {
  deals: {
    label: "Today's Deals",
    icon: '🔥',
    categoryNames: [],
  },
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

export function GroceryCategoryScreen() {
  // Hardware back / iOS swipe-back are handled by the Stack navigator itself now — no manual
  // BackHandler listener needed, unlike the old custom screen-stack this replaced.
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { name: initialCategory } = useLocalSearchParams<{ name?: string }>();
  const filter: string | undefined = undefined;

  const mode = useShoppingModeStore((s) => s.mode);
  const getCartTotal = useCartStore((s) => s.getCartTotal);
  const cartItemCount = useCartStore((s) => s.getItemCount());

  // Active category state (null = show category section groups; string = show products of that category)
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory ?? null);
  const [search, setSearch] = useState('');

  // Determine if a section filter param exists
  const sectionFilter = filter ? SECTION_FILTERS[filter] : null;

  // Products for the active category (or deals)
  const products = useMemo(() => {
    let list = activeCategory
      ? getProductsByCategory(activeCategory, mode)
      : filter === 'deals'
      ? mockProducts.filter((p) => {
          const opts = mode === 'owner' ? p.ownerOptions : p.guestOptions;
          return opts.some((o) => o.originalPrice && o.originalPrice > o.price);
        })
      : search.trim()
      ? mockProducts
      : [];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, filter, mode, search]);

  const showProductList = activeCategory !== null || filter === 'deals' || search.trim().length > 0;

  // 4 items per row grid math matching the photo
  const cardGap = 10;
  const paddingHorizontal = 16;
  const itemWidth = (width - (paddingHorizontal * 2) - (cardGap * 3)) / 4;

  const productCardWidth = (width - 36) / 2;

  // Render a single category item card in the 4-column layout
  const renderCategoryItem = (cat: Category) => (
    <TouchableOpacity
      key={cat.id}
      style={[styles.catItem, { width: itemWidth }]}
      activeOpacity={0.85}
      onPress={() => setActiveCategory(cat.name)}
    >
      <View style={[styles.imageContainer, { width: itemWidth, height: itemWidth, backgroundColor: cat.bgColor || '#EBF6F6' }]}>
        <Image
          source={typeof cat.image === 'string' ? { uri: cat.image } : cat.image}
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
      <StatusBar barStyle="dark-content" backgroundColor={Colors.canvas} />

      <View style={{ flex: 1 }}>
        {/* Top Header Search Bar */}
        <View style={styles.topHeader}>
          {showProductList ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (activeCategory) {
                  setActiveCategory(null);
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

        {/* Active Filter Chip indicator */}
        {!showProductList && sectionFilter && (
          <View style={styles.chipRow}>
            <View style={styles.activeChip}>
              <Text style={styles.activeChipText}>{sectionFilter.icon} {sectionFilter.label}</Text>
              <TouchableOpacity onPress={() => setActiveCategory(null)}>
                <Ionicons name="close" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Title Banner when viewing an active category product grid */}
        {showProductList && (
          <View style={styles.activeCategoryHeader}>
            <Text style={styles.activeCategoryTitle}>{activeCategory || sectionFilter?.label || 'Products'}</Text>
            <Text style={styles.activeCategorySub}>{products.length} items available</Text>
          </View>
        )}

        {/* MAIN CONTENT AREA */}
        {!showProductList ? (
          /* ── CATEGORY SECTION GROUPS (Blinkit Style 4-Column Layout) ── */
          <FormScroll
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sectionsScrollContent}
          >
            {CATEGORY_GROUPS.map((group) => {
              // Get categories belonging to this section
              const groupCats = mockCategories.filter((c) => group.categoryIds.includes(c.id));
              if (groupCats.length === 0) return null;

              // If a filter is applied, filter categories accordingly
              const filteredGroupCats = sectionFilter && sectionFilter.categoryNames.length > 0
                ? groupCats.filter((c) => sectionFilter.categoryNames.includes(c.name))
                : groupCats;

              if (filteredGroupCats.length === 0) return null;

              return (
                <View key={group.id} style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>{group.title}</Text>
                  <View style={styles.gridRow}>
                    {filteredGroupCats.map(renderCategoryItem)}
                  </View>
                </View>
              );
            })}
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
  activeCategoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  activeCategoryTitle: {
    fontSize: 20,
    color: Colors.textPrimary,
  },
  activeCategorySub: {
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
