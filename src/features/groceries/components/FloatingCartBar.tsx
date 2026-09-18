
import { View, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';
import { useCartStore } from '../store/useCartStore';

export function FloatingCartBar() {
  const items = useCartStore((s) => s.items);
  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  if (cartItemCount === 0) {
    return null;
  }

  // Get up to 3 distinct item images for the avatar stack
  const previewItems = items.slice(0, 3);

  return (
    <View style={styles.floatingCartBar}>
      <AnimatedPress
        accessibilityRole="button"
        style={styles.floatingCart}
        onPress={() => router.push('/groceries/cart')}
      >
        <View style={styles.contentLeft}>
          <View style={styles.avatarStack}>
            {previewItems.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.avatarContainer,
                  { marginLeft: index > 0 ? -12 : 0, zIndex: previewItems.length - index },
                ]}
              >
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="cart" size={16} color={GroceryColors.textMuted} />
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.textContainer}>
            <Txt maxFontSizeMultiplier={1.2} style={styles.viewCartText}>
              View cart
            </Txt>
            <Txt maxFontSizeMultiplier={1.2} style={styles.itemsCountText}>
              {cartItemCount} item{cartItemCount > 1 ? 's' : ''}
            </Txt>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={24} color={GroceryColors.white} />
      </AnimatedPress>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingCartBar: {
    position: 'absolute',
    bottom: 20, // Nearer to the nav bar
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  floatingCart: {
    minWidth: '50%',
    backgroundColor: GroceryColors.primaryDark,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: GroceryColors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  contentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: GroceryColors.white,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GroceryColors.primaryDark,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radii.pill,
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: Radii.pill,
    backgroundColor: GroceryColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    justifyContent: 'center',
  },
  viewCartText: {
    color: GroceryColors.white,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  itemsCountText: {
    color: GroceryColors.white,
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
  },
});
