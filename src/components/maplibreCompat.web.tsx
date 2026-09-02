/**
 * Web fallback for MapLibre — `@maplibre/maplibre-react-native` is native-only (iOS/Android),
 * so this file (picked automatically for web builds via the `.web.tsx` extension) stands in
 * with the same component shapes LocationPicker.tsx and PropertyMap.tsx already use, so those
 * two files need no platform branching of their own.
 */
import React, { useEffect, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { Txt } from '@/components/ui';
import { Colors } from '@/theme';

export const Map = ({ children, style, onDidFinishRenderingMapFully }: any) => {
  // Honour the callback the real native Map fires. Callers gate their loading overlay on
  // it, so a stand-in that silently drops it leaves them spinning over this very message
  // until their timeout expires. There is nothing to wait for here — say so immediately.
  useEffect(() => {
    onDidFinishRenderingMapFully?.({ nativeEvent: null });
  }, [onDidFinishRenderingMapFully]);

  return (
    <View style={[styles.fallback, style]}>
      {children}
      <Txt variant="caption" color={Colors.textMuted} style={styles.text}>
        Map preview unavailable on web — open the app on iOS or Android to see the live map.
      </Txt>
    </View>
  );
};

export type CameraRef = {
  flyTo: (options: any) => void;
  zoomTo: (zoom: number, options?: any) => void;
};

export const Camera = ({ ref, ...props }: { ref?: React.Ref<CameraRef> } & Record<string, any>) => {
  useImperativeHandle(ref, () => ({
    flyTo: () => {},
    zoomTo: () => {},
  }));
  return null;
};

export const ViewAnnotation = ({ children }: any) => <View>{children}</View>;

export const UserLocation = () => null;

export default {
  Map,
  Camera,
  ViewAnnotation,
  UserLocation,
};

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: '#0E171B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  text: {
    textAlign: 'center',
    marginTop: 8,
  },
});
