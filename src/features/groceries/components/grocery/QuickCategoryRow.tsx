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
              <View style={styles.iconWrapper}>
                {cat.icon()}
                {isActive && <View style={styles.activeDot} />}
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
  iconWrapper: {
    position: 'relative',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: Radii.badge,
    backgroundColor: GroceryColors.discountRed,
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
