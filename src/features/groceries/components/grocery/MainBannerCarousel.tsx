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
} from 'react-native';
import { AppColors, AppFonts } from '../../theme/AppColors';
import { Ionicons } from '@expo/vector-icons';

export interface BannerConfig {
  id: string;
  image: any;
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
    image: require('../../../assets/images/banners/bulk.png'),
    title: "Kitchen Essentials",
    cta: "Shop Now",
    route: "/collection/kitchen-essentials",
    params: {
      collection: "kitchen-essentials"
    }
  },
  {
    id: "fresh-everyday",
    image: require('../../../assets/images/banners/Fresh.png'),
    title: "Fresh Everyday",
    cta: "Shop Fresh",
    route: "/collection/fresh-everyday",
    params: {
      collection: "fresh-everyday"
    }
  },
  {
    id: "monthly-stock-up",
    image: require('../../../assets/images/banners/Monthly savings.png'),
    title: "Monthly Stock Up",
    cta: "Stock Up Now",
    route: "/collection/monthly-stock-up",
    params: {
      collection: "monthly-stock-up"
    }
  },
  {
    id: "smart-savings",
    image: require('../../../assets/images/banners/buy more.png'),
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
      <TouchableOpacity
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
          <Text style={styles.ctaOverlayText}>{item.cta}</Text>
          <Ionicons name="arrow-forward" size={12} color="#0C2E4E" />
        </View>
      </TouchableOpacity>
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
    borderRadius: 18,
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
    backgroundColor: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  ctaOverlayText: {
    fontSize: 10,
    fontFamily: AppFonts.bold,
    color: '#0C2E4E',
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
    borderRadius: 3,
    backgroundColor: AppColors.border,
  },
  activeDot: {
    width: 14,
    backgroundColor: AppColors.primary,
  },
});
