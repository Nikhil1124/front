import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ImageSourcePropType,
} from 'react-native';

import { AnimatedPress } from '@/components/ui';
import { Radii, Colors } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export interface BannerConfig {
  id: string;
  image: ImageSourcePropType;
  title: string;
  cta: string;
  route: string;
  params: {
    collection: string;
  };
}

export const homeBanners: BannerConfig[] = [
  {
    id: "kitchen-essentials",
    // TODO: swap for a real "kitchen essentials" marketing banner. The original
    // require() pointed at assets/images/banners/bulk.png, a file (and directory)
    // that doesn't exist anywhere in the repo - it crashed Metro bundling for the
    // whole app. Standing in with an existing on-theme photo until real banner
    // art is supplied.
    image: require('../../../../../assets/img_meal_service_ad_1784642265436.jpg'),
    title: "Kitchen Essentials",
    cta: "Shop Now",
    route: "/collection/kitchen-essentials",
    params: {
      collection: "kitchen-essentials"
    }
  },
  {
    id: "fresh-everyday",
    // TODO: swap for a real "fresh everyday" marketing banner (see note above).
    image: require('../../../../../assets/pg_grocery_eggs_1785343431667.jpg'),
    title: "Fresh Everyday",
    cta: "Shop Fresh",
    route: "/collection/fresh-everyday",
    params: {
      collection: "fresh-everyday"
    }
  },
  {
    id: "monthly-stock-up",
    // TODO: swap for a real "monthly stock up" marketing banner (see note above).
    image: require('../../../../../assets/img_premium_subscription.jpg'),
    title: "Monthly Stock Up",
    cta: "Stock Up Now",
    route: "/collection/monthly-stock-up",
    params: {
      collection: "monthly-stock-up"
    }
  },
  {
    id: "smart-savings",
    // TODO: swap for a real "smart savings" marketing banner (see note above).
    image: require('../../../../../assets/pg_grocery_milk_1785343413850.jpg'),
    title: "Smart Savings",
    cta: "Shop & Save",
    route: "/collection/smart-savings",
    params: {
      collection: "smart-savings"
    }
  }
];

interface MainBannerCarouselProps {
  onBannerPress?: (banner: BannerConfig) => void;
}

export const MainBannerCarousel: React.FC<MainBannerCarouselProps> = ({ onBannerPress }) => {
  const { width: screenWidth } = useWindowDimensions();
  
  const itemWidth = 320; // Fixed width
  const gap = 12;
  const snapInterval = itemWidth + gap;
  const sideMargin = (screenWidth - itemWidth) / 2;

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<BannerConfig>>(null);
  const isInteracting = useRef(false);

  // Auto scroll effect
  useEffect(() => {
    const timer = setInterval(() => {
      if (isInteracting.current) return;
      
      const nextIndex = (activeIndex + 1) % homeBanners.length;
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * snapInterval,
        animated: true,
      });
      setActiveIndex(nextIndex);
    }, 4000);

    return () => clearInterval(timer);
  }, [activeIndex, snapInterval]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / snapInterval);
    if (index >= 0 && index < homeBanners.length) {
      setActiveIndex(index);
    }
  };

  const renderItem = ({ item }: { item: BannerConfig }) => {
    return (
      <AnimatedPress accessibilityRole="button"
        style={[styles.bannerContainer, { width: itemWidth, marginRight: gap }]}
        activeOpacity={0.95}
        onPress={() => onBannerPress?.(item)}
      >
        <Image
          source={item.image}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.ctaOverlayButton}>
          <Text maxFontSizeMultiplier={1.3} style={styles.ctaOverlayText}>{item.cta}</Text>
          <Ionicons name="arrow-forward" size={12} color={Colors.primary} />
        </View>
      </AnimatedPress>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={homeBanners}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingLeft: sideMargin,
          paddingRight: sideMargin - gap, // Adjust for the last element's margin
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          isInteracting.current = true;
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            isInteracting.current = false;
          }, 1500);
        }}
      />

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {homeBanners.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              activeIndex === i ? styles.activeDot : null,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  bannerContainer: {
    borderRadius: Radii.card,
    overflow: 'hidden',
    height: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  ctaOverlayButton: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radii.control,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  ctaOverlayText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.borderSubtle,
  },
  activeDot: {
    width: 14,
    backgroundColor: Colors.primary,
  },
});
