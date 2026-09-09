import React from 'react';
import { StyleSheet, View, Image, useWindowDimensions } from 'react-native';

import { SupplyCategory } from '@/types';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

const gap = 10;
const totalPadding = 32;

interface SupplyCategoryGridProps {
  categories: SupplyCategory[];
  onSupplyCategoryPress: (category: SupplyCategory) => void;
  onSeeAllPress: () => void;
}

// Map category name → actual grocery image asset
// Falls back gracefully if name doesn't match any known pattern
const getCategoryImage = (name: string) => {
  const n = name.toLowerCase();
  
  if (n.includes('fruit') || n.includes('veg')) {
    return require('../../../../../assets/productimages/cat_fruits_veg_nobg.png');
  }
  if (n.includes('dairy') || n.includes('milk') || n.includes('bread') || n.includes('egg')) {
    return require('../../../../../assets/productimages/cat_dairy_nobg.png');
  }
  if (n.includes('chicken') || n.includes('meat') || n.includes('fish')) {
    return require('../../../../../assets/productimages/cat_chicken_eggs_nobg.png');
  }
  if (n.includes('oil') || n.includes('masala') || n.includes('ghee') || n.includes('spice') || n.includes('atta') || n.includes('rice') || n.includes('dal') || n.includes('grain')) {
    return require('../../../../../assets/productimages/cat_masala_nobg.png');
  }
  if (n.includes('snack') || n.includes('beverage') || n.includes('drink') || n.includes('juice') || n.includes('biscuit') || n.includes('chocolate') || n.includes('sweet')) {
    return require('../../../../../assets/productimages/cat_addons_nobg.png');
  }
  if (n.includes('bakery') || n.includes('breakfast') || n.includes('cereal')) {
    return require('../../../../../assets/productimages/cat_dairy_nobg.png');
  }
  return require('../../../../../assets/productimages/cat_addons_nobg.png');
};


// Soft pastel background per category type
const getCategoryBg = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('fruit') || n.includes('veg')) return '#EDF7ED';
  if (n.includes('dairy') || n.includes('milk') || n.includes('bread')) return '#FFF8ED';
  if (n.includes('chicken') || n.includes('meat') || n.includes('egg')) return '#FFF0ED';
  if (n.includes('oil') || n.includes('masala') || n.includes('ghee')) return '#FFF8ED';
  if (n.includes('snack') || n.includes('beverage') || n.includes('drink')) return '#F0F4FF';
  if (n.includes('clean') || n.includes('household')) return '#F0F9FF';
  return GroceryColors.lightGreen;
};

export const SupplyCategoryGrid: React.FC<SupplyCategoryGridProps> = ({
  categories,
  onSupplyCategoryPress,
  onSeeAllPress,
}) => {
  const { width } = useWindowDimensions();
  const cardWidth = (width - totalPadding - gap * 3) / 4;

  // Show max 8 categories on home screen
  const visibleCategories = categories.slice(0, 8);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Txt maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
          Popular Categories
        </Txt>
        <AnimatedPress accessibilityRole="button" onPress={onSeeAllPress}>
          <Txt maxFontSizeMultiplier={1.2} style={styles.seeAllText}>
            View All →
          </Txt>
        </AnimatedPress>
      </View>

      <View style={styles.grid}>
        {visibleCategories.map((cat) => {
          const bg = getCategoryBg(cat.name);
          return (
            <AnimatedPress
              key={cat.id}
              accessibilityRole="button"
              style={[styles.cardItem, { width: cardWidth }]}
              onPress={() => onSupplyCategoryPress(cat)}
            >
              <View
                style={[
                  styles.imageWrapper,
                  { backgroundColor: bg, width: cardWidth, height: cardWidth },
                ]}
              >
                <Image
                  source={getCategoryImage(cat.name)}
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>
              <Txt
                maxFontSizeMultiplier={1.2}
                style={styles.cardText}
                numberOfLines={2}
              >
                {cat.name}
              </Txt>
            </AnimatedPress>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: GroceryColors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gap,
  },
  cardItem: {
    alignItems: 'center',
    marginBottom: 8,
  },
  imageWrapper: {
    borderRadius: Radii.card,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  image: {
    width: '78%',
    height: '78%',
  },
  cardText: {
    fontSize: 11,
    fontWeight: '500',
    color: GroceryColors.textPrimary,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
    paddingHorizontal: 2,
  },
});
