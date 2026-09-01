/**
 * HubScreenWrapper — the consistent header for every drill-down sub-screen
 * reached from a dashboard hub.
 *
 * Why this exists:
 *   The hub-and-spoke architecture means each action tile opens a dedicated
 *   full-screen page. Every one of those pages needs the same three things:
 *     (1) A sticky top bar with a back button that calls `router.back()`.
 *     (2) A consistent title + subtitle layout.
 *     (3) A scrollable body that doesn't fight the back button for space.
 *
 *   Centralising the header here means a new drill-down page is just a
 *   `<HubScreenWrapper title="…" subtitle="…">{body}</HubScreenWrapper>`
 *   call — no per-screen styling, no per-screen back-button wiring, no
 *   per-screen Android hardware-back handling (the wrapper owns it).
 *
 * Cyber Mint:
 *   - White header surface with a hairline border and soft shadow — same
 *     subtle separation from the canvas body used on every dashboard header,
 *     so a drill-down doesn't look like a different app was pasted in.
 *   - Back chevron in a bordered surface button, same material as the
 *     dashboard's own icon buttons.
 *   - Body sits on the mint canvas with the standard 16dp page padding.
 */
import { type ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  /** Optional leading icon name (Ionicons). Defaults to a chevron-back affordance. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional right-side action node (e.g. a filter button). */
  rightAction?: ReactNode;
  /** Body content. If you need scrolling (typical), pass a single child. */
  children: ReactNode;
  /** Set to false if the body should NOT be wrapped in a ScrollView (e.g. you
   *  already provide your own, or you want a flat list). Defaults to true. */
  scrollable?: boolean;
  /** Custom content container style for the scroll view. */
  contentContainerStyle?: ViewStyle;
  /** Optional pull-to-refresh control element. */
  refreshControl?: ReactNode;
  /** Override the back handler. By default calls `router.back()`. */
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
  // Hardware back / iOS swipe-back are handled by the Stack navigator itself now — no manual
  // BackHandler listener needed, unlike the old custom screen-stack this replaced.
  const handleBack = () => {
    hapticSelect();
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={styles.root} testID={testID}>
      {/* Sticky top bar — mint-tinted band with back chevron + title */}
      <View style={[styles.header, { paddingTop: insets.top + 14, paddingHorizontal: responsivePadding }]}>
        <AnimatedPress
          scale={0.9}
          hapticPattern="light"
          onPress={handleBack}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </AnimatedPress>

        <View style={styles.titleWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {icon && <Ionicons name={icon} size={20} color={Colors.primaryDark} />}
            <Txt variant="screenTitle" color={Colors.textPrimary} numberOfLines={1} style={{ flexShrink: 1 }}>{title}</Txt>
          </View>
          {subtitle ? (
            <Txt variant="caption" color={Colors.textMuted} numberOfLines={1} style={{ marginTop: 1 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>

        {rightAction ? <View>{rightAction}</View> : <Spacer size={40} horizontal />}
      </View>

      {/* Body — scrollable by default (keyboard-safe via FormScroll — see its own doc comment
          for why a plain ScrollView isn't enough on Android), padding for cards */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
    gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
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
