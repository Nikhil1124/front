/**
 * TabHeader — the consistent header shell shared by all three role tab layouts
 * (Owner, Guest, Staff).
 *
 * Why this exists:
 *   Each role's tab bar already uses the same structural shape for its header:
 *   same height, same padding, same background/border treatment, a left slot,
 *   a center slot for the title/subtitle, and a right slot for action buttons.
 *   But each one was hand-rolling this independently, leading to subtle drift.
 *
 *   TabHeader centralises the **shape** while leaving the **content** to each
 *   role — an owner's header shows a PG switcher, a guest's shows an avatar
 *   and rent status, a chef's shows a dashboard title. This component doesn't
 *   know or care about any of that; it only owns the padding, background, and
 *   border that make all three headers visually consistent.
 *
 * Cyber Mint:
 *   - White elevated surface with a hairline border — the same treatment used
 *     by HubScreenWrapper's header and every dashboard in the app.
 *   - No shadow (tab headers sit at the top of the screen, not floating).
 */
import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/theme';
import { useResponsivePadding } from '@/utils/responsive';

export interface TabHeaderProps {
  /** Small icon/avatar/status-dot area, left-aligned. */
  leading?: ReactNode;
  /** Title + optional subtitle stack, takes remaining width. */
  children: ReactNode;
  /** Notification bell, logout, etc — right-aligned, same gap between actions in every role. */
  actions?: ReactNode;
}

export function TabHeader({ leading, children, actions }: TabHeaderProps) {
  const insets = useSafeAreaInsets();
  const responsivePadding = useResponsivePadding();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 14, paddingHorizontal: responsivePadding }]}>
      <View style={styles.row}>
        {leading}
        <View style={styles.center}>{children}</View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 14,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
});
