/**
 * The property's location, as a real pinch-zoomable native map.
 *
 * MapLibre renders it; the tiles, style, sprites and glyphs all come from our own backend,
 * which proxies Ola Maps (`/v1/places/*`). No map credential ever reaches the device — Ola's
 * `api_key` carries no per-app restriction, so shipping one inside the app would hand it to
 * anyone who unzipped the APK.
 *
 * Ported from the `main` branch. Only the theme tokens changed, to this branch's own
 * `Colors`/`Spacing`/`Radii` rather than editing either side's design system.
 *
 * Renders nothing when the property has no coordinates: an ungeocoded property is a normal
 * state, not an error worth a placeholder.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { Map, Camera, ViewAnnotation } from '@/components/maplibreCompat';

import { fetchMapStyle } from '@/features/places/mapStyle';
import { useMapReady } from '@/features/places/useMapReady';
import { Colors, Radii, Spacing } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

interface Props {
  formattedAddress: string;
  latitude: string | null;
  longitude: string | null;
  /** Map height. The card is used both as a dashboard tile and inside a scrolling form. */
  height?: number;
}

export default function PropertyMap({
  formattedAddress,
  latitude,
  longitude,
  height = 150,
}: Props) {
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

  if (!latitude || !longitude) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);

  const openInMaps = () => {
    const label = encodeURIComponent(formattedAddress || 'Property');
    const url = Platform.select({
      ios: `maps://?q=${label}&ll=${lat},${lng}`,
      default: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    })!;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      ).catch(() => {});
    });
  };

  return (
    <View style={styles.card}>
      <View style={[styles.map, { height }]}>
        {/* The map mounts as soon as the style is in — it has to, since mounting is what
            starts the tile fetches. The overlay below sits on top until those tiles have
            actually painted, rather than the map being withheld until then. */}
        {mapStyle ? (
          <Map
            mapStyle={mapStyle}
            style={StyleSheet.absoluteFill}
            onDidFinishRenderingMapFully={onRendered}
            onDidFailLoadingMap={onFailed}
            logo={false}
            attribution={false}
            compass={false}
            scaleBar={false}
          >
            {/* Matches the backend's own tile floor (places/router.py's `_MIN_ZOOM`) — a
                pinch-out past it lands somewhere with no tiles at all. */}
            <Camera initialViewState={{ center: [lng, lat], zoom: 15 }} minZoom={3} />
            <ViewAnnotation lngLat={[lng, lat]} anchor="bottom">
              <Ionicons name="location" size={32} color={Colors.primary} />
            </ViewAnnotation>
          </Map>
        ) : null}

        {!ready && !failed && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.mapLoading, styles.mapOverlay]}
          >
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}

        {/* `/style.json` answers 200 with an empty style when Ola is unreachable, so a
            failure is otherwise indistinguishable from a map that simply has nothing on it. */}
        {failed && (
          <View style={[StyleSheet.absoluteFill, styles.mapLoading, styles.mapOverlay]}>
            <Ionicons name="map-outline" size={20} color={Colors.textMuted} />
            <Txt variant="caption" color={Colors.textMuted} style={{ marginTop: 4 }}>
              Map unavailable
            </Txt>
          </View>
        )}
      </View>
      <AnimatedPress accessibilityRole="button" style={styles.footer} onPress={openInMaps}>
        <Txt variant="caption" color={Colors.textMuted} style={styles.address} numberOfLines={1}>
          {formattedAddress || 'Location'}
        </Txt>
        <View style={styles.open}>
          <Ionicons name="open-outline" size={14} color={Colors.primary} />
          <Txt variant="caption" weight="600" color={Colors.primary}>
            Open
          </Txt>
        </View>
      </AnimatedPress>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radii.card,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  map: { width: '100%', backgroundColor: Colors.surface },
  mapLoading: { alignItems: 'center', justifyContent: 'center' },
  mapOverlay: { backgroundColor: Colors.surface },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  address: { flex: 1 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
