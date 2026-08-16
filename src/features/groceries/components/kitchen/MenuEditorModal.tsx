import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, AppFonts } from '../../theme/AppColors';
import { mockProducts, EnrichedProduct } from '../../data/mockProducts';
import { FormScroll } from '@/components/ui/FormScroll';

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
}) => {
  // Search suggestions filtered from mockProducts
  const suggestions = React.useMemo<EnrichedProduct[]>(() => {
    const visibleProducts = mockProducts.filter((p) => p.ownerVisible);
    if (!newDishText.trim()) return visibleProducts.slice(0, 6);
    const q = newDishText.toLowerCase();
    return visibleProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [newDishText]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>🍳 Edit PG Menu</Text>
              <Text style={styles.subtitle}>Customize recipe schedule details</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={AppColors.textPrimary} />
            </TouchableOpacity>
          </View>

          <FormScroll style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Current dishes */}
            <Text style={styles.listHeading}>Current Dishes</Text>
            {dishes.map((dish, index) => (
              <View key={index} style={styles.dishRow}>
                <TextInput
                  style={styles.dishInput}
                  value={dish}
                  onChangeText={(text) => onDishTextChange(index, text)}
                  placeholder="Enter dish name..."
                />
                <TouchableOpacity style={styles.removeDishBtn} onPress={() => onRemoveDish(index)}>
                  <Ionicons name="trash-outline" size={16} color={AppColors.error} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add new dish */}
            <Text style={styles.listHeading}>Add New Dish</Text>
            <View style={styles.addDishRow}>
              <View style={styles.searchBarWrapper}>
                <Ionicons name="search" size={16} color={AppColors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={styles.dishSearchInput}
                  value={newDishText}
                  onChangeText={onNewDishTextChange}
                  placeholder="Search/Type dish or ingredient..."
                  placeholderTextColor={AppColors.textMuted}
                />
              </View>
              <TouchableOpacity style={styles.addDishBtn} onPress={onAddDish} activeOpacity={0.8}>
                <Ionicons name="add" size={20} color={AppColors.surface} />
              </TouchableOpacity>
            </View>

            {/* Product suggestions */}
            <Text style={styles.relatedHeading}>
              {newDishText.trim() ? 'Matching Stock Products' : 'Popular Ingredients'}
            </Text>
            <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
              {suggestions.map((prod) => {
                const isAdded = dishes.includes(prod.name);
                return (
                  <TouchableOpacity
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
                        source={typeof prod.image === 'string' ? { uri: prod.image } : prod.image}
                        style={styles.relatedImage}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.relatedName} numberOfLines={1}>{prod.name}</Text>
                    <View style={[styles.relatedAddBadge, isAdded && styles.relatedAddBadgeAdded]}>
                      <Ionicons name={isAdded ? 'checkmark' : 'add'} size={10} color={AppColors.surface} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </FormScroll>
          </FormScroll>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
              <Text style={styles.saveText}>Save Changes</Text>
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
    backgroundColor: AppColors.surface,
    borderRadius: 20,
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
    borderBottomColor: AppColors.border,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontFamily: AppFonts.bold, color: AppColors.textPrimary },
  subtitle: { fontSize: 11, color: AppColors.textSecondary, marginTop: 2 },
  scroll: { marginVertical: 14 },

  listHeading: {
    fontSize: 12,
    fontFamily: AppFonts.bold,
    color: AppColors.textPrimary,
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dishRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  dishInput: {
    flex: 1,
    backgroundColor: AppColors.surfaceAlt,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: AppColors.textPrimary,
    fontFamily: AppFonts.semiBold,
  },
  removeDishBtn: { padding: 8, backgroundColor: AppColors.errorLight, borderRadius: 8 },

  addDishRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  dishSearchInput: {
    flex: 1,
    height: 38,
    fontSize: 12,
    color: AppColors.textPrimary,
    fontFamily: AppFonts.semiBold,
    paddingVertical: 0,
  },
  addDishBtn: {
    backgroundColor: AppColors.primary,
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  relatedHeading: {
    fontSize: 11,
    fontFamily: AppFonts.bold,
    color: AppColors.textSecondary,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  relatedScroll: { gap: 8, paddingVertical: 4, paddingRight: 10 },
  relatedCard: {
    width: 90,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    position: 'relative',
  },
  relatedCardAdded: { borderColor: AppColors.primary, borderWidth: 1.5 },
  relatedImageWrapper: {
    width: 44,
    height: 44,
    backgroundColor: AppColors.background,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  relatedImage: { width: '85%', height: '85%' },
  relatedName: { fontSize: 9, fontFamily: AppFonts.bold, color: AppColors.textPrimary, textAlign: 'center' },
  relatedAddBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: AppColors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedAddBadgeAdded: { backgroundColor: AppColors.primary },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: 12,
  },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelText: { color: AppColors.textSecondary, fontSize: 12, fontFamily: AppFonts.bold },
  saveBtn: { backgroundColor: AppColors.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  saveText: { color: AppColors.surface, fontSize: 12, fontFamily: AppFonts.bold },
});
