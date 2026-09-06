/**
 * HubScreenWrapper — Unified LUNA header for every drill-down sub-screen
 * across OWNER, MANAGER, CHEF, MAINTENANCE & RESIDENT roles.
 *
 * The header itself is `AppHeader` in its back variant — this component's job is the body
 * around it (scroll behaviour, responsive padding, the bottom inset), not the bar on top.
 */
import { type ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FormScroll } from '@/components/ui/FormScroll';
import { Colors } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
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
  testID }: HubScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  const responsivePadding = useResponsivePadding();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={styles.root} testID={testID}>
      <AppHeader
        title={title}
        subtitle={subtitle}
        onBack={handleBack}
        titleAdornment={icon ? <Ionicons name={icon} size={17} color={Colors.primary} /> : undefined}
        actions={rightAction}
      />

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
        // `scrollable={false}` hands scrolling to the child (TenantListScreen's FlatList,
        // GuestHubServicesTab's grid), so the bottom inset has to be reserved here — the
        // child has no way to know about it, and without it the last row sits inside the
        // Android gesture strip, where a tap competes with the swipe-up home gesture.
        // The scrollable branch above needs nothing: FormScroll appends its own
        // `paddingBottom: bottomPadding + insets.bottom` after this style object.
        <View
          style={{
            flex: 1,
            paddingHorizontal: responsivePadding,
            paddingTop: 16,
            paddingBottom: insets.bottom,
            ...contentContainerStyle }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas },
  scrollBody: {
    flex: 1 } });
