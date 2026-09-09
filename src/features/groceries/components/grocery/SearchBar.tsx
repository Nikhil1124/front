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
  onCartPress,
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
        <Ionicons name="search" size={18} color={GroceryColors.textMuted} style={styles.searchIcon} />

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
            <Ionicons name="swap-vertical" size={18} color={GroceryColors.textMuted} />
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
              color={hasActiveFilters ? GroceryColors.primary : GroceryColors.textMuted}
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
    paddingVertical: 10,
    backgroundColor: GroceryColors.primaryDark,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GroceryColors.white,
    borderRadius: Radii.pill,
    height: 48,
    paddingHorizontal: 14,
    shadowColor: GroceryColors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
    height: 48,
  },
  placeholder: {
    position: 'absolute',
    fontSize: 13,
    color: GroceryColors.textMuted,
  },
  input: {
    fontSize: 13,
    color: GroceryColors.textPrimary,
    height: 48,
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
    height: 18,
    backgroundColor: GroceryColors.borderSubtle,
    marginHorizontal: 2,
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
