/**
 * Owner/Manager tabs shell — header (avatar, greeting, property swapper, notifications,
 * settings, quick-add) and the shared bottom bar.
 *
 * ── What changed, and why ───────────────────────────────────────────────────────────────────
 * This layout used to own a bespoke floating pill dock with two visible tabs and a raised
 * centre "+", while `guests`, `staff`, `complaints`, `reviews` and `notices` were all hidden
 * triggers with no way to reach them from the bar at all — an owner had to go back to Overview
 * and find a card. It now uses the same bar as every other role, with five real destinations
 * ordered by how often an owner needs them (see src/data/navTabs.ts).
 *
 * The "+" moved to the header. A bottom bar holds destinations, not actions — that is the one
 * rule both Material 3 and the HIG agree on — and the centre slot is the easiest place to
 * reach, which is why Overview now has it. Its old label was `"Increase quantity"`, a stepper
 * string that had been pasted onto a create button, so a screen reader announced the wrong
 * thing entirely; it is `"Add"` now.
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Tabs, TabTrigger, TabSlot } from 'expo-router/ui';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Row, AnimatedPress, Sheet } from '@/components/ui';
import { Dock, DockAlert, HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { centreOut, NAV_PROFILES } from '@/data/navTabs';
import { AddPgPropertyDialog } from '@/components/dialogs/AddPgPropertyDialog';
import { Colors, Palette, Radii } from '@/theme';

import { usePropertiesEntitiesQuery } from '@/features/properties/useProperties';
import { useRoleNotificationsQuery } from '@/features/notifications/useNotifications';
import { useAuthStore, useIsManagerMode } from '@/store/authStore';
import { usePGowStore } from '@/store/usePGowStore';
import { getGreeting } from '@/utils/format';
import { AppHeader, HeaderChip } from '@/components/AppHeader';
// ── Redesign Theme Colors ───────────────────────────────────────────────────
const PRIMARY = Colors.primary;
const BG = Colors.canvas;
const CHARCOAL = Colors.textPrimary;
const MUTED = Colors.textMuted;
const BORDER = Colors.borderSubtle;

/**
 * The bar no longer lists overview first — the frequency ranking puts the least-used destination
 * in the leftmost slot — and without this the navigator would take its initial route from
 * whichever trigger happens to come first, landing every session on Requests instead of
 * overview. `anchor` pins it, and also sorts overview to the head of the navigator's own screen
 * list. Do not delete this when reordering the bar; that is exactly when it matters.
 */
export const unstable_settings = { anchor: 'overview' };

export default function OwnerTabsLayout() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAddPgModal, setShowAddPgModal] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);



  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: allPGs = [] } = usePropertiesEntitiesQuery();
  const { data: roleNotifs = [] } = useRoleNotificationsQuery(activePgId ?? undefined);
  const owner = allPGs.find((p) => p.id === activePgId) ?? allPGs[0] ?? null;
  // Derived from the role at the CURRENTLY active property, not a snapshot taken at login —
  // see useIsManagerMode's own doc for the property-switch bug the snapshot caused.
  const isManager = useIsManagerMode();
  const user = useAuthStore((s) => s.user);

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;
  const pathname = usePathname();
  const { dockStyle, contentPaddingBottom, counts, alert } = useDock('owner');

  // Dynamic names
  const ownerName = owner?.ownerName || user?.name || 'Owner';
  const greeting = `${getGreeting()}, ${ownerName.split(' ')[0]}`;
  // Initials rather than the 🤵 emoji that used to sit here: an emoji renders differently on
  // every Android version and told you nothing about whose dashboard you were looking at.
  const ownerInitials = ownerName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const location = owner?.address ? owner.address.split(',').slice(0, 2).join(',') : 'Bengaluru';
  const subLabel = `${allPGs.length} PG${allPGs.length === 1 ? '' : 's'} • ${location}`;

  // Paths. A tab route gets the root header — a back arrow on one is a lie, since there is no
  // stack behind it to pop. `notices` and `reviews` are reached by pushing, so they keep theirs.
  const isOverviewActive = pathname === '/overview';
  const isTabRoute = NAV_PROFILES.owner.some((d) => d.href === pathname);

  const addChip = <HeaderChip icon="add" label="Add" onPress={() => { setShowAddOptions(true); }} />;

  return (
    <Tabs style={styles.root}>
      {/* ── Main Layout Wrapper ── */}
      <View style={{ flex: 1, backgroundColor: BG, paddingBottom: contentPaddingBottom }}>
        {/* ── Header: one component, two variants ─────────────────────────────── */}
        {isOverviewActive ? (
          <AppHeader
            eyebrow={greeting}
            title={owner?.pgName ?? 'Select PG'}
            subtitle={subLabel}
            onTitlePress={() => { setShowProfileMenu(true); }}
            titleAdornment={
              <>
                <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
                {isManager && (
                  <View style={styles.managerBadge}>
                    <Txt size={8} weight="700" color={Colors.primary}>MANAGER</Txt>
                  </View>
                )}
              </>
            }
            leading={
              <View style={styles.avatarFrame}>
                <Txt size={13} weight="700" color={Colors.primary}>{ownerInitials}</Txt>
              </View>
            }
            actions={
              <Row gap={8} align="center">
                {addChip}
                <HeaderChip icon="notifications-outline" label="Notifications" badge={unreadCount > 0} onPress={() => { router.push('/notifications'); }} />
                <HeaderChip icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
              </Row>
            }
          />
        ) : (
          <AppHeader
            onBack={isTabRoute ? undefined : () => { router.push('/overview'); }}
            actions={isTabRoute ? addChip : undefined}
            title={
              pathname === '/guests' ? 'Residents Directory' :
              pathname === '/payments' ? 'Payments & Revenue' :
              pathname === '/staff' ? 'Staff Management' :
              pathname === '/complaints' ? 'Complaints & Requests' :
              pathname === '/reviews' ? 'Reviews & Feedback' : 'Details'
            }
          />
        )}
        {/* ── Active Tab Content View Slot ────────────────────────────────────── */}
        <View
          key={pathname}
          style={{ flex: 1 }}
        >
          <TabSlot />
        </View>
      </View>

      {/* Context strip — a sibling of Dock, never a child: TabList is laid out as a row and
          its children are walked for triggers. */}
      <DockAlert alert={alert} />

      {/* ── Bottom bar ─────────────────────────────────────────────────────────
          TabList must be a direct child of Tabs and cannot be nested in an ordinary View, or
          Expo Router can't locate the triggers and discover the screens. `.map` is fine —
          `Children.forEach`, which is what it walks with, flattens arrays.
          Slot order comes from the frequency ranking in navTabs.ts.
      ───────────────────────────────────────────────────────────────────────── */}
      <Dock style={dockStyle}>
        {centreOut(NAV_PROFILES.owner).map((d) => (
          <TabTrigger key={d.name} name={d.name} href={d.href} asChild>
            <HeadlessDockTabButton
              icon={d.icon}
              label={d.label}
              pending={d.signal ? counts[d.signal] : undefined}
              activeTint={Colors.primary}
            />
          </TabTrigger>
        ))}

        {/* Hidden triggers: routes that exist but lost the five-slot cut. Both stay reachable —
            reviews from Overview. */}
        <TabTrigger name="reviews" href="/reviews" style={{ display: 'none' }} />
      </Dock>

      {/* ── PG Swapper Popover Menu ─────────────────────────────────────────── */}
      {showProfileMenu && (
        <Sheet
          visible
          title={owner?.pgName ?? 'Select PG'}
          subtitle={isManager ? `Manager: ${owner?.managerName ?? 'You'}` : `Owner: ${owner?.ownerName ?? 'You'}`}
          icon="business-outline"
          onDismiss={() => setShowProfileMenu(false)}
        >
                <>
                  {allPGs.map((pg) => {
                    const isCurrent = pg.id === activePgId;
                    return (
                      <AnimatedPress accessibilityRole="button"
                        key={pg.id}
                        style={[styles.menuRow, isCurrent && styles.menuRowActive]}
                        onPress={async () => {
                          setShowProfileMenu(false);
                          await usePGowStore.getState().switchActivePG(pg);
                        }}
                      >
                        <Ionicons name="business" size={18} color={isCurrent ? PRIMARY : MUTED} />
                        <Txt size={13} weight={isCurrent ? '800' : '600'} color={isCurrent ? PRIMARY : CHARCOAL} style={{ marginLeft: 10, flex: 1 }}>
                          {pg.pgName}
                        </Txt>
                        {isCurrent && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
                      </AnimatedPress>
                    );
                  })}
                </>

                <View style={styles.menuDivider} />

                {!isManager && (
                  <>
                    <AnimatedPress accessibilityRole="button"
                      style={styles.menuRow}
                      onPress={() => { setShowProfileMenu(false); setShowAddPgModal(true); }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
                      <Txt size={13} weight="700" color={CHARCOAL} style={{ marginLeft: 10 }}>Add Property</Txt>
                    </AnimatedPress>
                    <AnimatedPress accessibilityRole="button"
                      style={styles.menuRow}
                      onPress={() => { setShowProfileMenu(false); router.push('/manage-properties'); }}
                    >
                      <Ionicons name="settings-outline" size={18} color={PRIMARY} />
                      <Txt size={13} weight="700" color={CHARCOAL} style={{ marginLeft: 10 }}>Manage Properties</Txt>
                    </AnimatedPress>
                  </>
                )}
        </Sheet>
      )}



      {/* Property Addition Overlays */}
      {showAddPgModal && (
        <AddPgPropertyDialog
          onDismiss={() => setShowAddPgModal(false)}
        />
      )}

      {/* ── Add Options Sheet Menu ─────────────────────────────────────────── */}
      {showAddOptions && (
        <Sheet
          visible
          title="Add"
          subtitle="What are you adding?"
          icon="add-circle-outline"
          onDismiss={() => setShowAddOptions(false)}
        >
              <Row justify="space-evenly" align="center" style={{ marginVertical: 10 }}>
                {/* Add Resident */}
                <AnimatedPress accessibilityRole="button"
                  style={styles.addOptionItem}
                  onPress={() => {
                    setShowAddOptions(false);
                    setTimeout(() => router.navigate('/guests'), 150);
                  }}
                >
                  <View style={[styles.moreIconBox, { backgroundColor: Palette.TintGreen }]}><Ionicons name="person-add-outline" size={22} color={Colors.success} /></View>
                  <Txt size={12} weight="700" color={CHARCOAL} style={{ marginTop: 8 }}>Resident</Txt>
                </AnimatedPress>

                {/* Add Staff */}
                <AnimatedPress accessibilityRole="button"
                  style={styles.addOptionItem}
                  onPress={() => {
                    setShowAddOptions(false);
                    setTimeout(() => router.navigate('/staff'), 150);
                  }}
                >
                  <View style={[styles.moreIconBox, { backgroundColor: '#EEF2FF' }]}><Ionicons name="ribbon-outline" size={22} color={PRIMARY} /></View>
                  <Txt size={12} weight="700" color={CHARCOAL} style={{ marginTop: 8 }}>Staff</Txt>
                </AnimatedPress>

                {/* Add Property */}
                <AnimatedPress accessibilityRole="button"
                  style={styles.addOptionItem}
                  onPress={() => {
                    setShowAddOptions(false);
                    setShowAddPgModal(true);
                  }}
                >
                  <View style={[styles.moreIconBox, { backgroundColor: Palette.TintAmber }]}><Ionicons name="business-outline" size={22} color={Colors.warning} /></View>
                  <Txt size={12} weight="700" color={CHARCOAL} style={{ marginTop: 8 }}>Property</Txt>
                </AnimatedPress>
              </Row>

        </Sheet>
      )}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // LUNA Gradient Header (Matching Resident Design)
  avatarFrame: {
    width: 38, height: 38, borderRadius: Radii.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated },
  managerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.badge,
    backgroundColor: '#A7EBF2' },

  // The floating-pill dock that used to live here (floatingDock / dockItem / dockText) and its
  // raised centre "+" (plusBtnContainer / floatingPlusBtn) are gone with the bar itself — see
  // this file's header comment. The bar's styles are now in HeadlessDockTabButton.tsx, shared
  // with every role.

  // Modals Backdrops
  menuDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 4 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radii.card },
  menuRowActive: {
    backgroundColor: '#EEF2FF' },

  // More Menu Bottom Sheet
  moreIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radii.card,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center' },
  addOptionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80 }, });

