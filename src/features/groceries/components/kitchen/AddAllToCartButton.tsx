import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { AnimatedPress } from '@/components/ui';
import { Radii, Colors } from '@/theme';

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
    <AnimatedPress accessibilityRole="button"
      style={styles.button}

      onPress={onPress}
    >
      <Text maxFontSizeMultiplier={1.3} style={styles.text}>
        🛒 Add All • {totalItems} items • ₹{totalPrice}
      </Text>
    </AnimatedPress>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radii.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  text: {
    color: Colors.textInverse,
    fontSize: 13,
  },
});

export default AddAllToCartButton;
