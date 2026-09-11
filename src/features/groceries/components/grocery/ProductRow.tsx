import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { SupplyItem } from '@/types';
import { ProductCard } from './ProductCard';
import { groupByVariant } from '../../variantGroups';

import { GroceryColors } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

interface ProductRowProps {
  title: string;
  products: SupplyItem[];
  cartItems?: Array<{ id: string; quantity: number }>;
  onAdd?: (product: SupplyItem) => void;
  onIncrease?: (productId: string, currentQty: number) => void;
  onDecrease?: (productId: string, currentQty: number) => void;
  onProductPress?: (product: SupplyItem) => void;
  onSeeAllPress?: () => void;
}

export const ProductRow: React.FC<ProductRowProps> = ({
  title,
  products,
  onProductPress,
  onSeeAllPress,
}) => {
  // One card per product, not per pack — and each card carries its whole family, so a rail
  // gets the same size picker the grid does.
  const families = groupByVariant(products);

  if (families.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Txt maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>{title}</Txt>
        <AnimatedPress accessibilityRole="button" onPress={onSeeAllPress}>
          <Txt maxFontSizeMultiplier={1.3} style={styles.seeAllText}>See All →</Txt>
        </AnimatedPress>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={families}
        keyExtractor={(family) => family[0].id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: family }) => (
          <ProductCard product={family[0]} variants={family} layout="simple" onPress={onProductPress} />
        )}
      />
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
  listContent: {
    paddingHorizontal: 16,
  },
});
