import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function AnimatedChevron({ expanded, size = 16, color }: { expanded: boolean; size?: number; color?: string }) {
  return (
    <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
      <Ionicons name="chevron-down" size={size} color={color} />
    </View>
  );
}
