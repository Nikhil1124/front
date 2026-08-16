/**
 * HubScreenWrapper — the consistent header for every drill-down sub-screen
 * reached from a dashboard hub.
 *
 * Why this exists:
 *   The hub-and-spoke architecture means each action tile opens a dedicated
 *   full-screen page. Every one of those pages needs the same three things:
 *     (1) A sticky top bar with a back button that calls `popScreen()`.
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
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { View, StyleSheet, ScrollView, Platform, ViewStyle, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Spacer } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSelect } from '@/utils/haptics';

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
  /** Override the back handler. By default calls `popScreen()`. */
  onBack?: () => void;
  testID?: string;
}

export function HubScreenWrapper({
  title,
  subtitle,
  icon = 'chevron-back',
  rightAction,
  children,
  scrollable = true,
  contentContainerStyle,
  onBack,
  testID,
}: HubScreenWrapperProps) {
  const popScreen = usePGowStore((s) => s.popScreen);

  const handleBack = () => {
    hapticSelect();
    if (onBack) onBack();
    else popScreen();
  };

  // Android hardware back: pop the stack (consistent with the back chevron).
  // Without this, the OS would try its default behaviour (exit app) because
  // we don't use a Navigator — our back-stack is custom in the store.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Body: ComponentType<any> = scrollable ? ScrollView : View;
  const bodyProps = scrollable
    ? { contentContainerStyle: { padding: 16, paddingBottom: 32, ...contentContainerStyle }, showsVerticalScrollIndicator: false }
    : { style: { flex: 1, padding: 16, ...contentContainerStyle } };

  return (
    <View style={styles.root} testID={testID}>
      {/* Sticky top bar — mint-tinted band with back chevron + title */}
      <View style={styles.header}>
        <AnimatedPress
          scale={0.9}
          hapticPattern="light"
          onPress={handleBack}
          style={styles.backBtn}
        >
          <Ionicons name={icon} size={22} color={Colors.primaryDark} />
        </AnimatedPress>

        <View style={styles.titleWrap}>
          <Txt size={17} weight="800" color={Colors.textPrimary} numberOfLines={1}>{title}</Txt>
          {subtitle ? (
            <Txt size={11} color={Colors.textMuted} numberOfLines={1} style={{ marginTop: 1 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>

        {rightAction ? <View>{rightAction}</View> : <Spacer size={40} horizontal />}
      </View>

      {/* Body — scrollable by default, padding for cards */}
      <Body {...bodyProps} style={scrollable ? styles.scrollBody : bodyProps.style}>
        {children}
      </Body>
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
    gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  scrollBody: {
    flex: 1,
  },
});
