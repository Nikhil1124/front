/**
 * HubScreenWrapper — Unified LUNA header for every drill-down sub-screen
 * across OWNER, MANAGER, CHEF, MAINTENANCE & RESIDENT roles.
 *
 * Official LUNA Design System:
 *   - Obsidian Navy to Midnight Blue Gradient Header (#011C40 → #023859)
 *   - White title text & frosted glass back button affordance
 *   - Light Ice Canvas body (#F4F9FB)
 */
import { type ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { FormScroll } from '@/components/ui/FormScroll';
import { Colors } from '@/theme';
import { hapticSelect } from '@/utils/haptics';
import { useResponsivePadding } from '@/utils/responsive';

export interface HubScreenWrapperProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightAction?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: ViewStyle;
  refreshControl?: ReactNode;
  onBack?: () => void;
  testID?: string;
}

export function HubScreenWrapper({
  title,
  subtitle,
  icon,
  rightAction,
  children,
  scrollable = true,
  contentContainerStyle,
  refreshControl,
  onBack,
  testID,
}: HubScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  const responsivePadding = useResponsivePadding();

  const handleBack = () => {
    hapticSelect();
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={styles.root} testID={testID}>
      {/* ── 1. UNIFIED LUNA GRADIENT HEADER ── */}
      <LinearGradient
        colors={['#011C40', '#023859']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 12, paddingHorizontal: responsivePadding }]}
      >
        <AnimatedPress
          scale={0.9}
          hapticPattern="light"
          onPress={handleBack}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </AnimatedPress>

        <View style={styles.titleWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {icon && <Ionicons name={icon} size={20} color="#A7EBF2" />}
            <Txt size={18} weight="900" color="#FFFFFF" numberOfLines={1} style={{ flexShrink: 1 }}>{title}</Txt>
          </View>
          {subtitle ? (
            <Txt size={12} weight="500" color="rgba(255,255,255,0.78)" numberOfLines={1} style={{ marginTop: 2 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>

        {rightAction ? <View>{rightAction}</View> : <Spacer size={38} horizontal />}
      </LinearGradient>

      {/* ── 2. BODY CONTAINER ── */}
      {scrollable ? (
        <FormScroll
          contentContainerStyle={{ paddingHorizontal: responsivePadding, paddingTop: 16, paddingBottom: 32, ...contentContainerStyle }}
          style={styles.scrollBody}
          refreshControl={refreshControl as any}
        >
          {children}
        </FormScroll>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: responsivePadding, paddingTop: 16, ...contentContainerStyle }}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
});
