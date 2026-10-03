// No types needed here
import { toAmount } from '@/data/mappers';
import { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  useWindowDimensions,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { categoryPicture } from '../categoryVisuals';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { ProductCard } from '../components/grocery/ProductCard';
import { useSupplyCategories, useSupplyItems } from '../useSupply';
import { groupByVariant } from '../variantGroups';
import { useAuthStore } from '@/store/authStore';
import { GroceryColors } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';
import { FloatingCartBar } from '../components/FloatingCartBar';

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

  /**
   * Take the category from the route every time this screen is shown, not only the first time.
   *
   * This screen is a TAB — `app/groceries/(tabs)/categories.tsx`, inside a `Tabs`/`TabSlot`
   * layout — so it mounts once and then stays mounted for the life of the mini-app. A
   * `useState` initialiser runs on that first mount and never again, so tapping Chicken on the
   * home screen and then tapping Dairy routed here both times and left the screen showing
   * Chicken: the param changed, the state did not. Whichever category was opened first was the
   * only one the catalogue ever showed, which reads as every category containing the same
   * products.
   *
   * On focus rather than on param change, because re-selecting the category you are already on
   * has to work too, and the param's value is identical in that case.
   *
   * A missing param means the Categories tab was tapped directly rather than a category chosen,
   * so the left rail's own selection stands — that is the one case where the screen's state is
   * the more recent intent.
   */
  useFocusEffect(
    useCallback(() => {
      if (initialSupplyCategory) setActiveSupplyCategory(initialSupplyCategory);
    }, [initialSupplyCategory])
  );

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
    return list;
  }, [activeSupplyCategory, filter, supplyItems, categories]);

  const productFamilies = useMemo(() => groupByVariant(products), [products]);

  const leftRailWidth = 85;
  const gridWidth = width - leftRailWidth;
  const productCardWidth = (gridWidth - 32) / 2; // 10px gap between 2 cards + padding

  // Static list for frequently bought
  const frequentlyBought = useMemo(() => {
    return supplyItems.slice(0, 4);
  }, [supplyItems]);

  const renderLeftRailItem = (catName: string | null, label: string, picture: any) => {
    const isActive = activeSupplyCategory === catName;
    return (
      <AnimatedPress
        key={label}
        accessibilityRole="button"
        style={[styles.railItem, isActive && styles.railItemActive]}
        onPress={() => setActiveSupplyCategory(catName)}
      >
        <View style={[styles.railIconBox, isActive && styles.railIconBoxActive]}>
          {picture ? (
             <Image source={picture} style={styles.railIcon} resizeMode="contain" />
          ) : (
            <MaterialCommunityIcons name="view-grid-outline" size={24} color={isActive ? GroceryColors.primary : GroceryColors.textSecondary} />
          )}
        </View>
        <Txt maxFontSizeMultiplier={1.1} style={[styles.railLabel, isActive && styles.railLabelActive]}>
          {label}
        </Txt>
      </AnimatedPress>
    );
  };

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      {/* Frequently bought together */}
      {frequentlyBought.length > 0 && (
        <View style={styles.fbtSection}>
          <View style={styles.fbtHeader}>
            <Txt maxFontSizeMultiplier={1.1} style={styles.fbtTitle}>Frequently bought together</Txt>
            <Ionicons name="chevron-up" size={18} color={GroceryColors.primary} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fbtScroll}>
            {frequentlyBought.map(p => (
              <View key={p.id} style={{ width: 140 }}>
                 <ProductCard product={p} layout="deal" style={{ width: '100%', marginRight: 0 }} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Free Delivery Promo */}
      <View style={styles.deliveryPromo}>
        <View style={styles.deliveryPromoIcon}>
          <Ionicons name="bicycle" size={24} color={GroceryColors.primary} />
        </View>
        <View style={styles.deliveryPromoTextWrap}>
          <Txt maxFontSizeMultiplier={1.1} style={styles.deliveryPromoTitle}>FREE DELIVERY</Txt>
          <Txt maxFontSizeMultiplier={1.1} style={styles.deliveryPromoSub}>on orders above ₹99</Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={GroceryColors.textMuted} />
      </View>
      
      <View style={{ height: 100 }} /> 
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ── Top Header ── */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 10 }]}>
        <AnimatedPress
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={GroceryColors.textPrimary} />
        </AnimatedPress>

        <Txt maxFontSizeMultiplier={1.2} style={styles.headerTitle} numberOfLines={1}>
          {activeSupplyCategory || 'All Products'}
        </Txt>

        <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="search" size={24} color={GroceryColors.textPrimary} />
        </AnimatedPress>
      </View>

      {/* ── Filter / Sort Bar ── */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <AnimatedPress style={styles.filterPill}>
            <Ionicons name="options-outline" size={16} color={GroceryColors.textPrimary} style={{ marginRight: 4 }} />
            <Txt maxFontSizeMultiplier={1.1} style={styles.filterPillText}>Filter</Txt>
          </AnimatedPress>
          <AnimatedPress style={styles.filterPill}>
            <Txt maxFontSizeMultiplier={1.1} style={styles.filterPillText}>Sort By</Txt>
            <Ionicons name="chevron-down" size={16} color={GroceryColors.textPrimary} style={{ marginLeft: 4 }} />
          </AnimatedPress>
          <AnimatedPress style={[styles.filterPill, styles.filterPillRush]}>
            <Ionicons name="time-outline" size={16} color={GroceryColors.primary} style={{ marginRight: 4 }} />
            <Txt maxFontSizeMultiplier={1.1} style={[styles.filterPillText, { color: GroceryColors.primary }]}>Rush Hour Deals</Txt>
          </AnimatedPress>
        </ScrollView>
      </View>

      <View style={styles.mainRow}>
        {/* ── Left Category Rail ── */}
        <View style={[styles.leftRail, { width: leftRailWidth }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.railContent}>
            {renderLeftRailItem(null, 'All', null)}
            {categories.map((c) => renderLeftRailItem(c.name, c.name, categoryPicture(c)))}
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>

        {/* ── Right Product Grid ── */}
        <View style={[styles.rightGrid, { width: gridWidth }]}>
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
            ListFooterComponent={renderFooter}
          />
        </View>
      </View>

      <FloatingCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Reference uses a very light background
  },
  
  // ── Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: GroceryColors.white,
  },
  backBtn: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  // ── Filter Bar ──
  filterBar: {
    backgroundColor: GroceryColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GroceryColors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterPillRush: {
    backgroundColor: '#F5F3FF',
    borderColor: '#E0E7FF',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  // ── Layout ──
  mainRow: {
    flex: 1,
    flexDirection: 'row',
  },

  // ── Left Rail ──
  leftRail: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#F0F0F0',
  },
  railContent: {
    paddingVertical: 8,
  },
  railItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  railItemActive: {
    backgroundColor: '#F5F3FF', // Light purple highlight
    borderRightWidth: 3,
    borderRightColor: GroceryColors.primary,
  },
  railIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  railIconBoxActive: {
    backgroundColor: GroceryColors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  railIcon: {
    width: '80%',
    height: '80%',
  },
  railLabel: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  railLabelActive: {
    color: GroceryColors.primary,
    fontWeight: '700',
  },

  // ── Right Grid ──
  rightGrid: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  gridContent: {
    paddingHorizontal: 10,
    paddingTop: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
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

  // ── Footer (FBT & Promo) ──
  footerContainer: {
    paddingTop: 16,
  },
  fbtSection: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  fbtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fbtTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  fbtScroll: {
    gap: 12,
  },
  
  deliveryPromo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  deliveryPromoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deliveryPromoTextWrap: {
    flex: 1,
  },
  deliveryPromoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: GroceryColors.primary,
  },
  deliveryPromoSub: {
    fontSize: 11,
    color: '#4F46E5',
    marginTop: 2,
  },
});
