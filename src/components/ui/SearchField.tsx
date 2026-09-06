/**
 * SearchField — the box you filter a list with.
 *
 * Split out from `OutlinedTextField` deliberately rather than reusing it. A search box is not
 * a form field: it has no label above it (the magnifier says what it is), nothing to validate,
 * no required state, and no submit — it filters as you type and the list underneath is the
 * feedback. Giving it a label slot and an error slot would be giving it two things it must
 * never use.
 *
 * It was hand-rolled eight times across seven screens before this — grocery search, category
 * search, property search, expense search, collection search, staff search (twice), service
 * search — at three different heights and two different corner radii, each with its own
 * `searchBar` style block. Same failure shape as the eighteen headers.
 *
 * The clear button is the part most of those copies were missing: filtering a long list and
 * then having to backspace fourteen characters to see it again is the single most common
 * complaint about a search box that has no way out.
 */
import { useState } from 'react';
import { View, TextInput, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedPress } from './AnimatedPress';
import { Colors, Radii } from '@/theme';
import { fontFamilyForWeight } from '@/theme/typography';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Name what's being searched — "Search staff by name or phone". A bare "Search…" makes
   *  the person guess which fields it looks at. */
  placeholder?: string;
  autoFocus?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function SearchField({
  value, onChangeText, placeholder = 'Search', autoFocus = false, style, testID,
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[
      styles.box,
      focused && styles.boxFocused,
      style,
    ]}>
      <Ionicons name="search" size={17} color={focused ? Colors.primary : Colors.textMuted} />
      <TextInput
        testID={testID}
        accessibilityLabel={placeholder}
        maxFontSizeMultiplier={1.3}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        // `while-editing` is iOS-only and draws a second, native clear button beside ours.
        clearButtonMode="never"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
      {value.length > 0 ? (
        <AnimatedPress
          scale={0.9}
          onPress={() => onChangeText('')}
          accessibilityLabel="Clear search"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
        </AnimatedPress>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: Radii.control,
    backgroundColor: Colors.surfaceMuted,
    // Transparent at rest rather than absent, so focusing doesn't move the list below it.
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxFocused: {
    backgroundColor: Colors.surface,
    borderColor: Colors.primary,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilyForWeight('400'),
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: Colors.textPrimary,
    padding: 0,
  },
});
