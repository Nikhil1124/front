import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radii } from '@/theme';

// A "Dietary Preferences" chip row (Organic/Gluten-Free/Vegan/Dairy-Free) used to live here.
// `SupplyItem` (types/supply.ts) carries no dietary/tag field at all, so those chips filtered
// nothing — picking one and tapping Apply changed the result list not at all. Removed rather
// than wired up: there's no real per-item data to filter on without a backend schema change.
export type ProductSort = 'popular' | 'price-asc' | 'price-desc' | 'name';

export interface FilterState {
  sort: ProductSort;
  maxPrice?: number;
  onDealOnly?: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  sort: 'popular',
  maxPrice: undefined,
  onDealOnly: false };

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];

const PRICE_CAPS = [100, 200, 500];

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  value: FilterState;
  onApply: (filters: FilterState) => void;
}

export function FilterSheet({ visible, onClose, value, onApply }: FilterSheetProps) {
  // Pinned to the bottom edge inside a Modal — nothing above pads it, so without this the
  // Apply button sits inside the Android gesture strip.
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<FilterState>(value);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(value);
    }
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheetContainer, { paddingBottom: 24 + insets.bottom }]}>
              {/* Header */}
              <View style={styles.header}>
                <Text maxFontSizeMultiplier={1.3} style={styles.headerTitle}>Sort & Filter</Text>
                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
                {/* Sort Section */}
                <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Sort by</Text>
                <View style={styles.sortList}>
                  {SORTS.map((s) => {
                    const selected = draft.sort === s.value;
                    return (
                      <TouchableOpacity accessibilityRole="button"
                        key={s.value}
                        style={styles.sortRow}
                        onPress={() => setDraft((prev) => ({ ...prev, sort: s.value }))}
                        activeOpacity={0.8}
                      >
                        <Text maxFontSizeMultiplier={1.3} style={[styles.sortLabel, selected && styles.selectedSortLabel]}>
                          {s.label}
                        </Text>
                        <Ionicons
                          name={selected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={selected ? Colors.primary : Colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Max Price */}
                <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Max Price</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity accessibilityRole="button"
                    style={[styles.chip, draft.maxPrice === undefined && styles.activeChip]}
                    onPress={() => setDraft((prev) => ({ ...prev, maxPrice: undefined }))}
                    activeOpacity={0.8}
                  >
                    <Text maxFontSizeMultiplier={1.3} style={[styles.chipText, draft.maxPrice === undefined && styles.activeChipText]}>
                      Any
                    </Text>
                  </TouchableOpacity>

                  {PRICE_CAPS.map((cap) => {
                    const active = draft.maxPrice === cap;
                    return (
                      <TouchableOpacity accessibilityState={{ selected: !!active }} accessibilityRole="button"
                        key={cap}
                        style={[styles.chip, active && styles.activeChip]}
                        onPress={() => setDraft((prev) => ({ ...prev, maxPrice: cap }))}
                        activeOpacity={0.8}
                      >
                        <Text maxFontSizeMultiplier={1.3} style={[styles.chipText, active && styles.activeChipText]}>
                          Under ₹{cap}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Deal Filter */}
                <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Offers</Text>
                <TouchableOpacity accessibilityRole="button"
                  style={[styles.chip, draft.onDealOnly && styles.activeChip, { alignSelf: 'flex-start' }]}
                  onPress={() => setDraft((prev) => ({ ...prev, onDealOnly: !prev.onDealOnly }))}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="pricetag"
                    size={14}
                    color={draft.onDealOnly ? '#fff' : Colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text maxFontSizeMultiplier={1.3} style={[styles.chipText, draft.onDealOnly && styles.activeChipText]}>
                    On Deal Only
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Action Footer */}
              <View style={styles.footer}>
                <TouchableOpacity accessibilityRole="button"
                  style={styles.resetBtn}
                  onPress={() => setDraft(DEFAULT_FILTERS)}
                >
                  <Text maxFontSizeMultiplier={1.3} style={styles.resetText}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity accessibilityRole="button"
                  style={styles.applyBtn}
                  onPress={() => {
                    onApply(draft);
                    onClose();
                  }}
                >
                  <Text maxFontSizeMultiplier={1.3} style={styles.applyText}>Apply Filters</Text>
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
    justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '80%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle },
  headerTitle: {
    fontSize: 18,
    color: Colors.textPrimary },
  closeBtn: {
    padding: 4 },
  body: {
    marginVertical: 12 },
  sectionTitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 14,
    marginBottom: 10 },
  sortList: {
    gap: 8 },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10 },
  sortLabel: {
    fontSize: 14,
    color: Colors.textPrimary },
  selectedSortLabel: {
    color: Colors.primary },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderSubtle },
  activeChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary },
  activeChipText: {
    color: '#fff' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center' },
  resetText: {
    color: Colors.primary,
    fontSize: 15 },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: Radii.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center' },
  applyText: {
    color: '#fff',
    fontSize: 15 } });
