import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SupplyItem } from '@/types';
import { ProductCard } from './ProductCard';

import { Colors } from '@/theme';

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
  const { width } = useWindowDimensions();
  const cardWidth = width > 600 ? 165 : width * 0.43;

  if (products.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={onSeeAllPress}>
          <Text maxFontSizeMultiplier={1.3} style={styles.seeAllText}>See All →</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          return (
            <ProductCard
              product={item}
              onPress={onProductPress}
            />
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
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
    color: Colors.textPrimary,
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.primary,
  },
  listContent: {
    paddingHorizontal: 16,
  },
});
