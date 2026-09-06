/**
 * The address input, with the provider's suggestions under it.
 *
 * When a suggestion is chosen, the component:
 *  1. Fills the text field with the address string (as before).
 *  2. Resolves the `place_id` to lat/lng via our backend's `/place-details` endpoint.
 *  3. Fires `onLocationResolved` so the parent can pre-seed the map pin — the user no
 *     longer has to open the map just to confirm a location they already typed.
 *
 * The map pin is still the **authoritative** source: if the owner opens the picker and
 * moves the pin, that wins. `onLocationResolved` is just the first reasonable estimate.
 *
 * The field itself is the same `OutlinedTextField` as every other row on the form; typing
 * by hand works exactly as before, and the list is purely additive. It appears on the
 * registration form, so every call it makes is unauthenticated by design.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { usePlaces } from '@/features/places/usePlaces';
import { API, BASE_URL } from '@/config';
import { fetchWithTimeout } from '@/data/apiClient';
import { Colors, Radii, Spacing } from '@/theme';
import type { PickedLocation } from '@/features/places/pendingLocation';
import { AnimatedPress, Txt } from '@/components/ui';

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  /**
   * Called after the user picks a suggestion **and** the backend resolves it to
   * coordinates. Use this to pre-position the map pin. Optional: the field works
   * fine without it, it just won't update the map.
   */
  onLocationResolved?: (location: PickedLocation) => void;
  /** Forwarded to the `OutlinedTextField` this wraps — it is a form field like any other. */
  error?: string;
  required?: boolean;
  testID?: string;
  style?: object;
}

export function AddressAutocompleteField({
  label,
  value,
  onChangeText,
  onLocationResolved,
  testID,
  style, error, required}: Props) {
  const { suggestions, searching, search, endSession } = usePlaces();
  // Suppressed after a pick, so choosing a suggestion doesn't immediately re-search the text
  // it just wrote and reopen the list under the user's finger.
  const [open, setOpen] = useState(false);

  const handleChange = (v: string) => {
    onChangeText(v);
    setOpen(true);
    search(v);
  };

  const choose = (line: string, placeId: string) => {
    onChangeText(line);
    setOpen(false);
    endSession();

    // Resolve coordinates for map sync — fire-and-forget; never block the UI.
    if (onLocationResolved) {
      fetchWithTimeout(`${BASE_URL}${API.PLACES_PLACE_DETAILS}?place_id=${encodeURIComponent(placeId)}`)
        .then((res) => (res.status === 200 ? res.json() : null))
        .then((body: { latitude: number; longitude: number; formatted_address: string; place_id: string } | null) => {
          if (!body || body.latitude == null || body.longitude == null) return;
          onLocationResolved({
            latitude: body.latitude,
            longitude: body.longitude,
            formatted_address: body.formatted_address || line,
          });
        })
        .catch(() => {
          // Network or provider error — silently skip; the map picker is still available.
        });
    }
  };

  return (
    <View style={style}>
      <OutlinedTextField
        label={label}
        value={value}
        onChangeText={handleChange}
        leadingIcon="location"
        error={error}
        required={required}
        testID={testID}
      />
      {open && (searching || suggestions.length > 0) && (
        <View style={styles.dropdown}>
          {searching && suggestions.length === 0 ? (
            <Txt variant="caption" color={Colors.textMuted} style={styles.searching}>
              Searching…
            </Txt>
          ) : (
            suggestions.map((s) => (
              <AnimatedPress accessibilityRole="button"
                key={s.place_id}
                onPress={() => choose([s.primary, s.secondary].filter(Boolean).join(', '), s.place_id)}
                style={styles.row}
              >
                <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
                <View style={styles.rowText}>
                  <Txt variant="caption" weight="700" color={Colors.textPrimary} numberOfLines={1}>
                    {s.primary}
                  </Txt>
                  {s.secondary ? (
                    <Txt variant="labelSmall" weight="400" color={Colors.textMuted} numberOfLines={1}>
                      {s.secondary}
                    </Txt>
                  ) : null}
                </View>
              </AnimatedPress>
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
    borderColor: Colors.borderSubtle,
    borderRadius: Radii.control,
    backgroundColor: Colors.surface,
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
