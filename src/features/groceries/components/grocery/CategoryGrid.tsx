// @ts-nocheck
import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SupplyCategory } from '@/types';
import { Colors } from '@/theme';

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
    return '#F0FDF4'; // Rice & Grains
  }
  if (n.includes('pulse') || n.includes('dal') || n.includes('cereal') || n.includes('dry fruits')) {
    return '#FFF7ED'; // Pulses & Dal
  }
  if (n.includes('oil') || n.includes('masala') || n.includes('ghee') || n.includes('spice')) {
    return '#FFFBEB'; // Oil & Masala
  }
  if (n.includes('veg') || n.includes('fruit')) {
    return '#ECFDF5'; // Vegetables
  }
  if (n.includes('dairy') || n.includes('bread') || n.includes('bakery') || n.includes('biscuit')) {
    return '#EFF6FF'; // Dairy & Bread
  }
  if (n.includes('egg') || n.includes('chicken') || n.includes('fish') || n.includes('meat')) {
    return '#FFF7ED'; // Eggs
  }
  if (n.includes('beverage') || n.includes('drink') || n.includes('juice') || n.includes('tea') || n.includes('coffee')) {
    return '#EFF6FF'; // Beverages
  }
  if (n.includes('clean') || n.includes('hygiene') || n.includes('essential')) {
    return '#F0FDF4'; // Cleaning
  }
  return '#F0FDF4'; // Fallback very light green
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
        <Text style={styles.sectionTitle}>Shop by SupplyCategory</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={handleSeeAllPress}>
          <Text style={styles.seeAllText}>See All →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {visibleCategories.map((cat) => {
          const bgColor = getSupplyCategoryBgColor(cat.name);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.cardItem, { width: cardWidth }]}
              activeOpacity={0.8}
              onPress={() => handleSupplyCategoryPress(cat)}
            >
              <View style={[styles.imageWrapper, { backgroundColor: bgColor, width: cardWidth, height: cardWidth }]}>
                <Image
                  source={typeof cat.image === 'string' ? { uri: cat.image } : cat.image}
                  style={styles.image}
                />
              </View>
              <Text style={styles.cardText} numberOfLines={2}>
                {cat.name}
              </Text>
            </TouchableOpacity>
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
    color: '#17201A',
  },
  seeAllText: {
    fontSize: 13,
    color: '#15803D',
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
    borderRadius: 16,
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
    color: '#17201A',
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
    paddingHorizontal: 2,
  },
});
