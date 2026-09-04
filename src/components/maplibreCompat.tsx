import Constants, { ExecutionEnvironment } from 'expo-constants';
import React, { useEffect, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { Txt } from '@/components/ui';
import { Colors } from '@/theme';

const isExpoGo = Constants?.executionEnvironment === ExecutionEnvironment.StoreClient;

let Map: any;
let Camera: any;
let ViewAnnotation: any;

if (isExpoGo) {
  Map = ({ children, style, onDidFinishRenderingMapFully }: any) => {
    // Callers gate a loading overlay on this callback, so dropping it would hide this
    // message behind a spinner until their timeout fires.
    useEffect(() => {
      onDidFinishRenderingMapFully?.({ nativeEvent: null });
    }, [onDidFinishRenderingMapFully]);

    return (
      <View style={[styles.fallback, style]}>
        {children}
        <Txt variant="caption" color={Colors.textMuted} style={styles.text}>
          Map preview unavailable in Expo Go — use a development build to see the live map.
        </Txt>
      </View>
    );
  };
  Camera = React.forwardRef(({ ...props }: any, ref: any) => {
    useImperativeHandle(ref, () => ({
      flyTo: () => {},
      zoomTo: () => {},
    }));
    return null;
  });
  ViewAnnotation = ({ children }: any) => <View>{children}</View>;
} else {
  try {
    const MapLibre = require("@maplibre/maplibre-react-native");
    Map = MapLibre.Map;
    Camera = MapLibre.Camera;
    ViewAnnotation = MapLibre.ViewAnnotation;
  } catch (e) {
    Map = ({ children, style }: any) => <View style={style}>{children}</View>;
    Camera = () => null;
    ViewAnnotation = ({ children }: any) => <View>{children}</View>;
  }
}

export { Map, Camera, ViewAnnotation };
export type CameraRef = {
  flyTo: (options: any) => void;
  zoomTo: (zoom: number, options?: any) => void;
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
