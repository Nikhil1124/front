import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress } from '@/components/ui';

const DEFAULT_PLACEHOLDERS = [
  'Search groceries, fruits, snacks...',
  "Search 'Amul Milk, Eggs, Bread'",
  "Search 'Bananas, Tomatoes...'",
  "Search 'Maggi, Noodles, Snacks'",
];

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onFilterPress?: () => void;
  onCartPress?: () => void;
  hasActiveFilters?: boolean;
  placeholderItems?: string[];
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onFilterPress,
  hasActiveFilters,
  placeholderItems,
}) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [fadeAnim] = useState(() => new Animated.Value(1));

  const items = placeholderItems || DEFAULT_PLACEHOLDERS;

  useEffect(() => {
    if (value.length > 0) return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
        setPlaceholderIndex((prev) => (prev + 1) % items.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [value, items, fadeAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        {/* Search icon */}
        <Ionicons name="search" size={18} color={GroceryColors.textSecondary} style={styles.searchIcon} />

        {/* Input / animated placeholder */}
        <View style={styles.inputWrapper}>
          {value.length === 0 && (
            <Animated.Text style={[styles.placeholder, { opacity: fadeAnim }]} numberOfLines={1}>
              {items[placeholderIndex]}
            </Animated.Text>
          )}
          <TextInput
            maxFontSizeMultiplier={1.3}
            style={styles.input}
            placeholder=""
            value={value}
            onChangeText={onChangeText}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Right icons: sort + filter */}
        <View style={styles.rightIcons}>
          <AnimatedPress
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Sort"
            onPress={onFilterPress}
            style={styles.iconButton}
          >
            <Ionicons name="swap-vertical" size={18} color={GroceryColors.textSecondary} />
          </AnimatedPress>
          <View style={styles.iconDivider} />
          <AnimatedPress
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Filter"
            onPress={onFilterPress}
            style={styles.iconButton}
          >
            <Ionicons
              name={hasActiveFilters ? 'options' : 'options-outline'}
              size={18}
              color={hasActiveFilters ? '#E6A800' : GroceryColors.textSecondary}
            />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </AnimatedPress>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Solid white
    borderRadius: Radii.card, // More rounded (card vs pill or larger)
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  searchIcon: {
    marginRight: 8,
    color: GroceryColors.textSecondary,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
    height: 52,
  },
  placeholder: {
    position: 'absolute',
    fontSize: 14,
    color: GroceryColors.textSecondary,
  },
  input: {
    fontSize: 14,
    color: GroceryColors.textPrimary,
    minHeight: 52,
    padding: 0,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: Radii.pill,
    backgroundColor: GroceryColors.discountRed,
  },
});
