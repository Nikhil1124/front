import { SupplyItem } from '@/types';
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/useCartStore';
import { toAmount } from '@/data/mappers';

import { KitchenNeedsBanner } from './KitchenNeedsBanner';
import { ProductCard } from '../grocery/ProductCard';
import { AddAllToCartButton } from './AddAllToCartButton';
import { DayMenuConfig, MenuIngredient } from '../../data/WeeklyMenuTypes';
import {
  useKitchenMenuQuery,
  useSetKitchenMenuDayMutation,
} from '../../useKitchenMenu';
import { KitchenMenuDay, KitchenMenuMealType, KitchenMenuWeekday } from '@/types';
import { Radii, Colors } from '@/theme';

// Extracted modal components
import { CustomAlertModal, CustomAlertState } from './CustomAlertModal';
import { MenuEditorModal } from './MenuEditorModal';
import { AnimatedPress, ErrorState, LoadingState, Sheet, Txt } from '@/components/ui';

// ─── Weekday / meal-type conversion ────────────────────────────────────────────
// The server speaks lowercase weekdays ('monday') and 'veg' | 'non_veg' | 'pure_veg'; this
// screen's view-model (DayMenuConfig) speaks capitalized days and 'veg' | 'nonVeg' | 'pureVeg'
// so it can key a Record by display name. These maps are the only place the two meet.

const WEEKDAY_TO_LABEL: Record<KitchenMenuWeekday, DayMenuConfig['day']> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};
const LABEL_TO_WEEKDAY: Record<DayMenuConfig['day'], KitchenMenuWeekday> = {
  Monday: 'monday', Tuesday: 'tuesday', Wednesday: 'wednesday', Thursday: 'thursday',
  Friday: 'friday', Saturday: 'saturday', Sunday: 'sunday',
};
const MEAL_TYPE_TO_UI: Record<KitchenMenuMealType, DayMenuConfig['type']> = {
  veg: 'veg', non_veg: 'nonVeg', pure_veg: 'pureVeg',
};
const MEAL_TYPE_TO_API: Record<DayMenuConfig['type'], KitchenMenuMealType> = {
  veg: 'veg', nonVeg: 'non_veg', pureVeg: 'pure_veg',
};

function emptyDay(day: DayMenuConfig['day'], type: DayMenuConfig['type']): DayMenuConfig {
  return { day, type, title: "Everything for today's PG menu", menu: [], ingredients: [] };
}

/** Populated before the real fetch resolves, so `menuConfig[day]` is never undefined. */
const DEFAULT_MENU_CONFIG: Record<string, DayMenuConfig> = {
  Monday: emptyDay('Monday', 'veg'),
  Tuesday: emptyDay('Tuesday', 'veg'),
  Wednesday: emptyDay('Wednesday', 'nonVeg'),
  Thursday: emptyDay('Thursday', 'veg'),
  Friday: emptyDay('Friday', 'nonVeg'),
  Saturday: emptyDay('Saturday', 'pureVeg'),
  Sunday: emptyDay('Sunday', 'nonVeg'),
};

function toMenuConfig(days: KitchenMenuDay[] | undefined): Record<string, DayMenuConfig> {
  const config: Record<string, DayMenuConfig> = { ...DEFAULT_MENU_CONFIG };
  (days ?? []).forEach((day) => {
    const label = WEEKDAY_TO_LABEL[day.weekday];
    if (!label) return;
    config[label] = {
      day: label,
      type: day.meal_type ? MEAL_TYPE_TO_UI[day.meal_type] : config[label].type,
      title: "Everything for today's PG menu",
      menu: day.dishes,
      ingredients: day.ingredients.map((item): MenuIngredient => ({
        productId: item.id,
        name: item.name,
        quantity: `${item.quantity} × ${item.unit_label}`,
        image: item.image_url ?? null,
        price: toAmount(item.price),
        originalPrice: item.mrp != null ? toAmount(item.mrp) : undefined,
        unit: item.unit_label,
        packs: item.quantity,
      })),
    };
  });
  return config;
}

// ponytail: keyword → real-catalog-term guesses, same spirit as the old hardcoded-ID
// heuristic it replaces, but resolved against the live product list instead of fictional
// ids. Upgrade to a real ingredient picker in MenuEditorModal if chefs want precision.
const DISH_KEYWORD_TO_PRODUCT_TERMS: Record<string, string[]> = {
  aloo: ['potato'], potato: ['potato'],
  dal: ['dal'], pulse: ['dal'],
  paneer: ['paneer'],
  chicken: ['chicken'], meat: ['chicken'], biryani: ['chicken', 'rice'],
  mushroom: ['mushroom'],
  veg: ['vegetable'], sabzi: ['vegetable'],
  curd: ['curd'], raita: ['curd'],
  rice: ['rice'],
  onion: ['onion'], salad: ['onion'],
  oil: ['oil'],
  egg: ['egg'],
  palak: ['spinach'], spinach: ['spinach'],
};

function inferIngredientsForDish(dishName: string, products: SupplyItem[]): SupplyItem[] {
  const d = dishName.toLowerCase();
  const terms = new Set<string>();
  for (const [kw, productTerms] of Object.entries(DISH_KEYWORD_TO_PRODUCT_TERMS)) {
    if (d.includes(kw)) productTerms.forEach((t) => terms.add(t));
  }
  if (terms.size > 0) {
    // Every cooked dish this heuristic recognizes calls for these two staples too.
    terms.add('onion');
    terms.add('oil');
  }
  const matched: SupplyItem[] = [];
  const seen = new Set<string>();
  terms.forEach((term) => {
    const hit = products.find((p) => p.name.toLowerCase().includes(term));
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      matched.push(hit);
    }
  });
  return matched;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TodaysKitchenNeedsProps {
  onProductPress: (productId: string) => void;
  onSeeAllCategoriesPress: () => void;
  products?: SupplyItem[];
  pgId?: string;
}

export const TodaysKitchenNeeds: React.FC<TodaysKitchenNeedsProps> = ({
  onProductPress, onSeeAllCategoriesPress, products = [], pgId,
}) => {
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);

  const bannerScrollRef = useRef<ScrollView>(null);
  const findProduct = (id: string) => products.find((p) => p.id === id);

  // `DEFAULT_MENU_CONFIG` fills in before the fetch resolves so `menuConfig[day]` is never
  // undefined — which is right for a first render and wrong for a failure. Every day in that
  // fallback has an empty menu and empty ingredients, so a failed fetch told the chef there
  // was nothing to cook and nothing to buy. The error has to be visible or it reads as an
  // answer.
  const { data: kitchenMenuDays, isLoading: menuLoading, error: menuError, refetch: refetchMenu } =
    useKitchenMenuQuery(pgId);
  const setKitchenMenuDay = useSetKitchenMenuDayMutation(pgId);
  const menuConfig = useMemo(() => toMenuConfig(kitchenMenuDays), [kitchenMenuDays]);

  // ── Day setup ──
  const currentDayName = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  }, []);

  const vegConfig = useMemo(() => {
    const t = menuConfig[currentDayName]?.type;
    return t === 'veg' || t === 'pureVeg' ? menuConfig[currentDayName] : menuConfig['Saturday'];
  }, [menuConfig, currentDayName]);

  const nonVegConfig = useMemo(() => {
    return menuConfig[currentDayName]?.type === 'nonVeg'
      ? menuConfig[currentDayName]
      : menuConfig['Wednesday'];
  }, [menuConfig, currentDayName]);

  const [activeTab, setActiveTab] = useState<'veg' | 'nonVeg'>('veg');
  const activeConfig = activeTab === 'veg' ? vegConfig : nonVegConfig;

  // ── Alert state ──
  const [customAlert, setCustomAlert] = useState<CustomAlertState>({
    visible: false, title: '', message: '', type: 'info',
  });
  const showAlert = (title: string, message: string, type: CustomAlertState['type'] = 'info') => {
    setCustomAlert({ visible: true, title, message, type });
  };

  // ── Menu editor state ──
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingConfigKey, setEditingConfigKey] = useState<DayMenuConfig['day']>('Saturday');
  const [editingDishes, setEditingDishes] = useState<string[]>([]);
  const [newDishText, setNewDishText] = useState('');

  // ── See All overlay ──
  const [isSeeAllOpen, setIsSeeAllOpen] = useState(false);

  // ── Handlers ──
  const handleProductPress = (productId: string) => {
    setIsSeeAllOpen(false);
    onProductPress(productId);
  };

  const handleTabPress = (type: 'veg' | 'nonVeg') => {
    setActiveTab(type);
    bannerScrollRef.current?.scrollTo({ x: type === 'veg' ? 0 : 330, y: 0, animated: true });
  };

  const handleOpenMenu = (config: DayMenuConfig) => {
    setEditingConfigKey(config.day);
    setEditingDishes([...config.menu]);
    setNewDishText('');
    setIsMenuOpen(true);
    handleTabPress(config.type === 'nonVeg' ? 'nonVeg' : 'veg');
  };

  const handleAddDish = () => {
    if (!newDishText.trim()) return;
    setEditingDishes((prev) => [...prev, newDishText.trim()]);
    setNewDishText('');
  };

  const handleSaveMenu = async () => {
    if (editingDishes.length === 0) {
      showAlert('Validation Error', 'A menu must contain at least one dish.', 'error');
      return;
    }
    if (!pgId) {
      showAlert('No Property Selected', 'Pick a property before editing its kitchen menu.', 'error');
      return;
    }

    const updatedIngredients: MenuIngredient[] = [];
    const addedProductIds = new Set<string>();

    // Keep ingredients still relevant to remaining dishes, packs unchanged.
    const currentIngredients = menuConfig[editingConfigKey].ingredients || [];
    currentIngredients.forEach((ing: MenuIngredient) => {
      const isStillRelevant = editingDishes.some((dish) => {
        const d = dish.toLowerCase();
        const n = ing.name.toLowerCase();
        if (d.includes(n) || n.includes(d)) return true;
        if (d.includes('chicken') || d.includes('egg') || d.includes('biryani')) {
          if (['onion', 'oil', 'ginger', 'garlic', 'chilli', 'coriander', 'curd', 'rice', 'dal'].some((a) => n.includes(a))) return true;
        }
        if (d.includes('paneer') || d.includes('mushroom') || d.includes('veg') || d.includes('aloo')) {
          if (['onion', 'oil', 'dal', 'curd', 'leafy'].some((a) => n.includes(a))) return true;
        }
        return false;
      });
      if (isStillRelevant) { addedProductIds.add(ing.productId); updatedIngredients.push(ing); }
    });

    // Add new ingredients for new dishes — a direct product-name match first, the keyword
    // heuristic otherwise.
    editingDishes.forEach((dish) => {
      const directProduct = products.find((p) => p.name.toLowerCase() === dish.toLowerCase());
      const matches = directProduct ? [directProduct] : inferIngredientsForDish(dish, products);

      matches.forEach((product) => {
        if (addedProductIds.has(product.id)) return;
        addedProductIds.add(product.id);
        updatedIngredients.push({
          productId: product.id,
          name: product.name,
          quantity: `1 × ${product.unit_label}`,
          image: product.image_url ?? null,
          price: toAmount(product.price),
          originalPrice: product.mrp != null ? toAmount(product.mrp) : undefined,
          unit: product.unit_label,
          packs: 1,
        });
      });
    });

    try {
      await setKitchenMenuDay.mutateAsync({
        weekday: LABEL_TO_WEEKDAY[editingConfigKey],
        meal_type: MEAL_TYPE_TO_API[menuConfig[editingConfigKey].type],
        dishes: editingDishes,
        ingredients: updatedIngredients.map((ing) => ({ item_id: ing.productId, quantity: ing.packs })),
      });
      setIsMenuOpen(false);
      showAlert('Success', 'PG menu updated successfully!', 'success');
    } catch {
      showAlert('Could Not Save', 'The menu update did not go through. Please try again.', 'error');
    }
  };

  const handleAddAllToCart = (targetConfig: DayMenuConfig) => {
    let addedCount = 0;
    targetConfig.ingredients.forEach((ing: MenuIngredient) => {
      const compoundId = `${ing.productId}-${ing.unit}`;
      if (!cartItems.find((item) => item.id === compoundId)) {
        const product = findProduct(ing.productId);
        if (product) {
          const option = { unit: ing.unit, price: ing.price, originalPrice: ing.originalPrice };
          addItem(product, option, ing.packs);
          addedCount++;
        }
      }
    });
    if (addedCount > 0) showAlert('Success', `Added ${addedCount} supplies to your kitchen cart!`, 'success');
    else showAlert('Kitchen Cart', 'All ingredients of this menu are already in your cart.', 'info');
  };

  const categorizedIngredients = useMemo(() => {
    const vegList: MenuIngredient[] = [];
    const nonVegList: MenuIngredient[] = [];
    const addedIds = new Set<string>();
    Object.values(menuConfig).forEach((dayConfig) => {
      dayConfig.ingredients.forEach((ing: MenuIngredient) => {
        const key = `${ing.productId}-${ing.unit}`;
        if (addedIds.has(key)) return;
        addedIds.add(key);
        if (dayConfig.type === 'nonVeg') nonVegList.push(ing);
        else vegList.push(ing);
      });
    });
    return { veg: vegList, nonVeg: nonVegList };
  }, [menuConfig]);

  const totalIngredientsCount = activeConfig.ingredients.reduce((sum, ing) => sum + ing.packs, 0);
  const totalMenuPrice = activeConfig.ingredients.reduce((sum: number, ing: MenuIngredient) => sum + ing.price * ing.packs, 0);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Txt maxFontSizeMultiplier={1.3} style={styles.title}>🍽️ Today's Kitchen Needs</Txt>
          <Txt maxFontSizeMultiplier={1.3} style={styles.subtitle}>Everything needed for today's PG menu</Txt>
        </View>
        <AnimatedPress accessibilityRole="button" onPress={onSeeAllCategoriesPress}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.seeAllText}>See All →</Txt>
        </AnimatedPress>
      </View>

      {menuError ? (
        <ErrorState error={menuError} title="Could not load today's menu" onRetry={refetchMenu} fill={false} />
      ) : menuLoading ? (
        <LoadingState label="Loading today's menu…" size="small" fill={false} />
      ) : null}

      {/* Veg / Non-Veg toggle */}
      <View style={styles.tabContainer}>
        {(['veg', 'nonVeg'] as const).map((type) => (
          <AnimatedPress accessibilityRole="button"
            key={type}
            style={[styles.tabButton, activeTab === type && styles.activeTabButton]}
            onPress={() => handleTabPress(type)}

          >
            <Txt maxFontSizeMultiplier={1.3} style={[styles.tabButtonText, activeTab === type && styles.activeTabButtonText]}>
              {type === 'veg' ? '🥦 Veg Needs' : '🍗 Non-Veg Needs'}
            </Txt>
          </AnimatedPress>
        ))}
      </View>

      {/* Banner carousel */}
      <ScrollView
        ref={bannerScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={330}
        snapToAlignment="center"
        contentContainerStyle={styles.bannerScrollContainer}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / 330);
          setActiveTab(idx === 0 ? 'veg' : 'nonVeg');
        }}
      >
        {[vegConfig, nonVegConfig].map((cfg, i) => (
          <View key={i} style={styles.bannerWrapper}>
            <KitchenNeedsBanner config={cfg} onViewMenuPress={() => handleOpenMenu(cfg)} />
          </View>
        ))}
      </ScrollView>

      {/* Bulk add button */}
      <AddAllToCartButton
        totalItems={totalIngredientsCount}
        totalPrice={totalMenuPrice}
        onPress={() => handleAddAllToCart(activeConfig)}
      />

      {/* ── Menu Editor Modal ── */}
      <MenuEditorModal
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        dishes={editingDishes}
        onDishTextChange={(idx, text) => {
          const updated = [...editingDishes];
          updated[idx] = text;
          setEditingDishes(updated);
        }}
        onRemoveDish={(idx) => setEditingDishes(editingDishes.filter((_, i) => i !== idx))}
        newDishText={newDishText}
        onNewDishTextChange={setNewDishText}
        onAddDish={handleAddDish}
        onSave={handleSaveMenu}
        products={products}
      />

      {/* ── See All Bottom Sheet ── */}
      <Sheet
        visible={isSeeAllOpen}
        title="Today's Kitchen Needs"
        subtitle="All recipe ingredients categorized"
        onDismiss={() => setIsSeeAllOpen(false)}
        testID="todays_kitchen_needs_sheet"
      >
        <View style={styles.bottomSheetContainer}>
          <View style={styles.grabHandle} />
          <View style={styles.bottomSheetHeader}>
            <View style={{ flex: 1 }}>
              <Txt maxFontSizeMultiplier={1.3} style={styles.bottomSheetTitle}>Today's Kitchen Needs</Txt>
              <Txt maxFontSizeMultiplier={1.3} style={styles.bottomSheetSubtitle}>All recipe ingredients categorized</Txt>
            </View>
            <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={() => setIsSeeAllOpen(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </AnimatedPress>
          </View>
          <ScrollView style={styles.bottomSheetScroll} showsVerticalScrollIndicator={false}>
            {[
              { label: '🍗 Non-Vegetarian Recipe Supplies', items: categorizedIngredients.nonVeg },
              { label: '🥦 Vegetarian Recipe Supplies', items: categorizedIngredients.veg },
            ].map(({ label, items }) => (
              <View key={label} style={styles.categorySection}>
                <View style={styles.categoryHeadingRow}>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.categoryName}>{label}</Txt>
                </View>
                <View style={styles.gridContainer}>
                  {items.map((ing: MenuIngredient) => {
                    const productObj = findProduct(ing.productId);
                    if (!productObj) return null;
                    return (
                      <View key={ing.productId} style={styles.gridCardWrapper}>
                        <ProductCard
                          product={productObj}
                          onPress={(p) => handleProductPress(p.id)}
                          style={{ width: '100%', marginRight: 0 }}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Sheet>

      {/* ── Custom Alert ── */}
      <CustomAlertModal
        state={customAlert}
        onClose={() => setCustomAlert({ ...customAlert, visible: false })}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { marginVertical: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },

  tabContainer: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: Colors.surfaceElevated, borderRadius: Radii.control, padding: 3, marginVertical: 6 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radii.control },
  activeTabButton: { backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  activeTabButtonText: { color: Colors.surface },

  bannerScrollContainer: { paddingLeft: 16, paddingRight: 6, alignItems: 'center' },
  bannerWrapper: { width: 320, marginRight: 10 },

  bottomSheetBackdrop: { flex: 1, backgroundColor: 'rgba(12,46,78,0.55)', justifyContent: 'flex-end' },
  bottomSheetContainer: { height: '65%', backgroundColor: Colors.surfaceMuted, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10, overflow: 'hidden' },
  grabHandle: { width: 40, height: 5, backgroundColor: Colors.borderMuted, borderRadius: Radii.pill, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  bottomSheetHeader: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  bottomSheetScroll: { flex: 1, padding: 16 },
  categorySection: { marginBottom: 20 },
  categoryHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle, paddingBottom: 6 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  gridCardWrapper: { width: '48%', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700' as const, color: Colors.textPrimary },
  subtitle: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' as const, marginTop: 2 },
  seeAllText: { fontSize: 13, fontWeight: '700' as const, color: Colors.primary },
  tabButtonText: { fontSize: 12, fontWeight: '700' as const, color: Colors.textSecondary },
  bottomSheetTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' as const },
  bottomSheetSubtitle: { color: Colors.textSecondary, fontSize: 11, marginTop: 2, fontWeight: '500' as const },
  categoryName: { fontSize: 14, fontWeight: '700' as const, color: Colors.textPrimary },
});

export default TodaysKitchenNeeds;
