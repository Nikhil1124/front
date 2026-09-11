import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface QuickCategoryRowProps {
  onCategoryPress?: (categoryName: string | null) => void;
}

export const QuickCategoryRow: React.FC<QuickCategoryRowProps> = ({ onCategoryPress }) => {
  const [active, setActive] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All', icon: () => <MaterialCommunityIcons name="view-grid-outline" size={26} color={GroceryColors.white} /> },
    { id: 'vegetables', label: 'Vegetables', icon: () => <MaterialCommunityIcons name="carrot" size={26} color={GroceryColors.white} /> },
    { id: 'leafy', label: 'Leafy Items', icon: () => <MaterialCommunityIcons name="leaf" size={26} color={GroceryColors.white} /> },
    { id: 'dairy', label: 'Dairy & Eggs', icon: () => <MaterialCommunityIcons name="egg" size={26} color={GroceryColors.white} /> },
    { id: 'meats', label: 'Meats', icon: () => <MaterialCommunityIcons name="food-drumstick" size={26} color={GroceryColors.white} /> },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((cat) => {
          const isActive = active === cat.id;
          return (
            <AnimatedPress
              key={cat.id}
              accessibilityRole="button"
              style={styles.chip}
              onPress={() => {
                setActive(cat.id);
                onCategoryPress?.(cat.id === 'all' ? null : cat.label);
              }}
            >
              {/* The selected state is the tinted box the bottom dock uses, not the 6px dot
                  that used to sit on the icon's corner: at that size a dot reads as a badge
                  ("something is waiting here"), which is what it means everywhere else in
                  this app, rather than "this is the one you are on". */}
              <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                {cat.icon()}
              </View>
              <Txt maxFontSizeMultiplier={1.1} style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                {cat.label}
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
    backgroundColor: GroceryColors.primaryDark,
    paddingBottom: 24,
    paddingTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
    justifyContent: 'space-between',
    width: '100%',
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
  iconBoxActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  chipLabelActive: {
    color: GroceryColors.white,
    fontWeight: '700',
  },
});
