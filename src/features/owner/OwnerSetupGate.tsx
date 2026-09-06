/**
 * Blocks the owner dashboard until the two things everything else depends on exist:
 * a property, and a bed layout inside it.
 *
 * Before this, a freshly registered owner landed on a full dashboard reporting ₹0, 0
 * residents and 0% occupancy — numbers that look like a broken app rather than an empty one —
 * and every action they could reach from it failed, because each needs a property or a bed to
 * act on. Assigning a resident to a bed is the clearest case: the roster is reachable from day
 * one, and there is nowhere to put anybody.
 *
 * An overlay rather than a replacement for the owner `<Stack>`: the two setup steps ARE owner
 * routes (`/manage-properties`, `/bed-visualizer`), so unmounting the stack would take away
 * the very screens the gate is asking for. Instead the stack stays mounted and this covers it
 * everywhere except those two routes — the owner can do the setup and nothing else.
 *
 * Owner-only, deliberately. A manager is assigned to a property somebody else already made;
 * gating them on "create a property" would lock them out of an app they cannot fix (D-06
 * makes property creation owner-only server-side).
 */
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Radii, Colors } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { usePropertyLayout } from '@/features/property/usePropertyLayout';
import { AnimatedPress } from '@/components/ui/AnimatedPress';

/** The routes the gate is asking the owner to visit — never covered, or it would block the fix. */
const SETUP_ROUTES = ['/manage-properties', '/bed-visualizer'];

type Step = 'property' | 'layout';

const COPY: Record<Step, { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; cta: string; href: string }> = {
  property: {
    icon: 'business-outline',
    title: 'Add your property',
    body:
      'PGow needs a property before it can track residents, rent or meals. This takes a minute — '
      + 'a name, the bed count, and a pin on the map.',
    cta: 'Add Property',
    href: '/manage-properties',
  },
  layout: {
    icon: 'bed-outline',
    title: 'Set up your rooms and beds',
    body:
      'Your property has no rooms yet. Add the floors and rooms, and how many beds each holds — '
      + 'residents are assigned to a bed, so nothing else works until these exist.',
    cta: 'Set Up Bed Layout',
    href: '/bed-visualizer',
  },
};

export function OwnerSetupGate() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  const activePgId = useAuthStore((s) => s.activePgId);

  // `staleTime` on the hook keeps this from being a fetch per navigation; BedVisualizer reads
  // the same cache entry.
  const { data: layout, isLoading, isError } = usePropertyLayout(activePgId ?? null);

  if (activeRole !== 'owner') return null;
  if (SETUP_ROUTES.includes(pathname)) return null;

  const hasProperty = (user?.memberships.length ?? 0) > 0;

  let step: Step | null = null;
  if (!hasProperty) {
    step = 'property';
  } else if (!isLoading && !isError && layout) {
    // Only on a *successful* empty answer. Gating on a failed or in-flight query would lock an
    // owner out of their whole app over a dropped request, which is a far worse failure than
    // the one this is preventing.
    const roomCount = layout.floors.reduce((n, floor) => n + floor.rooms.length, 0);
    if (roomCount === 0) step = 'layout';
  }

  if (!step) return null;
  const copy = COPY[step];

  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={copy.icon} size={30} color={Colors.primary} />
        </View>

        <Txt maxFontSizeMultiplier={1.3} style={styles.stepLabel}>STEP {step === 'property' ? '1' : '2'} OF 2</Txt>
        <Txt maxFontSizeMultiplier={1.3} style={styles.title}>{copy.title}</Txt>
        <Txt maxFontSizeMultiplier={1.3} style={styles.body}>{copy.body}</Txt>

        <AnimatedPress accessibilityRole="button"
          style={styles.button}
          onPress={() => router.push(copy.href as never)}
        >
          <Txt maxFontSizeMultiplier={1.3} style={styles.buttonText}>{copy.cta}</Txt>
          <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
        </AnimatedPress>

        <View style={styles.progressRow}>
          <View style={[styles.pip, styles.pipDone]} />
          <View style={[styles.pip, step === 'layout' ? styles.pipDone : null]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    // Above the tab dock and any screen chrome underneath.
    zIndex: 50,
    elevation: 50,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sheet,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 26,
    alignItems: 'center',
  },
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    height: 52,
    borderRadius: Radii.card,
    backgroundColor: Colors.primary,
    marginTop: 22,
  },
  buttonText: { fontSize: 15, fontWeight: '700', color: Colors.textInverse },
  progressRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  pip: {
    width: 26,
    height: 4,
    borderRadius: Radii.badge,
    backgroundColor: Colors.borderSubtle,
  },
  pipDone: { backgroundColor: Colors.primary },
});
