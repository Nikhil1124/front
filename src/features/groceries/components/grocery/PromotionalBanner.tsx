import React from 'react';
import { StyleSheet, View, Image, useWindowDimensions, Linking } from 'react-native';
import { GroceryColors, Radii } from '@/theme';
import { AnimatedPress } from '@/components/ui';
import { PromotionalCampaign } from '../../usePromotionalCampaign';

interface PromotionalBannerProps {
  campaign: PromotionalCampaign;
  onPress?: (campaign: PromotionalCampaign) => void;
}

export const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ campaign, onPress }) => {
  const { width } = useWindowDimensions();
  
  // Calculate dynamic height to maintain a premium wide aspect ratio (e.g., 16:9 or similar)
  const bannerWidth = width;
  // A slightly taller aspect ratio for the seamless hero shot
  const bannerHeight = bannerWidth * 0.75; 

  const handlePress = () => {
    if (onPress) {
      onPress(campaign);
    } else if (campaign.redirectUrl) {
      Linking.openURL(campaign.redirectUrl);
    }
  };

  return (
    <AnimatedPress accessibilityRole="button" onPress={handlePress} style={styles.outerContainer}>
      <View style={[styles.bannerWrapper, { width: bannerWidth, height: bannerHeight }]}>
        <Image 
          source={typeof campaign.imageUrl === 'number' ? campaign.imageUrl : { uri: campaign.imageUrl }} 
          style={styles.image} 
          resizeMode="cover"
        />
      </View>
    </AnimatedPress>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bannerWrapper: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent', 
  },
  image: {
    width: '100%',
    height: '100%',
  },

});
