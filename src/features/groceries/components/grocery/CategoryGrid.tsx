import React from 'react';
import { StyleSheet, View, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { AnimatedPress, Txt } from '@/components/ui';

import { SupplyCategory } from '@/types';
import { Radii, Palette, Colors } from '@/theme';

const gap = 10;
const totalPadding = 32;

interface SupplyCategoryGridProps {
  categories: SupplyCategory[];
  onSupplyCategoryPress: (category: SupplyCategory) => void;
  onSeeAllPress: () => void;
}

// Map each category to the precise background color requested by the user
const getSupplyCategoryBgColor = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('rice') || n.includes('grain') || n.includes('atta') || n.includes('flour')) {
    return Colors.surfaceElevated; // Rice & Grains
  }
  if (n.includes('pulse') || n.includes('dal') || n.includes('cereal') || n.includes('dry fruits')) {
    return Palette.TintAmber; // Pulses & Dal
  }
  if (n.includes('oil') || n.includes('masala') || n.includes('ghee') || n.includes('spice')) {
    return Palette.TintAmber; // Oil & Masala
  }
  if (n.includes('veg') || n.includes('fruit')) {
    return Colors.surfaceElevated; // Vegetables
  }
  if (n.includes('dairy') || n.includes('bread') || n.includes('bakery') || n.includes('biscuit')) {
    return Palette.TintBlue; // Dairy & Bread
  }
  if (n.includes('egg') || n.includes('chicken') || n.includes('fish') || n.includes('meat')) {
    return Palette.TintAmber; // Eggs
  }
  if (n.includes('beverage') || n.includes('drink') || n.includes('juice') || n.includes('tea') || n.includes('coffee')) {
    return Palette.TintBlue; // Beverages
  }
  if (n.includes('clean') || n.includes('hygiene') || n.includes('essential')) {
    return Colors.surfaceElevated; // Cleaning
  }
  return Colors.surfaceElevated; // Fallback very light green
};

export const SupplyCategoryGrid: React.FC<SupplyCategoryGridProps> = ({ categories, onSupplyCategoryPress, onSeeAllPress }) => {
  const { width } = useWindowDimensions();
  // 4 items per row layout math
  const cardWidth = (width - totalPadding - (gap * 3)) / 4;

  // Show exactly maximum 8 categories initially on the Home screen
  const visibleCategories = categories.slice(0, 8);

  const handleSupplyCategoryPress = (cat: SupplyCategory) => onSupplyCategoryPress(cat);
  const handleSeeAllPress = () => onSeeAllPress();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Shop by Category</Txt>
        <AnimatedPress accessibilityRole="button" onPress={handleSeeAllPress}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.seeAllText}>See All →</Txt>
        </AnimatedPress>
      </View>
      <View style={styles.grid}>
        {visibleCategories.map((cat) => {
          const bgColor = getSupplyCategoryBgColor(cat.name);
          return (
            <AnimatedPress accessibilityRole="button"
              key={cat.id}
              style={[styles.cardItem, { width: cardWidth }]}

              onPress={() => handleSupplyCategoryPress(cat)}
            >
              <View style={[styles.imageWrapper, { backgroundColor: bgColor, width: cardWidth, height: cardWidth }]}>
                <Image
                  source={require('../../../../../assets/img_app_icon.jpg')}
                  style={styles.image}
                />
              </View>
              <Txt maxFontSizeMultiplier={1.3} style={styles.cardText} numberOfLines={2}>
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
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.primary,
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
    width: '75%',
    height: '75%',
    resizeMode: 'contain',
  },
  cardText: {
    fontSize: 11,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
    paddingHorizontal: 2,
  },
});
