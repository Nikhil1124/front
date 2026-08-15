import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface MenuTypeBadgeProps {
  type: 'veg' | 'nonVeg' | 'pureVeg';
  style?: any;
}

export const MenuTypeBadge: React.FC<MenuTypeBadgeProps> = ({ type, style }) => {
  let label = '';
  let bgColor = '';
  let textColor = '';

  switch (type) {
    case 'nonVeg':
      label = '🍗 NON-VEG DAY';
      bgColor = '#FFEBEE';
      textColor = '#C62828';
      break;
    case 'pureVeg':
      label = '🥗 PURE VEG DAY';
      bgColor = '#E8F5E9';
      textColor = '#2E7D32';
      break;
    case 'veg':
    default:
      label = '🥦 VEG DAY';
      bgColor = '#F1F8E9';
      textColor = '#558B2F';
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, style]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
export default MenuTypeBadge;
