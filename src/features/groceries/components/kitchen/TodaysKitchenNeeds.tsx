import React, { useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/useCartStore';
import { getProductById, mockProducts } from '../../data/mockProducts';
import { weeklyMenu } from '../../data/weeklyMenu';
import { KitchenNeedsBanner } from './KitchenNeedsBanner';
import { ProductCard } from '../grocery/ProductCard';
import { AddAllToCartButton } from './AddAllToCartButton';
import { DayMenuConfig, MenuIngredient } from '../../data/WeeklyMenuTypes';
import { AppColors, AppFonts, AppShadow } from '../../theme/AppColors';

// Extracted modal components
import { CustomAlertModal, CustomAlertState } from './CustomAlertModal';
import { MenuEditorModal } from './MenuEditorModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getIngredientsForDish = (dishName: string): string[] => {
  const d = dishName.toLowerCase();
  const items: string[] = [];
  if (d.includes('aloo') || d.includes('potato')) items.push('potato-001', 'onion-001', 'dal-001', 'oil-001');
  if (d.includes('dal') || d.includes('pulse')) items.push('dal-001', 'onion-001', 'oil-001');
  if (d.includes('paneer')) items.push('paneer-001', 'onion-001', 'oil-001', 'curd-001', 'leafygreens-001');
  if (d.includes('chicken') || d.includes('meat') || d.includes('biryani')) {
    items.push('chicken-001', 'rice-001', 'onion-001', 'oil-001', 'gingargarlic-001', 'greenchilli-001', 'coriander-001', 'curd-001');
  }
  if (d.includes('mushroom')) items.push('mushroom-001', 'mixveg-001', 'onion-001', 'oil-001');
  if (d.includes('veg') || d.includes('sabzi')) items.push('mixveg-001', 'onion-001', 'dal-001', 'oil-001');
  if (d.includes('curd') || d.includes('raita')) items.push('curd-001');
  if (d.includes('rice')) items.push('rice-001');
  if (d.includes('onion') || d.includes('salad')) items.push('onion-001');
  if (d.includes('oil')) items.push('oil-001');
  if (d.includes('egg')) items.push('egg-001', 'onion-001', 'oil-001', 'dal-001');
  return items;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TodaysKitchenNeedsProps {
  onProductPress: (productId: string) => void;
  onSeeAllCategoriesPress: () => void;
}

export const TodaysKitchenNeeds: React.FC<TodaysKitchenNeedsProps> = ({ onProductPress, onSeeAllCategoriesPress }) => {
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const bannerScrollRef = useRef<ScrollView>(null);

  // ── Day setup ──
  const currentDayName = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  }, []);

  const [menuConfig, setMenuConfig] = useState<Record<string, DayMenuConfig>>(weeklyMenu);

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
  const [editingConfigKey, setEditingConfigKey] = useState<string>('Saturday');
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

  const handleSaveMenu = () => {
    if (editingDishes.length === 0) {
      showAlert('Validation Error', 'A menu must contain at least one dish.', 'error');
      return;
    }

    const updatedIngredients: any[] = [];
    const addedProductIds = new Set<string>();

    // Keep ingredients still relevant to remaining dishes
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

    // Add new ingredients for new dishes
    editingDishes.forEach((dish) => {
      const directProduct = mockProducts.find((p) => p.name.toLowerCase() === dish.toLowerCase());
      const productIds: string[] = directProduct ? [directProduct.id] : getIngredientsForDish(dish);

      productIds.forEach((pId) => {
        if (addedProductIds.has(pId)) return;
        addedProductIds.add(pId);
        const product = mockProducts.find((p) => p.id === pId);
        if (product) {
          const opt = product.ownerOptions[0] || { unit: '1 unit', price: 100 };
          updatedIngredients.push({
            productId: product.id, name: product.name, quantity: opt.unit,
            image: product.image, price: opt.price, originalPrice: opt.originalPrice, unit: opt.unit,
          });
        }
      });
    });

    setMenuConfig({
      ...menuConfig,
      [editingConfigKey]: { ...menuConfig[editingConfigKey], menu: editingDishes, ingredients: updatedIngredients },
    });
    setIsMenuOpen(false);
    showAlert('Success', 'PG menu updated successfully!', 'success');
  };

  const handleAddOne = (ing: any) => {
    const product = getProductById(ing.productId);
    if (product) {
      const option = product.ownerOptions.find((o) => o.unit === ing.unit) || { unit: ing.unit, price: ing.price, originalPrice: ing.originalPrice };
      addItem(product, option, 1);
    }
  };

  const handleIncrement = (ing: any, currentQty: number) => {
    updateQuantity(`${ing.productId}-${ing.unit}`, currentQty + 1);
  };

  const handleDecrement = (ing: any, currentQty: number) => {
    const id = `${ing.productId}-${ing.unit}`;
    if (currentQty <= 1) removeItem(id);
    else updateQuantity(id, currentQty - 1);
  };

  const handleAddAllToCart = (targetConfig: DayMenuConfig) => {
    let addedCount = 0;
    targetConfig.ingredients.forEach((ing: MenuIngredient) => {
      const compoundId = `${ing.productId}-${ing.unit}`;
      if (!cartItems.find((item) => item.id === compoundId)) {
        const product = getProductById(ing.productId);
        if (product) {
          const option = product.ownerOptions.find((o) => o.unit === ing.unit) || { unit: ing.unit, price: ing.price, originalPrice: ing.originalPrice };
          addItem(product, option, 1);
          addedCount++;
        }
      }
    });
    if (addedCount > 0) showAlert('Success', `Added ${addedCount} supplies to your kitchen cart!`, 'success');
    else showAlert('Kitchen Cart', 'All ingredients of this menu are already in your cart.', 'info');
  };

  const categorizedIngredients = useMemo(() => {
    const vegList: any[] = [];
    const nonVegList: any[] = [];
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

  const totalIngredientsCount = activeConfig.ingredients.length;
  const totalMenuPrice = activeConfig.ingredients.reduce((sum: number, ing: MenuIngredient) => sum + ing.price, 0);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>🍽️ Today's Kitchen Needs</Text>
          <Text style={styles.subtitle}>Everything needed for today's PG menu</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={onSeeAllCategoriesPress}>
          <Text style={styles.seeAllText}>See All →</Text>
        </TouchableOpacity>
      </View>

      {/* Veg / Non-Veg toggle */}
      <View style={styles.tabContainer}>
        {(['veg', 'nonVeg'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.tabButton, activeTab === type && styles.activeTabButton]}
            onPress={() => handleTabPress(type)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === type && styles.activeTabButtonText]}>
              {type === 'veg' ? '🥦 Veg Needs' : '🍗 Non-Veg Needs'}
            </Text>
          </TouchableOpacity>
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
      />

      {/* ── See All Bottom Sheet ── */}
      <Modal animationType="slide" transparent visible={isSeeAllOpen} onRequestClose={() => setIsSeeAllOpen(false)}>
        <TouchableOpacity style={styles.bottomSheetBackdrop} activeOpacity={1} onPress={() => setIsSeeAllOpen(false)}>
          <TouchableOpacity style={styles.bottomSheetContainer} activeOpacity={1}>
            <View style={styles.grabHandle} />
            <View style={styles.bottomSheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bottomSheetTitle}>Today's Kitchen Needs</Text>
                <Text style={styles.bottomSheetSubtitle}>All recipe ingredients categorized</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSeeAllOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={AppColors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.bottomSheetScroll} showsVerticalScrollIndicator={false}>
              {[
                { label: '🍗 Non-Vegetarian Recipe Supplies', items: categorizedIngredients.nonVeg },
                { label: '🥦 Vegetarian Recipe Supplies', items: categorizedIngredients.veg },
              ].map(({ label, items }) => (
                <View key={label} style={styles.categorySection}>
                  <View style={styles.categoryHeadingRow}>
                    <Text style={styles.categoryName}>{label}</Text>
                  </View>
                  <View style={styles.gridContainer}>
                    {items.map((ing: MenuIngredient) => {
                      const productObj = getProductById(ing.productId);
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  title: { fontSize: 20, fontFamily: AppFonts.extraBold, color: AppColors.textPrimary },
  subtitle: { fontSize: 12, color: AppColors.textSecondary, fontFamily: AppFonts.medium, marginTop: 2 },
  seeAllText: { fontSize: 13, fontFamily: AppFonts.extraBold, color: AppColors.primary },

  tabContainer: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: AppColors.primaryLight, borderRadius: 10, padding: 3, marginVertical: 6 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeTabButton: { backgroundColor: AppColors.primary, shadowColor: AppColors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  tabButtonText: { fontSize: 12, fontFamily: AppFonts.extraBold, color: AppColors.textSecondary },
  activeTabButtonText: { color: AppColors.surface },

  bannerScrollContainer: { paddingLeft: 16, paddingRight: 6, alignItems: 'center' },
  bannerWrapper: { width: 320, marginRight: 10 },

  bottomSheetBackdrop: { flex: 1, backgroundColor: 'rgba(12,46,78,0.55)', justifyContent: 'flex-end' },
  bottomSheetContainer: { height: '65%', backgroundColor: '#F3F4F6', borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10, overflow: 'hidden' },
  grabHandle: { width: 40, height: 5, backgroundColor: '#D1D5DB', borderRadius: 2.5, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  bottomSheetHeader: { backgroundColor: AppColors.surface, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: AppColors.border },
  bottomSheetTitle: { color: AppColors.textPrimary, fontSize: 18, fontFamily: AppFonts.extraBold },
  bottomSheetSubtitle: { color: AppColors.textSecondary, fontSize: 11, marginTop: 2, fontFamily: AppFonts.medium },
  bottomSheetScroll: { flex: 1, padding: 16 },
  categorySection: { marginBottom: 20 },
  categoryHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: AppColors.divider, paddingBottom: 6 },
  categoryName: { fontSize: 14, fontFamily: AppFonts.extraBold, color: AppColors.textPrimary },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  gridCardWrapper: { width: '48%', marginBottom: 8 },
});

export default TodaysKitchenNeeds;
