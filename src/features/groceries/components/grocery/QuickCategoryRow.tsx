import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { SupplyCategory } from '@/types';

function getCategoryIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const n = name.toLowerCase();
  if (n.includes('leaf')) return 'leaf';
  if (n.includes('veg') || n.includes('fruit')) return 'carrot';
  if (n.includes('egg') || n.includes('dairy') || n.includes('milk')) return 'egg';
  if (n.includes('chicken') || n.includes('meat') || n.includes('fish')) return 'food-drumstick';
  if (n.includes('oil') || n.includes('ghee') || n.includes('masala') || n.includes('spice')) return 'shaker';
  if (n.includes('bread') || n.includes('bakery')) return 'bread-slice-outline';
  if (n.includes('clean') || n.includes('wash') || n.includes('hygiene')) return 'spray-bottle';
  if (n.includes('snack') || n.includes('biscuit')) return 'cookie-outline';
  if (n.includes('drink') || n.includes('beverage')) return 'bottle-soda-outline';
  return 'basket-outline';
}

interface QuickCategoryRowProps {
  /** The backend's categories, in their order. */
  categories: SupplyCategory[];
  /** The chosen category's id, or null for All. */
  activeId: string | null;
  onSelect: (categoryId: string | null) => void;
}

/** Chips across the top: All, then the real categories — not five names written into the
 *  app that stopped matching the moment ops renamed a category. */
export const QuickCategoryRow: React.FC<QuickCategoryRowProps> = ({ categories, activeId, onSelect }) => {
  const chips: { id: string | null; label: string; category?: SupplyCategory }[] = [
    { id: null, label: 'All' },
    ...categories.slice(0, 12).map((c) => ({ id: c.id, label: c.name, category: c })),
  ];
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {chips.map((chip) => {
          const isActive = activeId === chip.id;
          return (
            <AnimatedPress
              key={chip.id ?? 'all'}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={styles.chip}
              onPress={() => onSelect(chip.id)}
            >
              {/* The selected state is the tinted box the bottom dock uses, not a dot: a dot
                  reads as a badge everywhere else in this app. */}
              <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                {chip.category ? (
                  <MaterialCommunityIcons name={getCategoryIcon(chip.label)} size={24} color={GroceryColors.white} />
                ) : (
                  <MaterialCommunityIcons name="view-grid-outline" size={26} color={GroceryColors.white} />
                )}
              </View>
              <Txt
                maxFontSizeMultiplier={1.1}
                numberOfLines={1}
                style={[styles.chipLabel, isActive && styles.chipLabelActive]}
              >
                {chip.label}
              </Txt>
            </AnimatedPress>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingBottom: 24,
    paddingTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  chip: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 54,
    gap: 8,
  },
  iconBox: {
    width: 44,
    height: 38,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picture: {
    width: 30,
    height: 30,
  },
  iconBoxActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    maxWidth: 72,
  },
  chipLabelActive: {
    color: GroceryColors.white,
    fontWeight: '700',
  },
});
