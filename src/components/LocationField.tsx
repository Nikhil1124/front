/**
 * The "where is this property" row on a property form.
 *
 * Presentation only — it shows what has been picked and reports a tap. Opening the picker is
 * the parent's job because the two parents need different mechanics: the property dialogs
 * are themselves inside a `Modal` and swap their own content, while the registration screen
 * is an ordinary screen and can present one.
 *
 * A location is not optional: the API refuses to create a property without one, since a PG
 * nobody can find on a map is not much use to whoever is deciding whether to move in.
 */
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Txt } from '@/components/ui';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { Colors, Radii, Spacing } from '@/theme';

interface Props {
  value: PickedLocation | null;
  onPress: () => void;
  /** Falls back to the property's stored address when editing one that is already placed. */
  placeholder?: string;
}

export function LocationField({ value, onPress, placeholder }: Props) {
  const picked = value !== null;
  const summary = value
    ? value.formatted_address ||
      `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
    : (placeholder ?? 'Pin the location on the map *');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.row, picked && styles.rowPicked]}
      testID="location_field"
    >
      <Ionicons
        name={picked ? 'location' : 'map-outline'}
        size={18}
        color={picked ? Colors.CyberGreen : Colors.SlateMutedText}
      />
      <View style={styles.text}>
        <Txt size={9} weight="700" color={Colors.SlateMutedText} style={styles.label}>
          PROPERTY LOCATION
        </Txt>
        <Txt
          size={12}
          color={picked ? Colors.IvoryWhiteText : Colors.SlateMutedText}
          numberOfLines={2}
        >
          {summary}
        </Txt>
      </View>
      <Txt size={11} weight="700" color={Colors.CyberGreen}>
        {picked ? 'Change' : 'Pick'}
      </Txt>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.LuxuryCardBorder,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rowPicked: { borderColor: Colors.CyberGreen },
  text: { flex: 1, gap: 2 },
  label: { letterSpacing: 0.5 },
});
