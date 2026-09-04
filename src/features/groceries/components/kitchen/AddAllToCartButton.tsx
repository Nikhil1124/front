import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors } from '@/theme';

interface AddAllToCartButtonProps {
  totalItems: number;
  totalPrice: number;
  onPress: () => void;
}

export const AddAllToCartButton: React.FC<AddAllToCartButtonProps> = ({
  totalItems,
  totalPrice,
  onPress,
}) => {
  return (
    <TouchableOpacity accessibilityRole="button"
      style={styles.button}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Text maxFontSizeMultiplier={1.3} style={styles.text}>
        🛒 Add All • {totalItems} items • ₹{totalPrice}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#15803D',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    shadowColor: '#17201A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
  },
});

export default AddAllToCartButton;
