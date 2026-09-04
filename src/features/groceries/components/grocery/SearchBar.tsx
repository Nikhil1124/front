import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Layout } from '@/theme';

const EXAMPLE_ITEMS = [
  "Search  'Tomato Puree'",
  "Search  'Fresh Milk'",
  "Search  'Onion 1kg'",
  "Search  'Amul Butter'",
  "Search  'Cold Drink'",
  "Search  'KitKat'",
];

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onFilterPress?: () => void;
  onCartPress: () => void;
  hasActiveFilters?: boolean;
  placeholderItems?: string[];
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onFilterPress,
  onCartPress,
  hasActiveFilters,
  placeholderItems
}) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [fadeAnim] = useState(() => new Animated.Value(1));

  const itemsToUse = placeholderItems || EXAMPLE_ITEMS;

  // Rotate through placeholder examples every 2.5s
  useEffect(() => {
    if (value.length > 0) return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setPlaceholderIndex((prev) => (prev + 1) % itemsToUse.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [value, itemsToUse, fadeAnim]);

  return (
    <View style={styles.wrapper}>
      {/* Main pill search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.primary} />

        <View style={styles.inputWrapper}>
          {value.length === 0 && (
            <Animated.Text
              style={[styles.animatedPlaceholder, { opacity: fadeAnim }]}
              numberOfLines={1}
            >
              {itemsToUse[placeholderIndex]}
            </Animated.Text>
          )}
          <TextInput maxFontSizeMultiplier={1.3}
            style={[styles.searchInput, value.length > 0 && styles.inputActive]}
            placeholder=""
            value={value}
            onChangeText={onChangeText}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.divider} />

        {onFilterPress ? (
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="More options" accessibilityRole="button" activeOpacity={0.7} style={styles.scanBtn} onPress={onFilterPress}>
            <Ionicons name="options-outline" size={22} color={hasActiveFilters ? Colors.primary : Colors.textSecondary} />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} style={styles.scanBtn}>
            <MaterialCommunityIcons name="line-scan" size={22} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Separate cart circle button */}
      <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Cart" accessibilityRole="button"
        style={styles.cartBtn}
        activeOpacity={0.8}
        onPress={onCartPress}
      >
        <Ionicons name="cart-outline" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 50,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Layout.shadowCard,
  },
  inputWrapper: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
    height: 50,
  },
  animatedPlaceholder: {
    position: 'absolute',
    fontSize: 13,
    color: Colors.textMuted,
  },
  searchInput: {
    fontSize: 13,
    color: Colors.textPrimary,
    height: 50,
    padding: 0,
  },
  inputActive: {
    color: Colors.textPrimary,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: Colors.borderSubtle,
    marginHorizontal: 10,
  },
  scanBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  cartBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    ...Layout.shadowCard,
  },
});
