import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

// Base dimensions (e.g., iPhone 12/13/14 Pro - 390x844)
const guidelineBaseWidth = 390;
const guidelineBaseHeight = 844;

function getWindowMetrics() {
  const { width = 390, height = 844 } = Dimensions.get('window') || {};
  const validW = width > 0 ? width : 390;
  const validH = height > 0 ? height : 844;
  return {
    width: validW,
    height: validH,
    short: validW < validH ? validW : validH,
    long: validW < validH ? validH : validW,
  };
}

/**
 * Returns a percentage of the screen width
 * e.g., wp('50%') returns half of the screen width
 */
export const wp = (widthPercent: number | string): number => {
  const { width } = getWindowMetrics();
  const elemWidth = typeof widthPercent === "number" ? widthPercent : parseFloat(widthPercent);
  return PixelRatio.roundToNearestPixel((width * elemWidth) / 100);
};

/**
 * Returns a percentage of the screen height
 */
export const hp = (heightPercent: number | string): number => {
  const { height } = getWindowMetrics();
  const elemHeight = typeof heightPercent === "number" ? heightPercent : parseFloat(heightPercent);
  return PixelRatio.roundToNearestPixel((height * elemHeight) / 100);
};

/**
 * Scales based on width. Good for horizontal margins, paddings, widths, etc.
 */
export const scale = (size: number): number => {
  const { short } = getWindowMetrics();
  return (short / guidelineBaseWidth) * size;
};

/**
 * Scales based on height. Good for vertical margins, paddings, heights, etc.
 */
export const verticalScale = (size: number): number => {
  const { long } = getWindowMetrics();
  return (long / guidelineBaseHeight) * size;
};

/**
 * Non-linear scaling. The factor controls how much it scales. 
 * factor=0 is no scale, factor=1 is full linear scale (same as scale()).
 * Good for font sizes and icons where we don't want them to get too huge on tablets.
 */
export const moderateScale = (size: number, factor = 0.5): number => {
  return PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor);
};

/**
 * Responsive Font Size - Caps the maximum scale on large screens
 */
export const responsiveFontSize = (size: number, options?: { min?: number, max?: number }): number => {
  let scaledSize = moderateScale(size, 0.4);
  if (options?.min && scaledSize < options.min) scaledSize = options.min;
  if (options?.max && scaledSize > options.max) scaledSize = options.max;
  return PixelRatio.roundToNearestPixel(scaledSize);
};

/**
 * Responsive Spacing (padding, margin, gap)
 */
export const responsiveSpacing = (size: number): number => {
  return PixelRatio.roundToNearestPixel(moderateScale(size, 0.5));
};

/**
 * Standard Breakpoints
 */
export const Breakpoints = {
  compact: 359,     // < 360px
  small: 389,       // 360-389px
  large: 599,       // 390-599px
  tablet: 600,      // 600px+
} as const;

/**
 * Static breakpoint helpers (evaluated on load, useful outside of React components)
 */
export const isCompactPhone = getWindowMetrics().width <= Breakpoints.compact;
export const isSmallPhone = getWindowMetrics().width > Breakpoints.compact && getWindowMetrics().width <= Breakpoints.small;
export const isLargePhone = getWindowMetrics().width > Breakpoints.small && getWindowMetrics().width <= Breakpoints.large;
export const isTablet = getWindowMetrics().width >= Breakpoints.tablet;
export const isLandscape = getWindowMetrics().width > getWindowMetrics().height;

/**
 * A central responsive hook providing dimensional data that re-renders on orientation changes.
 */
export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  
  const currentIsLandscape = width > height;
  const currentShortDimension = currentIsLandscape ? height : width;

  return {
    width,
    height,
    fontScale,
    isLandscape: currentIsLandscape,
    isCompact: currentShortDimension <= Breakpoints.compact,
    isSmallPhone: currentShortDimension > Breakpoints.compact && currentShortDimension <= Breakpoints.small,
    isPhone: currentShortDimension >= 360 && currentShortDimension < Breakpoints.tablet,
    isLargePhone: currentShortDimension > Breakpoints.small && currentShortDimension <= Breakpoints.large,
    isTablet: currentShortDimension >= Breakpoints.tablet,
    // Dynamic wp/hp for orientation support
    wp: (percent: number | string) => {
      const p = typeof percent === "number" ? percent : parseFloat(percent);
      return PixelRatio.roundToNearestPixel((width * p) / 100);
    },
    hp: (percent: number | string) => {
      const p = typeof percent === "number" ? percent : parseFloat(percent);
      return PixelRatio.roundToNearestPixel((height * p) / 100);
    }
  };
}

/**
 * Returns dynamic horizontal padding based on screen width.
 */
export function useResponsivePadding() {
  const { width } = useWindowDimensions();
  if (width <= Breakpoints.compact) return 12;
  if (width <= Breakpoints.small) return 16;
  if (width < Breakpoints.tablet) return 20;
  return 24; // tablet
}

/**
 * Returns dynamic gaps/margins based on screen width.
 */
export function useResponsiveGap() {
  const { width } = useWindowDimensions();
  if (width <= Breakpoints.compact) return 10;
  if (width <= Breakpoints.small) return 12;
  if (width < Breakpoints.tablet) return 16;
  return 20; // tablet
}
