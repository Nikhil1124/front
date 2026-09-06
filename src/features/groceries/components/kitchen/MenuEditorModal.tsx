import { SupplyItem } from '@/types';
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
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
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text maxFontSizeMultiplier={1.3} style={styles.title}>🍳 Edit PG Menu</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.subtitle}>Customize recipe schedule details</Text>
            </View>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <FormScroll style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Current dishes */}
            <Text maxFontSizeMultiplier={1.3} style={styles.listHeading}>Current Dishes</Text>
            {dishes.map((dish, index) => (
              <View key={index} style={styles.dishRow}>
                <OutlinedTextField
                  style={{ flex: 1 }}
                  value={dish}
                  onChangeText={(text: string) => onDishTextChange(index, text)}
                  placeholder="Enter dish name"
                />
                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Delete" accessibilityRole="button" style={styles.removeDishBtn} onPress={() => onRemoveDish(index)}>
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add new dish */}
            <Text maxFontSizeMultiplier={1.3} style={styles.listHeading}>Add New Dish</Text>
            <View style={styles.addDishRow}>
              <SearchField
                style={{ flex: 1 }}
                value={newDishText}
                onChangeText={onNewDishTextChange}
                placeholder="Search or type a dish"
              />
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Increase quantity" accessibilityRole="button" style={styles.addDishBtn} onPress={onAddDish} activeOpacity={0.8}>
                <Ionicons name="add" size={20} color={Colors.surface} />
              </TouchableOpacity>
            </View>

            {/* Product suggestions */}
            <Text maxFontSizeMultiplier={1.3} style={styles.relatedHeading}>
              {newDishText.trim() ? 'Matching Stock Products' : 'Popular Ingredients'}
            </Text>
            <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
              {suggestions.map((prod) => {
                const isAdded = dishes.includes(prod.name);
                return (
                  <TouchableOpacity accessibilityRole="button"
                    key={prod.id}
                    style={[styles.relatedCard, isAdded && styles.relatedCardAdded]}
                    activeOpacity={0.8}
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
                    <Text maxFontSizeMultiplier={1.3} style={styles.relatedName} numberOfLines={1}>{prod.name}</Text>
                    <View style={[styles.relatedAddBadge, isAdded && styles.relatedAddBadgeAdded]}>
                      <Ionicons name={isAdded ? 'checkmark' : 'add'} size={10} color={Colors.surface} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </FormScroll>
          </FormScroll>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity accessibilityRole="button" style={styles.cancelBtn} onPress={onClose}>
              <Text maxFontSizeMultiplier={1.3} style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.saveBtn} onPress={onSave}>
              <Text maxFontSizeMultiplier={1.3} style={styles.saveText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
