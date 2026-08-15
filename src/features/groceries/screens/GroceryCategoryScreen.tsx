import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  StatusBar,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { mockCategories, mockProducts, getProductsByCategory, Category } from '../data/mockProducts';
import { ProductCard } from '../components/grocery/ProductCard';
import { useCartStore } from '../store/useCartStore';
import { useShoppingModeStore } from '../store/useShoppingModeStore';
import { useGroceryUiStore } from '../store/useGroceryUiStore';
import { AppColors, AppFonts, AppRadius, AppShadow } from '../theme/AppColors';
import { usePGowStore } from '@/store/usePGowStore';

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
  const popScreen = usePGowStore((s) => s.popScreen);
  const pushScreen = usePGowStore((s) => s.pushScreen);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const initialCategory = useGroceryUiStore((s) => s.selectedCategoryName);
  const setSelectedProductId = useGroceryUiStore((s) => s.setSelectedProductId);
  const filter: string | undefined = undefined;

  const mode = useShoppingModeStore((s) => s.mode);
  const cartItems = useCartStore((s) => s.items);
  const getCartTotal = useCartStore((s) => s.getCartTotal);
  const cartItemCount = cartItems.reduce((t, i) => t + i.quantity, 0);

  // Active category state (null = show category section groups; string = show products of that category)
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory);
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
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.background} />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
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
                  popScreen();
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={AppColors.textPrimary} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color={AppColors.primary} />
            <TextInput
              style={styles.headerSearchInput}
              placeholder={showProductList ? "Search products in category..." : 'Search "eggs", "milk", "rice"...'}
              placeholderTextColor={AppColors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {!showProductList && (
              <Ionicons name="mic-outline" size={20} color={AppColors.textSecondary} />
            )}
            {search.length > 0 && showProductList && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={AppColors.textMuted} />
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
                <Ionicons name="close" size={14} color={AppColors.primary} />
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
          <ScrollView
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
          </ScrollView>
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
                  onPress={(p) => { setSelectedProductId(p.id); pushScreen('GROCERY_PRODUCT'); }}
                  style={{ width: '100%', marginRight: 0 }}
                />
              </View>
            )}
          />
        )}
      </SafeAreaView>

      {/* Floating Cart Bar */}
      {cartItemCount > 0 && (
        <View style={[styles.floatingCartContainer, { bottom: Math.max(insets.bottom + 85, 105) }]}>
          <TouchableOpacity
            style={styles.floatingCart}
            onPress={() => pushScreen('GROCERY_CART')}
            activeOpacity={0.9}
          >
            <BlurView
              intensity={80}
              tint="light"
              style={[StyleSheet.absoluteFillObject, { borderRadius: 32 }]}
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
    backgroundColor: AppColors.background,
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
    backgroundColor: AppColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...AppShadow.card,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...AppShadow.card,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: AppFonts.medium,
    color: AppColors.textPrimary,
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
    backgroundColor: AppColors.primaryLight,
    borderRadius: AppRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: AppColors.primary,
    gap: 6,
  },
  activeChipText: {
    fontFamily: AppFonts.bold,
    fontSize: 12,
    color: AppColors.primary,
  },
  activeCategoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  activeCategoryTitle: {
    fontSize: 20,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  activeCategorySub: {
    fontSize: 12,
    fontFamily: AppFonts.medium,
    color: AppColors.textSecondary,
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
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
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
    shadowColor: AppColors.textPrimary,
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
    fontFamily: AppFonts.bold,
    color: AppColors.textPrimary,
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
    fontFamily: AppFonts.semiBold,
    fontSize: 15,
    color: AppColors.textMuted,
  },
  floatingCartContainer: {
    position: 'absolute',
    alignSelf: 'center',
    width: '85%',
    ...AppShadow.modal,
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
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartTotal: {
    fontFamily: AppFonts.extraBold,
    fontSize: 14,
    color: AppColors.textPrimary,
  },
  cartSub: {
    fontFamily: AppFonts.medium,
    fontSize: 11,
    color: AppColors.textSecondary,
  },
  viewCartBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  viewCartText: {
    color: '#fff',
    fontFamily: AppFonts.extraBold,
    fontSize: 12,
  },
});
