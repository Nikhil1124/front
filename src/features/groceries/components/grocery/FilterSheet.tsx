import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, AppFonts, AppRadius } from '../../theme/AppColors';

export type ProductSort = 'popular' | 'price-asc' | 'price-desc' | 'name';

export interface FilterState {
  sort: ProductSort;
  dietary: string[];
  maxPrice?: number;
  onDealOnly?: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  sort: 'popular',
  dietary: [],
  maxPrice: undefined,
  onDealOnly: false,
};

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];

const DIETARY_OPTIONS = ['Organic', 'Gluten-Free', 'Vegan', 'Dairy-Free'];
const PRICE_CAPS = [100, 200, 500];

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  value: FilterState;
  onApply: (filters: FilterState) => void;
}

export function FilterSheet({ visible, onClose, value, onApply }: FilterSheetProps) {
  const [draft, setDraft] = useState<FilterState>(value);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(value);
    }
  }, [visible, value]);

  const toggleDietary = (tag: string) => {
    setDraft((prev) => ({
      ...prev,
      dietary: prev.dietary.includes(tag)
        ? prev.dietary.filter((t) => t !== tag)
        : [...prev.dietary, tag],
    }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Sort & Filter</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={AppColors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
                {/* Sort Section */}
                <Text style={styles.sectionTitle}>Sort by</Text>
                <View style={styles.sortList}>
                  {SORTS.map((s) => {
                    const selected = draft.sort === s.value;
                    return (
                      <TouchableOpacity
                        key={s.value}
                        style={styles.sortRow}
                        onPress={() => setDraft((prev) => ({ ...prev, sort: s.value }))}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.sortLabel, selected && styles.selectedSortLabel]}>
                          {s.label}
                        </Text>
                        <Ionicons
                          name={selected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={selected ? AppColors.primary : AppColors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Dietary Tags */}
                <Text style={styles.sectionTitle}>Dietary Preferences</Text>
                <View style={styles.chipRow}>
                  {DIETARY_OPTIONS.map((tag) => {
                    const active = draft.dietary.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.chip, active && styles.activeChip]}
                        onPress={() => toggleDietary(tag)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.activeChipText]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Max Price */}
                <Text style={styles.sectionTitle}>Max Price</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, draft.maxPrice === undefined && styles.activeChip]}
                    onPress={() => setDraft((prev) => ({ ...prev, maxPrice: undefined }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, draft.maxPrice === undefined && styles.activeChipText]}>
                      Any
                    </Text>
                  </TouchableOpacity>

                  {PRICE_CAPS.map((cap) => {
                    const active = draft.maxPrice === cap;
                    return (
                      <TouchableOpacity
                        key={cap}
                        style={[styles.chip, active && styles.activeChip]}
                        onPress={() => setDraft((prev) => ({ ...prev, maxPrice: cap }))}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.activeChipText]}>
                          Under ₹{cap}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Deal Filter */}
                <Text style={styles.sectionTitle}>Offers</Text>
                <TouchableOpacity
                  style={[styles.chip, draft.onDealOnly && styles.activeChip, { alignSelf: 'flex-start' }]}
                  onPress={() => setDraft((prev) => ({ ...prev, onDealOnly: !prev.onDealOnly }))}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="pricetag"
                    size={14}
                    color={draft.onDealOnly ? '#fff' : AppColors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.chipText, draft.onDealOnly && styles.activeChipText]}>
                    On Deal Only
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Action Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => setDraft(DEFAULT_FILTERS)}
                >
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={() => {
                    onApply(draft);
                    onClose();
                  }}
                >
                  <Text style={styles.applyText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: AppRadius.xl,
    borderTopRightRadius: AppRadius.xl,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: AppFonts.extraBold,
    color: AppColors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: AppFonts.bold,
    color: AppColors.textSecondary,
    marginTop: 14,
    marginBottom: 10,
  },
  sortList: {
    gap: 8,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  sortLabel: {
    fontSize: 14,
    fontFamily: AppFonts.medium,
    color: AppColors.textPrimary,
  },
  selectedSortLabel: {
    color: AppColors.primary,
    fontFamily: AppFonts.bold,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: AppRadius.pill,
    backgroundColor: AppColors.surfaceAlt,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  activeChip: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  chipText: {
    fontSize: 13,
    fontFamily: AppFonts.semiBold,
    color: AppColors.textSecondary,
  },
  activeChipText: {
    color: '#fff',
    fontFamily: AppFonts.bold,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: AppColors.divider,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: AppRadius.pill,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
    alignItems: 'center',
  },
  resetText: {
    color: AppColors.primary,
    fontFamily: AppFonts.bold,
    fontSize: 15,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: AppRadius.pill,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
  },
  applyText: {
    color: '#fff',
    fontFamily: AppFonts.extraBold,
    fontSize: 15,
  },
});
