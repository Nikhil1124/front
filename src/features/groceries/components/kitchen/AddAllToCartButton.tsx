import React from 'react';
import { StyleSheet } from 'react-native';

;
import { Radii, Colors } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

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
      <Txt maxFontSizeMultiplier={1.3} style={styles.text}>
        🛒 Add All • {totalItems} items • ₹{totalPrice}
      </Txt>
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
