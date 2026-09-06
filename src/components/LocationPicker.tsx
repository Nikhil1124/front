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
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { Map, Camera, type CameraRef } from '@/components/maplibreCompat';

import { Txt, AnimatedPress } from '@/components/ui';
import { API, BASE_URL } from '@/config';
import { fetchWithTimeout } from '@/data/apiClient';
import { round6 } from '@/features/places/geo';
import { fetchMapStyle } from '@/features/places/mapStyle';
import { useMapReady } from '@/features/places/useMapReady';
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
  // This renders inside a full-screen `<Modal>` (OwnerRegisterScreen, Add/EditPgPropertyDialog).
  // A Modal is its own native window drawn over everything — the root layout's safe-area
  // wrapper does not apply to it — and `androidStatusBar.translucent` puts its top edge behind
  // the status bar. Without these insets the zoom buttons sat 12px from the physical top,
  // under the clock and battery, and the Confirm button sat in the Android gesture-bar strip.
  const insets = useSafeAreaInsets();
  const { locating, requestPermission, getCurrentCoordinates } = useDeviceLocation();
  const cameraRef = useRef<CameraRef>(null);
  const [centre, setCentre] = useState(initial ?? FALLBACK);
  const [zoom, setZoom] = useState(17);
  const [address, setAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const seq = useRef(0);

  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null);
  const { ready, failed, onRendered, onFailed } = useMapReady(mapStyle !== null);
  useEffect(() => {
    let live = true;
    fetchMapStyle().then((style) => {
      if (live) setMapStyle(style);
    });
    return () => {
      live = false;
    };
  }, []);

  // Ask for location on open, not only once someone taps the GPS button — a map picker with
  // no location permission has nothing better to center on than a fixed fallback city, so
  // asking upfront (rather than waiting for a tap that may never come) is what actually gets
  // this screen to a usable, personally-relevant starting point. Only overrides the pin when
  // there's no already-saved location to preserve (editing an existing property keeps its own
  // coordinates; only a brand-new pick auto-centers on the device).
  useEffect(() => {
    if (initial) return;
    let live = true;
    requestPermission().then((granted) => {
      if (!granted || !live) return;
      getCurrentCoordinates().then((pos) => {
        if (pos && live) {
          cameraRef.current?.flyTo({ center: [pos.longitude, pos.latitude], zoom: 17, duration: 500 });
        }
      });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {/* Mounted as soon as the style lands — mounting is what starts the tile fetches.
            The overlay below covers it until those tiles have actually painted. */}
        {mapStyle ? (
          <Map
            mapStyle={mapStyle}
            style={styles.map}
            onRegionDidChange={onRegionDidChange}
            onDidFinishRenderingMapFully={onRendered}
            onDidFailLoadingMap={onFailed}
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
        ) : null}

        {/* A plain overlay, not part of the map, so it stays fixed on screen while the map
            moves underneath. Offset upward by half its height so the point sits at the tip. */}
        <View pointerEvents="none" style={styles.pinWrap}>
          <Ionicons name="location" size={40} color={Colors.primary} />
        </View>

        {!ready && !failed && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.mapLoading, styles.mapOverlay]}
          >
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}

        {/* Worth surfacing rather than swallowing: this screen is in the registration flow,
            and a silently blank map here means an owner pins their property from memory. */}
        {failed && (
          <View style={[StyleSheet.absoluteFill, styles.mapLoading, styles.mapOverlay]}>
            <Ionicons name="map-outline" size={24} color={Colors.textMuted} />
            <Txt variant="caption" color={Colors.textMuted} style={{ marginTop: 6 }}>
              Map unavailable — you can still confirm the coordinates below
            </Txt>
          </View>
        )}

        <View style={[styles.zoomStack, { top: insets.top + Spacing.md }]}>
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Zoom in" accessibilityRole="button"
            style={styles.zoomBtn}
            onPress={() => cameraRef.current?.zoomTo(Math.min(20, zoom + 1), { duration: 200 })}
          >
            <Ionicons name="add" size={20} color={Colors.textInverse} />
          </AnimatedPress>
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Zoom out" accessibilityRole="button"
            style={styles.zoomBtn}
            onPress={() => cameraRef.current?.zoomTo(Math.max(3, zoom - 1), { duration: 200 })}
          >
            <Ionicons name="remove" size={20} color={Colors.textInverse} />
          </AnimatedPress>
        </View>

        <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Use my current location" accessibilityRole="button" style={styles.gpsBtn} onPress={useMyLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="locate" size={20} color={Colors.primary} />
          )}
        </AnimatedPress>
      </View>

      <View style={[styles.sheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
        <Txt variant="labelSmall" color={Colors.textMuted} style={styles.sheetLabel}>
          SELECTED LOCATION
        </Txt>
        {/* Fixed-height box, not just fixed-height text: "Locating…" is one line and a real
            address can wrap to two, and without a shared height here the sheet resizes on
            every pan settle — since it sits under the flex:1 map, that resize reflows the
            map view itself, which is what read as "the whole screen refreshing". */}
        <View style={styles.addressBox}>
          <Txt
            size={14}
            color={resolving ? Colors.textMuted : Colors.textInverse}
            numberOfLines={2}
          >
            {resolving
              ? 'Locating…'
              : (address ?? 'No address here — the coordinates will still be saved')}
          </Txt>
        </View>
        <Txt variant="caption" color={Colors.textMuted} style={{ marginBottom: Spacing.sm }}>
          {centre.latitude}, {centre.longitude}
        </Txt>

        <AnimatedPress accessibilityRole="button"
          style={styles.confirm}
          onPress={() =>
            onConfirm({
              latitude: centre.latitude,
              longitude: centre.longitude,
              formatted_address: address ?? '',
            })
          }
        >
          <Txt variant="cardTitle" color={Colors.textInverse}>
            Confirm location
          </Txt>
        </AnimatedPress>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.canvas },
  mapWindow: { flex: 1, overflow: 'hidden', backgroundColor: Colors.surface },
  map: { flex: 1 },
  mapLoading: { alignItems: 'center', justifyContent: 'center' },
  mapOverlay: { backgroundColor: Colors.surface, paddingHorizontal: Spacing.lg },
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
    borderRadius: Radii.badge,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBtn: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    padding: Spacing.lg,
    gap: Spacing.xs,
    backgroundColor: Colors.canvas,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  sheetLabel: { letterSpacing: 0.5 },
  // Two lines' worth, fixed — see the comment above `addressBox`'s usage.
  addressBox: { height: 42, justifyContent: 'center' },
  confirm: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.card,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
});
