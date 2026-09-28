import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPress, Txt } from '@/components/ui';

import type { StorefrontCard } from '../../useStorefront';
import { storefrontImage } from '../../useStorefront';

/** A slightly deeper shade of the card's tint, for the circle behind its picture. */
function deeper(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const shade = (c: number) => Math.round(c * 0.92);
  const r = shade((n >> 16) & 255), g = shade((n >> 8) & 255), b = shade(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

interface PromoCardsProps {
  /** From the storefront, set in the portal. */
  cards: StorefrontCard[];
  onCardPress: (card: StorefrontCard) => void;
}

export const PromoCards: React.FC<PromoCardsProps> = ({ cards, onCardPress }) => {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {cards.map((card, index) => {
          const source = storefrontImage(card.image_url, card.builtin_image);
          return (
            <AnimatedPress
              key={`${index}-${card.title}`}
              accessibilityRole="button"
              scale={0.97}
              style={[styles.card, { backgroundColor: card.tint }]}
              onPress={() => onCardPress(card)}
            >
              {/* Product Image with Premium Backdrop */}
              <View style={styles.imageContainer}>
                <View style={[styles.imageBackdrop, { backgroundColor: deeper(card.tint) }]} />
                {source ? <Image source={source} style={styles.image} resizeMode="contain" /> : null}
              </View>

              {/* Text */}
              <Txt maxFontSizeMultiplier={1.1} style={styles.title} numberOfLines={2}>
                {card.title}
              </Txt>
              {card.subtitle ? (
                <Txt maxFontSizeMultiplier={1.1} style={styles.subtitle} numberOfLines={1}>
                  {card.subtitle}
                </Txt>
              ) : null}

              {/* Premium Action Pill */}
              <View style={styles.actionPill}>
                <Txt maxFontSizeMultiplier={1.1} style={styles.actionText}>Shop Now</Txt>
                <Ionicons name="chevron-forward" size={10} color="#FFFFFF" />
              </View>
            </AnimatedPress>
          );
        })}
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
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5A5F7A',
    textAlign: 'center',
    marginTop: 2,
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

