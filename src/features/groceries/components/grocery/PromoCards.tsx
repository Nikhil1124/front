import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPress, Txt } from '@/components/ui';

interface PromoCard {
  id: string;
  title: string;
  bgColor: string;
  imageBg: string;
  image: any;
}

const PROMO_CARDS: PromoCard[] = [
  {
    id: 'fresh-produce',
    title: 'Fresh\nProduce',
    bgColor: '#F4FFF4', // Extremely soft mint tint
    imageBg: '#DDF4DD', // Slightly deeper mint for spotlight
    image: require('../../../../../assets/productimages/promo_fresh_picks_nobg.webp'), 
  },
  {
    id: 'pantry-restock',
    title: 'Pantry\nRestock',
    bgColor: '#FFFBF4', // Extremely soft warm tint
    imageBg: '#FFECD1', // Slightly deeper warm orange for spotlight
    image: require('../../../../../assets/productimages/cat_masala_nobg.webp'), 
  },
  {
    id: 'festive-sweets',
    title: 'Festive\nSweets',
    bgColor: '#FFF4F7', // Extremely soft pink tint
    imageBg: '#FCE0E9', // Slightly deeper rose pink for spotlight
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
            {/* Product Image with Premium Backdrop */}
            <View style={styles.imageContainer}>
              <View style={[styles.imageBackdrop, { backgroundColor: card.imageBg }]} />
              <Image source={card.image} style={styles.image} resizeMode="contain" />
            </View>

            {/* Text */}
            <Txt maxFontSizeMultiplier={1.1} style={styles.title} numberOfLines={2}>
              {card.title}
            </Txt>

            {/* Premium Action Pill */}
            <View style={styles.actionPill}>
              <Txt maxFontSizeMultiplier={1.1} style={styles.actionText}>Shop Now</Txt>
              <Ionicons name="chevron-forward" size={10} color="#FFFFFF" />
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
    width: 125, // Wider for the pill
    height: 200, // Taller to fix overlaying issues and give elements breathing room
    borderRadius: 24, // Luxurious large curve
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFFFFF', // Creates a glassmorphism reflection effect
    shadowColor: '#1B1464', // Deep tinted shadow instead of harsh black
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  title: {
    fontSize: 14, // Slightly larger
    fontWeight: '800',
    color: '#1B1464', 
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B1464', // Matches the deep blue text
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 'auto', // Pushes to the bottom
    shadowColor: '#1B1464',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 2,
  },
  imageContainer: {
    width: 85,
    height: 85,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4, // Reduced to give title more space
    position: 'relative',
  },
  imageBackdrop: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35, // Perfect circle
    top: 8, // Shifted slightly down so product sits 'on' it
  },
  image: {
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
});

