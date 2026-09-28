import React from 'react';
import { StyleSheet, View, Image, useWindowDimensions } from 'react-native';

import { SupplyCategory } from '@/types';
import { GroceryColors, Radii } from '@/theme';
import { categoryPicture, categoryTint } from '../../categoryVisuals';
import { AnimatedPress, Txt } from '@/components/ui';

const gap = 10;
const totalPadding = 32;

interface SupplyCategoryGridProps {
  /** Already in the storefront's order (and selection). */
  categories: SupplyCategory[];
  /** The heading from the storefront; empty draws none. */
  title: string;
  /** Tiles per row. */
  columns: 3 | 4 | 5;
  /** "View All" colour — the theme's, readable on white. */
  accentColor: string;
  onSupplyCategoryPress: (category: SupplyCategory) => void;
  onSeeAllPress: () => void;
}

export const SupplyCategoryGrid: React.FC<SupplyCategoryGridProps> = ({
  categories,
  title,
  columns,
  accentColor,
  onSupplyCategoryPress,
  onSeeAllPress,
}) => {
  const { width } = useWindowDimensions();
  const cardWidth = (width - totalPadding - gap * (columns - 1)) / columns;
  if (categories.length === 0) return null;

  return (
    <View style={styles.container}>
      {title ? (
        <View style={styles.headerRow}>
          <Txt maxFontSizeMultiplier={1.2} style={styles.sectionTitle}>
            {title}
          </Txt>
          <AnimatedPress accessibilityRole="button" onPress={onSeeAllPress}>
            <Txt maxFontSizeMultiplier={1.2} style={[styles.seeAllText, { color: accentColor }]}>
              View All →
            </Txt>
          </AnimatedPress>
        </View>
      ) : null}

      <View style={styles.grid}>
        {categories.map((cat) => (
          <AnimatedPress
            key={cat.id}
            accessibilityRole="button"
            accessibilityLabel={cat.name}
            style={[styles.cardItem, { width: cardWidth }]}
            onPress={() => onSupplyCategoryPress(cat)}
          >
            <View
              style={[
                styles.imageWrapper,
                { backgroundColor: categoryTint(cat), width: cardWidth, height: cardWidth },
              ]}
            >
              <Image source={categoryPicture(cat)} style={styles.image} resizeMode="contain" />
            </View>
            <Txt maxFontSizeMultiplier={1.2} style={styles.cardText} numberOfLines={2}>
              {cat.name}
            </Txt>
          </AnimatedPress>
        ))}
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
    marginBottom: 6,
    // Add subtle shadow for premium feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
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
