import { SupplyItem } from '@/types';
import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet,  } from 'react-native';

import { AnimatedPress, Txt } from '@/components/ui';
;
import { Sheet, Txt, Btn } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Palette, Colors } from '@/theme';

import { FormScroll } from '@/components/ui/FormScroll';
import { OutlinedTextField, SearchField } from '@/components/ui';

export interface MenuEditorModalProps {
  visible: boolean;
  onClose: () => void;
  dishes: string[];
  onDishTextChange: (idx: number, text: string) => void;
  onRemoveDish: (idx: number) => void;
  newDishText: string;
  onNewDishTextChange: (text: string) => void;
  onAddDish: () => void;
  onSave: () => void;
  products?: SupplyItem[];
}

/**
 * Modal for editing/viewing the PG daily menu (dishes + ingredients).
 * Extracted from TodaysKitchenNeeds.tsx.
 */
export const MenuEditorModal: React.FC<MenuEditorModalProps> = ({
  visible,
  onClose,
  dishes,
  onDishTextChange,
  onRemoveDish,
  newDishText,
  onNewDishTextChange,
  onAddDish,
  onSave,
  products = [],
}) => {
  // Search suggestions filtered from products
  const suggestions = React.useMemo<SupplyItem[]>(() => {
    const visibleProducts = products;
    if (!newDishText.trim()) return visibleProducts.slice(0, 6);
    const q = newDishText.toLowerCase();
    return visibleProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.category_id.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [newDishText, products]);

  return (
    <Sheet
      visible={visible}
      title="Edit PG Menu"
      subtitle="Customize recipe schedule details"
      onDismiss={onClose}
      testID="menu_editor_modal"
      footer={
        <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
          <Btn onPress={onClose} borderRadius={Radii.card} containerColor={Colors.surface} textColor={Colors.textPrimary} style={{ flex: 1 }}>
            <Txt size={14}>Cancel</Txt>
          </Btn>
          <Btn onPress={onSave} borderRadius={Radii.card} containerColor={Colors.primary} textColor={Colors.textInverse} style={{ flex: 1 }}>
            <Txt size={14} weight="700">Save Changes</Txt>
          </Btn>
        </View>
      }
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Txt size={18} weight="700" style={styles.title}>🍳 Edit PG Menu</Txt>
            <Txt size={11} color={Colors.textSecondary} style={styles.subtitle}>Customize recipe schedule details</Txt>
          </View>
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </AnimatedPress>
        </View>

        <FormScroll style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Current dishes */}
          <Txt maxFontSizeMultiplier={1.3} style={styles.listHeading}>Current Dishes</Txt>
          {dishes.map((dish, index) => (
            <View key={index} style={styles.dishRow}>
              <OutlinedTextField
                style={{ flex: 1 }}
                value={dish}
                onChangeText={(text: string) => onDishTextChange(index, text)}
                placeholder="Enter dish name"
              />
              <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Delete" accessibilityRole="button" style={styles.removeDishBtn} onPress={() => onRemoveDish(index)}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </AnimatedPress>
            </View>
          ))}

          {/* Add new dish */}
          <Txt maxFontSizeMultiplier={1.3} style={styles.listHeading}>Add New Dish</Txt>
          <View style={styles.addDishRow}>
            <SearchField
              style={{ flex: 1 }}
              value={newDishText}
              onChangeText={onNewDishTextChange}
              placeholder="Search or type a dish"
            />
            <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Increase quantity" accessibilityRole="button" style={styles.addDishBtn} onPress={onAddDish}>
              <Ionicons name="add" size={20} color={Colors.surface} />
            </AnimatedPress>
          </View>

          {/* Product suggestions */}
          <Txt maxFontSizeMultiplier={1.3} style={styles.relatedHeading}>
            {newDishText.trim() ? 'Matching Stock Products' : 'Popular Ingredients'}
          </Txt>
          <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
            {suggestions.map((prod) => {
              const isAdded = dishes.includes(prod.name);
              return (
                <AnimatedPress accessibilityRole="button"
                  key={prod.id}
                  style={[styles.relatedCard, isAdded && styles.relatedCardAdded]}

                  onPress={() => {
                    if (!dishes.includes(prod.name)) {
                      onNewDishTextChange('');
                      // parent handles this via onAddDish with the text pre-set
                      // We trigger the parent to add prod.name
                      onNewDishTextChange(prod.name);
                    }
                  }}
                >
                  <View style={styles.relatedImageWrapper}>
                    <Image
                      source={prod.image_url ? { uri: prod.image_url } : require('../../../../../assets/img_app_icon.jpg')}
                      style={styles.relatedImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Txt maxFontSizeMultiplier={1.3} style={styles.relatedName} numberOfLines={1}>{prod.name}</Txt>
                  <View style={[styles.relatedAddBadge, isAdded && styles.relatedAddBadgeAdded]}>
                    <Ionicons name={isAdded ? 'checkmark' : 'add'} size={10} color={Colors.surface} />
                  </View>
                </AnimatedPress>
              );
            })}
          </FormScroll>
        </FormScroll>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,46,78,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
    maxHeight: '82%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    paddingBottom: 12,
  },
  subtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  scroll: { flex: 0, marginVertical: 14 },

  listHeading: {
    fontSize: 12,
    color: Colors.textPrimary,
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dishRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  removeDishBtn: { padding: 8, backgroundColor: Palette.TintRed, borderRadius: Radii.control },

  addDishRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addDishBtn: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: Radii.control,
    justifyContent: 'center',
    alignItems: 'center',
  },

  relatedHeading: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  relatedScroll: { gap: 8, paddingVertical: 4, paddingRight: 10 },
  relatedCard: {
    width: 90,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radii.card,
    padding: 8,
    alignItems: 'center',
    position: 'relative',
  },
  relatedCardAdded: { borderColor: Colors.primary, borderWidth: 1.5 },
  relatedImageWrapper: {
    width: 44,
    height: 44,
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  relatedImage: { width: '85%', height: '85%' },
  relatedAddBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: Radii.pill,
    backgroundColor: Colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedAddBadgeAdded: { backgroundColor: Colors.primary },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 12,
  },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radii.control },
  saveBtn: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: Radii.control },
  title: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary },
  relatedName: { fontSize: 9, fontWeight: '700' as const, color: Colors.textPrimary, textAlign: 'center' as const },
  cancelText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' as const },
  saveText: { color: Colors.surface, fontSize: 12, fontWeight: '700' as const },
});
