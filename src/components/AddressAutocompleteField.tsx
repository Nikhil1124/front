/**
 * The address input, with the provider's suggestions under it.
 *
 * Only the address *string* is taken from a suggestion. The coordinates still come from the
 * map pin next to this field, because a geocoder's idea of where "Royal Meadows" is and the
 * building the owner actually runs are frequently not the same point — and the pin is the one
 * the residents will navigate to.
 *
 * The field itself is the same `OutlinedTextField` as every other row on the form; typing by
 * hand works exactly as before, and the list is purely additive. It appears on the
 * registration form, so every call it makes is unauthenticated by design.
 */
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Txt } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { usePlaces } from '@/features/places/usePlaces';
import { Colors, Radii, Spacing } from '@/theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  testID?: string;
  style?: object;
}

export function AddressAutocompleteField({ label, value, onChangeText, testID, style }: Props) {
  const { suggestions, searching, search, endSession } = usePlaces();
  // Suppressed after a pick, so choosing a suggestion doesn't immediately re-search the text
  // it just wrote and reopen the list under the user's finger.
  const [open, setOpen] = useState(false);

  const handleChange = (v: string) => {
    onChangeText(v);
    setOpen(true);
    search(v);
  };

  const choose = (line: string) => {
    onChangeText(line);
    setOpen(false);
    endSession();
  };

  return (
    <View style={style}>
      <OutlinedTextField
        label={label}
        value={value}
        onChangeText={handleChange}
        leadingIcon="location"
        testID={testID}
      />
      {open && (searching || suggestions.length > 0) && (
        <View style={styles.dropdown}>
          {searching && suggestions.length === 0 ? (
            <Txt variant="caption" color={Colors.SlateMutedText} style={styles.searching}>
              Searching…
            </Txt>
          ) : (
            suggestions.map((s) => (
              <TouchableOpacity
                key={s.place_id}
                onPress={() => choose([s.primary, s.secondary].filter(Boolean).join(', '))}
                style={styles.row}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={16} color={Colors.SlateMutedText} />
                <View style={styles.rowText}>
                  <Txt variant="caption" weight="700" color={Colors.IvoryWhiteText} numberOfLines={1}>
                    {s.primary}
                  </Txt>
                  {s.secondary ? (
                    <Txt variant="labelSmall" weight="400" color={Colors.SlateMutedText} numberOfLines={1}>
                      {s.secondary}
                    </Txt>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    borderWidth: 1,
    borderColor: Colors.LuxuryCardBorder,
    borderRadius: Radii.lg,
    backgroundColor: Colors.LuxurySurfaceDark,
    marginTop: 4,
    overflow: 'hidden',
  },
  searching: { padding: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  rowText: { flex: 1, gap: 1 },
});
