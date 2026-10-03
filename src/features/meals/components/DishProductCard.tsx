
import { View, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AnimatedPress, Txt, Row } from '@/components/ui';
import { Colors, Radii } from '@/theme';
import type { Dish } from '@/types';

interface DishProductCardProps {
  dish: Dish;
  isSelected: boolean;
  onToggle: () => void;
  /** Whether the current selected meal type is supported by this dish */
  isEligible?: boolean;
}

export function DishProductCard({ dish, isSelected, onToggle, isEligible = true }: DishProductCardProps) {
  const isCustom = dish.source === 'custom';

  return (
    <AnimatedPress
      accessibilityState={{ selected: isSelected }}
      accessibilityRole="button"
      onPress={onToggle}
      style={[
        styles.gridFoodCard,
        isSelected && styles.foodCardSelected,
        !isEligible && styles.ineligibleCard,
      ]}
    >
      <View style={styles.foodImageContainer}>
        {dish.imageUrl ? (
          <Image source={typeof dish.imageUrl === 'number' ? dish.imageUrl : { uri: dish.imageUrl }} style={styles.foodImage} />
        ) : (
          <View style={[styles.foodImage, { backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }]}>
             <Ionicons name="restaurant-outline" size={32} color={Colors.textMuted} />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsOverlay}>
          {isCustom && (
            <AnimatedPress 
              style={styles.editBtn} 
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/custom-dish/${dish.id}`);
              }}
            >
              <Ionicons name="pencil" size={14} color={Colors.primaryDark} />
            </AnimatedPress>
          )}

          <View style={[styles.foodAddBtn, isSelected && styles.foodAddBtnSelected]}>
            {isSelected ? (
              <Ionicons name="checkmark" size={16} color={Colors.textInverse} />
            ) : (
              <Ionicons name="add" size={16} color={Colors.textInverse} />
            )}
          </View>
        </View>

        {isCustom && (
          <View style={styles.customBadge}>
            <Txt size={10} weight="700" color={Colors.textInverse}>Custom</Txt>
          </View>
        )}
      </View>

      <View style={styles.foodCardBody}>
        <Row gap={6} align="center">
          <View style={[styles.vegIndicator, { borderColor: dish.dietaryType === 'veg' ? Colors.success : Colors.danger }]}>
            <View style={[styles.vegDot, { backgroundColor: dish.dietaryType === 'veg' ? Colors.success : Colors.danger }]} />
          </View>
          <Txt size={14} weight="700" color={Colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>{dish.name}</Txt>
        </Row>
        
        <Row justify="space-between" align="center" style={{ marginTop: 6 }}>
          <Row gap={4} align="center">
            <Txt size={11} weight="600" color={dish.isActive ? Colors.success : Colors.textMuted}>{dish.isActive ? 'Available' : 'Unavailable'}</Txt>
          </Row>
        </Row>
      </View>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  gridFoodCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    marginBottom: 12,
  },
  foodCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.surfaceElevated,
  },
  ineligibleCard: {
    opacity: 0.5,
  },
  foodImageContainer: {
    width: '100%',
    height: 110,
    position: 'relative',
  },
  foodImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actionsOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  foodAddBtn: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  foodAddBtnSelected: {
    backgroundColor: Colors.success,
  },
  customBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.badge,
  },
  foodCardBody: {
    padding: 10,
  },
  vegIndicator: {
    width: 12,
    height: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  }
});
