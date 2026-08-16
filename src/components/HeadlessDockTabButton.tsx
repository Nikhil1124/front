/**
 * The pill-dock bottom nav shared by every role's (tabs) layout that uses this style —
 * Owner, Guest, and the groceries mini-app (Staff's dock is a deliberately different
 * bespoke design; see (staff)/(tabs)/_layout.tsx). Two pieces, both used directly rather
 * than through a wrapping component:
 *
 * - `pillDockStyle` — pass to `<TabList style={pillDockStyle}>` in each layout. One
 *   definition of the positioning/background/shadow instead of three copies. `<TabList>`
 *   itself CANNOT be wrapped in a component here — expo-router/ui's `Tabs` discovers its
 *   screens by checking `child.type === TabList` (exact reference equality against the
 *   literal export) while walking its own children, and does not recurse into anything
 *   else, wrapping component or plain View alike. A `PillDock` wrapper component was tried
 *   and made every TabTrigger invisible to that check — Tabs crashed with "Couldn't find
 *   any screens for the navigator" on Owner, Guest, and groceries alike. Only the *style*
 *   is shareable; the `<TabList>` element itself must stay literal in each layout file.
 * - `HeadlessDockTabButton` — one tab's icon+label. Meant to be used as the child of a
 *   headless `<TabTrigger asChild>` — asChild clones this component and injects `isFocused`
 *   plus the press handlers, which is why its props are a superset of PressableProps
 *   rather than a bespoke onPress.
 */
import { forwardRef } from 'react';
import { View, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/components/ui';
import { Colors, Layout } from '@/theme';

export const pillDockStyle = [
  {
    position: 'absolute' as const, bottom: 8, left: 10, right: 10,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
    shadowColor: Layout.shadowFloatingBar.shadowColor as any,
    shadowOffset: Layout.shadowFloatingBar.shadowOffset as any,
    shadowOpacity: Layout.shadowFloatingBar.shadowOpacity,
    shadowRadius: Layout.shadowFloatingBar.shadowRadius,
    elevation: Layout.shadowFloatingBar.elevation,
  },
  {
    flexDirection: 'row' as const,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16, padding: 4, gap: 2,
  },
];

interface Props extends PressableProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isFocused?: boolean;
}

export const HeadlessDockTabButton = forwardRef<View, Props>(
  ({ icon, label, isFocused, style, ...props }, ref) => (
    <Pressable ref={ref} style={[styles.btn, isFocused && styles.btnActive, style as any]} {...props}>
      <Ionicons name={icon} size={18} color={isFocused ? Colors.primaryDark : Colors.textMuted} />
      <Txt
        size={10}
        weight={isFocused ? '800' : '600'}
        color={isFocused ? Colors.primaryDark : Colors.textMuted}
        style={{ marginTop: 2 }}
      >
        {label}
      </Txt>
    </Pressable>
  )
);

const styles = StyleSheet.create({
  dockWrap: {
    position: 'absolute', bottom: 8, left: 10, right: 10,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
    shadowColor: Layout.shadowFloatingBar.shadowColor as any,
    shadowOffset: Layout.shadowFloatingBar.shadowOffset as any,
    shadowOpacity: Layout.shadowFloatingBar.shadowOpacity,
    shadowRadius: Layout.shadowFloatingBar.shadowRadius,
    elevation: Layout.shadowFloatingBar.elevation,
  },
  dock: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16, padding: 4, gap: 2,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
});
