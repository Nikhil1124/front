import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { SupplyItem } from '@/types';
import { ProductCard } from './ProductCard';
import { groupByVariant } from '../../variantGroups';

import { GroceryColors } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

const GAP = 12;

interface ProductRowProps {
  /** The heading, set in the portal. Empty: no heading. */
  title: string;
  subtitle?: string;
  products: SupplyItem[];
  /** `row` scrolls sideways; `grid` wraps into `columns` per line. */
  layout?: 'row' | 'grid';
  columns?: 2 | 3;
  /** "See All" colour — the theme's, readable on white. */
  accentColor?: string;
  onProductPress?: (product: SupplyItem) => void;
  onSeeAllPress?: () => void;
}

export const ProductRow: React.FC<ProductRowProps> = ({
  title,
  subtitle,
  products,
  layout = 'row',
  columns = 2,
  accentColor = GroceryColors.primary,
  onProductPress,
  onSeeAllPress,
}) => {
  const { width } = useWindowDimensions();
  // One card per product, not per pack — and each card carries its whole family, so a rail
  // gets the same size picker the grid does. Grouped before anything else, so a family is
  // never cut in half.
  const families = groupByVariant(products);
  if (families.length === 0) return null;

  const cellWidth = (width - 32 - GAP * (columns - 1)) / columns;

  return (
    <View style={styles.container}>
      {title ? (
        <View style={styles.sectionHeader}>
          <View style={styles.headingText}>
            <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>{title}</Txt>
            {subtitle ? (
              <Txt maxFontSizeMultiplier={1.3} style={styles.sectionSubtitle}>{subtitle}</Txt>
            ) : null}
          </View>
          {onSeeAllPress ? (
            <AnimatedPress accessibilityRole="button" onPress={onSeeAllPress}>
              <Txt maxFontSizeMultiplier={1.3} style={[styles.seeAllText, { color: accentColor }]}>
                See All →
              </Txt>
            </AnimatedPress>
          ) : null}
        </View>
      ) : null}

      {layout === 'grid' ? (
        <View style={styles.grid}>
          {families.map((family) => (
            <View key={family[0].id} style={{ width: cellWidth }}>
              <ProductCard
                product={family[0]}
                variants={family}
                layout="deal"
                onPress={onProductPress}
                style={{ width: '100%', marginRight: 0 }}
              />
            </View>
          ))}
        </View>
      ) : (
        /* A plain horizontal ScrollView, not a FlatList: nested in the screen's ScrollView a
           FlatList cannot virtualise and clipped the Add button at the card's bottom. */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {families.map((family) => (
            <ProductCard
              key={family[0].id}
              product={family[0]}
              variants={family}
              layout="simple"
              onPress={onProductPress}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headingText: {
    flexShrink: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: GroceryColors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: GroceryColors.textSecondary,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
