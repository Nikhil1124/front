import { useWindowDimensions } from 'react-native';

/**
 * A central responsive hook providing dimensional data and sensible breakpoints.
 */
export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  
  return {
    width,
    height,
    fontScale,
    isLandscape: width > height,
    isSmallPhone: width < 360,
    isPhone: width >= 360 && width < 600,
    isTablet: width >= 600,
  };
}

/**
 * Returns dynamic horizontal padding based on screen width.
 * Compact (<380): 16px
 * Standard (380-428): 20px
 * Large (>428): 24px
 */
export function useResponsivePadding() {
  const { width } = useWindowDimensions();
  if (width < 380) return 16;
  if (width <= 428) return 20;
  return 24;
}

/**
 * Returns dynamic gaps/margins based on screen width.
 */
export function useResponsiveGap() {
  const { width } = useWindowDimensions();
  if (width < 380) return 12;
  if (width <= 428) return 16;
  return 20;
}
