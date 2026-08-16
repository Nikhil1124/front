/**
 * Pick a location on a real, native, pinch-zoomable map.
 *
 * The pin never moves; the map does, underneath a pin fixed at the screen's centre. That is
 * the pattern every Indian delivery app uses, and it is the right one here — it keeps the
 * target under the user's thumb instead of under their finger, and "what am I choosing" stays
 * unambiguous: whatever is under the pin.
 *
 * This exists because search is not enough. A large share of PG addresses are informal —
 * unlisted buildings, "behind the temple", lanes with no name — and no geocoder will find
 * them. Pointing at the map is the only accurate route, and for those properties it is the
 * difference between a pin on the building and a pin on the wrong side of the suburb.
 *
 * Ported from the `main` branch; only the theme tokens changed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { Map, Camera, type CameraRef } from '@/components/maplibreCompat';

import { Txt } from '@/components/ui';
import { API, BASE_URL } from '@/config';
import { fetchWithTimeout } from '@/data/apiClient';
import { round6 } from '@/features/places/geo';
import { fetchMapStyle } from '@/features/places/mapStyle';
import { useDeviceLocation } from '@/features/places/useDeviceLocation';
import { Colors, Radii, Spacing } from '@/theme';

interface Props {
  /** Where to open. Falls back to the city centre when the owner hasn't searched yet. */
  initial?: { latitude: number; longitude: number } | null;
  onConfirm: (picked: {
    latitude: number;
    longitude: number;
    formatted_address: string;
  }) => void;
}

/** Hyderabad. Only used when there is no search result and no GPS fix to open on. */
const FALLBACK = { latitude: 17.4401, longitude: 78.3489 };

export default function LocationPicker({ initial, onConfirm }: Props) {
  const { locating, getCurrentCoordinates } = useDeviceLocation();
  const cameraRef = useRef<CameraRef>(null);
  const [centre, setCentre] = useState(initial ?? FALLBACK);
  const [zoom, setZoom] = useState(17);
  const [address, setAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const seq = useRef(0);

  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null);
  useEffect(() => {
    let live = true;
    fetchMapStyle().then((style) => {
      if (live) setMapStyle(style);
    });
    return () => {
      live = false;
    };
  }, []);

  // Resolve the address under the pin whenever it settles somewhere new. Debounced, and
  // sequence-guarded so a slow reply for an old position cannot overwrite a newer one.
  const onRegionDidChange = useCallback(
    (event: { nativeEvent: { center: [number, number]; zoom: number } }) => {
      const [lng, lat] = event.nativeEvent.center;
      setZoom(event.nativeEvent.zoom);
      const next = { latitude: round6(lat), longitude: round6(lng) };
      setCentre(next);

      const mine = ++seq.current;
      setResolving(true);
      // No auth header: this screen also runs during registration, before an account exists.
      // The route is IP-rate-limited server-side instead.
      fetchWithTimeout(
        `${BASE_URL}${API.PLACES_REVERSE_GEOCODE}?lat=${next.latitude}&lng=${next.longitude}`
      )
        .then((res) => (res.status === 200 ? res.json() : null))
        .then((body) => {
          if (mine !== seq.current) return;
          setAddress(body?.formatted_address ?? null);
        })
        .catch(() => {
          if (mine === seq.current) setAddress(null);
        })
        .finally(() => {
          if (mine === seq.current) setResolving(false);
        });
    },
    []
  );

  const useMyLocation = async () => {
    const pos = await getCurrentCoordinates();
    if (pos) {
      cameraRef.current?.flyTo({
        center: [pos.longitude, pos.latitude],
        zoom: 18,
        duration: 600,
      });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.mapWindow}>
        {mapStyle ? (
          <Map
            mapStyle={mapStyle}
            style={styles.map}
            onRegionDidChange={onRegionDidChange}
            logo={false}
            attribution={false}
            compass={false}
            scaleBar={false}
          >
            <Camera
              ref={cameraRef}
              initialViewState={{ center: [centre.longitude, centre.latitude], zoom }}
              // The zoom-out button already clamps at 3 (matching the backend's own tile
              // floor — see places/router.py's `_MIN_ZOOM`), but a pinch gesture is not
              // stopped by that and can zoom past it into a range with no tiles at all,
              // which just looks like the map broke. This clamps the gesture itself.
              minZoom={3}
            />
          </Map>
        ) : (
          <View style={[styles.map, styles.mapLoading]}>
            <ActivityIndicator color={Colors.CyberGreen} />
          </View>
        )}

        {/* A plain overlay, not part of the map, so it stays fixed on screen while the map
            moves underneath. Offset upward by half its height so the point sits at the tip. */}
        <View pointerEvents="none" style={styles.pinWrap}>
          <Ionicons name="location" size={40} color={Colors.CyberGreen} />
        </View>

        <View style={styles.zoomStack}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => cameraRef.current?.zoomTo(Math.min(20, zoom + 1), { duration: 200 })}
          >
            <Ionicons name="add" size={20} color={Colors.IvoryWhiteText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => cameraRef.current?.zoomTo(Math.max(3, zoom - 1), { duration: 200 })}
          >
            <Ionicons name="remove" size={20} color={Colors.IvoryWhiteText} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.gpsBtn} onPress={useMyLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color={Colors.CyberGreen} />
          ) : (
            <Ionicons name="locate" size={20} color={Colors.CyberGreen} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sheet}>
        <Txt size={10} weight="700" color={Colors.SlateMutedText} style={styles.sheetLabel}>
          SELECTED LOCATION
        </Txt>
        {/* Fixed-height box, not just fixed-height text: "Locating…" is one line and a real
            address can wrap to two, and without a shared height here the sheet resizes on
            every pan settle — since it sits under the flex:1 map, that resize reflows the
            map view itself, which is what read as "the whole screen refreshing". */}
        <View style={styles.addressBox}>
          <Txt
            size={14}
            color={resolving ? Colors.SlateMutedText : Colors.IvoryWhiteText}
            numberOfLines={2}
          >
            {resolving
              ? 'Locating…'
              : (address ?? 'No address here — the coordinates will still be saved')}
          </Txt>
        </View>
        <Txt size={11} color={Colors.SlateMutedText} style={{ marginBottom: Spacing.sm }}>
          {centre.latitude}, {centre.longitude}
        </Txt>

        <TouchableOpacity
          style={styles.confirm}
          onPress={() =>
            onConfirm({
              latitude: centre.latitude,
              longitude: centre.longitude,
              formatted_address: address ?? '',
            })
          }
        >
          <Txt size={14} weight="700" color={Colors.LuxuryPureBlack}>
            Confirm location
          </Txt>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.LuxuryPureBlack },
  mapWindow: { flex: 1, overflow: 'hidden', backgroundColor: Colors.LuxurySurfaceDark },
  map: { flex: 1 },
  mapLoading: { alignItems: 'center', justifyContent: 'center' },
  pinWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    // Half the icon height, so the pin's tip marks the centre rather than its middle.
    marginBottom: 40,
  },
  zoomStack: { position: 'absolute', right: Spacing.md, top: Spacing.md, gap: Spacing.xs },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.sm,
    backgroundColor: Colors.LuxurySurfaceDark,
    borderWidth: 1,
    borderColor: Colors.LuxuryCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBtn: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.LuxurySurfaceDark,
    borderWidth: 1,
    borderColor: Colors.CyberGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    padding: Spacing.lg,
    gap: Spacing.xs,
    backgroundColor: Colors.LuxuryPureBlack,
    borderTopWidth: 1,
    borderTopColor: Colors.LuxuryCardBorder,
  },
  sheetLabel: { letterSpacing: 0.5 },
  // Two lines' worth, fixed — see the comment above `addressBox`'s usage.
  addressBox: { height: 42, justifyContent: 'center' },
  confirm: {
    backgroundColor: Colors.CyberGreen,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
});
