import React, { useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { Txt } from '@/components/ui';
import { Colors } from '@/theme';

export const Map = ({ children, style }: any) => (
  <View style={[styles.fallback, style]}>
    {children}
    <Txt size={12} color={Colors.SlateMutedText} style={styles.text}>
      Map Preview (Native build required for MapLibre)
    </Txt>
  </View>
);

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
