import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';

export function Skeleton({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#E5E7EB',
          borderRadius: 8,
          opacity: 0.7,
        },
        style,
      ]}
    />
  );
}
