export interface PromotionalCampaign {
  id: string;
  title: string;
  imageUrl: any; // Allow local require() or URL string
  mediaType: 'gif' | 'webp' | 'mp4' | 'image';
  redirectUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  priority: number;
}

export function usePromotionalCampaign() {
  // Mock data for the current 3D Festive Campaign
  return {
    campaign: {
      id: 'dussehra_2026',
      title: 'Dussehra Mega Sale',
      // User's custom high-quality Animated Dussehra GIF
      imageUrl: require('../../../assets/Grocery/PGow_Dussehra_Animated_720p.gif'),
      mediaType: 'gif',
      primaryColor: '#6B0024', // Deep Maroon/Burgundy matching the reference
      secondaryColor: '#E6A800', // Gold
      accentColor: '#FFFFFF',
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 864000000).toISOString(),
      isActive: true,
      priority: 1,
    } as PromotionalCampaign | null,
    isLoading: false,
    error: null,
  };
}
