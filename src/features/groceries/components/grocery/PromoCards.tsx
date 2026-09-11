import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { GroceryColors, Radii, Colors } from '@/theme';
import { AnimatedPress, Txt } from '@/components/ui';

interface PromoCard {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  bgColor: string;
  badgeColor: string;
  image: any;
}

const PROMO_CARDS: PromoCard[] = [
  {
    id: 'fresh-picks',
    title: 'Fresh Picks',
    subtitle: 'Fresh every day',
    badge: 'UP TO 40% OFF',
    bgColor: '#FFF3E0', // Light warm beige/yellow
    badgeColor: GroceryColors.discountRed,
    image: require('../../../../../assets/productimages/promo_fresh_picks_nobg.webp'),
  },
  {
    id: 'pantry-restock',
    title: 'Pantry Restock',
    subtitle: 'Stock up & save',
    badge: 'UP TO 35% OFF',
    bgColor: '#FFF8E1', // Lighter yellow
    badgeColor: Colors.warning, // Amber
    image: require('../../../../../assets/productimages/cat_masala_nobg.webp'),
  },
  {
    id: 'breakfast-time',
    title: 'Breakfast...',
    subtitle: 'Start fresh every day',
    badge: 'FROM ₹49',
    bgColor: '#E0F2FE', // Light sky blue
    badgeColor: '#38BDF8', // Light blue
    image: require('../../../../../assets/productimages/d1_nobg.webp'),
  },
];

interface PromoCardsProps {
  onCardPress?: (cardId: string) => void;
}

export const PromoCards: React.FC<PromoCardsProps> = ({ onCardPress }) => {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {PROMO_CARDS.map((card) => (
          <AnimatedPress
            key={card.id}
            accessibilityRole="button"
            scale={0.97}
            style={[styles.card, { backgroundColor: card.bgColor }]}
            onPress={() => onCardPress?.(card.id)}
          >
            {/* Text */}
            <Txt maxFontSizeMultiplier={1.1} style={styles.title} numberOfLines={1}>
              {card.title}
            </Txt>
            <Txt maxFontSizeMultiplier={1.1} style={styles.subtitle} numberOfLines={1}>
              {card.subtitle}
            </Txt>

            {/* Badge */}
            <View style={[styles.badge, { backgroundColor: card.badgeColor }]}>
              <Txt maxFontSizeMultiplier={1.1} style={styles.badgeText}>
                {card.badge}
              </Txt>
            </View>

            {/* Product Image */}
            <View style={styles.imageWrapper}>
              <Image source={card.image} style={styles.image} resizeMode="contain" />
            </View>
          </AnimatedPress>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 4,
    marginBottom: 16, // Extra margin before the white section starts
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: 140, // slightly wider
    height: 160,
    borderRadius: Radii.card,
    paddingTop: 14,
    paddingHorizontal: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: GroceryColors.textPrimary,
  },
  subtitle: {
    fontSize: 10,
    color: GroceryColors.textSecondary,
    marginTop: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: GroceryColors.white,
    letterSpacing: 0.3,
  },
  imageWrapper: {
    position: 'absolute',
    bottom: -10, // overlap bottom edge
    alignSelf: 'center',
    width: 100,
    height: 90,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

