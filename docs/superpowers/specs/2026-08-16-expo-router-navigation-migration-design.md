# Expo Router navigation migration — design

**Date:** 2026-08-16
**Status:** Approved for planning
**Scope:** Replace PGow's hand-rolled screen-stack navigation (Zustand `screenStack` +
`renderScreen()` switch in `PGowApp.tsx`) with idiomatic Expo Router, covering both the
top-level screen stack and every role dashboard's internal tab row. This is a navigation-layer
migration only — no non-navigation Zustand slice (guests, payments, groceries, auth, etc.)
changes.

## Why

- `usePGowStore.ts` owns a `screenStack: AppScreen[]` array plus `pushScreen`/`popScreen`
  actions, and `PGowApp.tsx` switches on 31 `AppScreen` values across a ~350-line
  `renderScreen()` function — 40 `pushScreen` and 33 `popScreen` call sites app-wide.
- `expo-router` (v57, aligned to Expo SDK 57 — see Versioning note below) is already an
  installed dependency and owns the app's single entry route, but nothing else in the app
  uses it. The app is paying for two navigation systems and getting the benefit of neither.
- Concrete costs of the current system, fixed by this migration:
  - No deep linking — a push notification tap replays routing logic by hand
    (`routeFromPushData` sets `currentScreen` directly) instead of using a real URL.
  - No iOS swipe-back gesture — `PGowApp.tsx`'s own comment says so explicitly, and works
    around it with a mandatory visible back arrow on every header instead.
  - ~15+ screens each carry a duplicate manual `BackHandler` listener for Android, because
    there's no navigator to own hardware-back centrally.
  - `TICKET_DETAIL` has no way to say which ticket to show — it grabs "the most recently
    created complaint" from the store as a stand-in for a real parameter (existing code
    comment, not new information).
  - `INVOICE_DETAIL` is a dead switch case with placeholder text; the real modal is invoked
    separately by whichever screen needs it, bypassing the screen-stack entirely.

## Versioning note (resolved)

`expo-router@57.0.13` is correct, not a typo — Expo's first-party packages (`expo`,
`expo-router`, `expo-router/ui`, …) now ship with version numbers aligned to the SDK number
itself, replacing the old independent 4.x/5.x/6.x line. Verified directly against the
installed package:

- `node_modules/expo-router/build/views/Protected.js` exports `Protected` (`Stack.Protected`) — present.
- `node_modules/expo-router/build/ui/{TabList,TabTrigger,TabSlot,Tabs}.js` — all present.

Both APIs this design depends on are confirmed available in the actual installed version, not
assumed from a version number alone.

## Route structure

```
app/
  _layout.tsx                 — providers (QueryClient, GestureHandlerRootView, SafeAreaProvider),
                                 StatusBar, AlertOverlay, auth-state watcher (hydrateFromStorage → init)
  index.tsx                   — <Redirect> to the right place based on auth state (mirrors
                                 today's screenForRole())

  (auth)/                     — Stack.Protected guard={!accessToken}
    welcome.tsx
    owner-register.tsx
    owner-login.tsx            — role-tab picker (Owner/Manager/Staff/Resident) stays as
                                   in-page component state; it selects a form variant, it
                                   is not a distinct navigable destination
    owner-subscription.tsx
    guest-join.tsx
    staff-login.tsx

  (owner)/                    — Stack.Protected guard={role is owner|manager}
    (tabs)/                   — headless Tabs: Overview · Guests · Payments · Staff · Notices · Reviews
      _layout.tsx               (TabList + TabTrigger + TabSlot — see Tab mechanism below)
      overview.tsx  guests.tsx  payments.tsx  staff.tsx  notices.tsx  reviews.tsx
    pnl-analytics.tsx  manager-provisioning.tsx  services.tsx  upi-settings.tsx
    manage-properties.tsx  portfolio.tsx  settings.tsx
    bed-visualizer.tsx  tenant-list.tsx  procurement.tsx

  (guest)/                    — Stack.Protected guard={role is tenant}
    (tabs)/                   — headless Tabs: Home · Meals · Payments · Support · Profile
      _layout.tsx
      home.tsx  meals.tsx  payments.tsx  support.tsx  profile.tsx
    hub-services.tsx
    ticket/[id].tsx            — replaces the "most recent complaint" hack with a real param
    invoice/[id].tsx           — real presentation:"modal" route, replaces the placeholder case

  (staff)/                    — Stack.Protected guard={role is chef|kitchen_staff|maintenance}
    index.tsx                  — role-based <Redirect>: maintenance → /(staff)/housekeeping,
                                   chef|kitchen_staff → /(staff)/(tabs)/eaters (see note below)
    (tabs)/                   — headless Tabs: Eaters · Broadcast · Kitchen (chef/kitchen_staff only)
      _layout.tsx
      eaters.tsx  broadcast.tsx  kitchen.tsx
    housekeeping.tsx           — maintenance/housekeeping's own dashboard, no tabs

  groceries/                  — Stack.Protected guard={!!accessToken} (ANY authenticated
                                 role — owner/manager/chef/tenant all shop here; this is not
                                 a free-for-all route, see Guarding note below)
    index.tsx  category.tsx  product/[id].tsx  cart.tsx  checkout.tsx
    orders/index.tsx  orders/[id].tsx
```

### Guarding note (fixes a gap flagged in review)

Every group has an explicit guard — `groceries/` is not an exception. It is not scoped to
one role group because it is genuinely reachable from all four (owner, manager, chef,
tenant), so its guard condition is "signed in as anyone" (`!!accessToken`) rather than a
specific role list, mirroring today's `RoleGuard allowedRoles={['owner','manager','chief','tenant']}`
on every `GROCERY_*` case in `PGowApp.tsx`.

### `(staff)/` entry resolution (fixes a gap flagged in review)

`(staff)/(tabs)/` (Eaters/Broadcast/Kitchen) only makes sense for chef/kitchen_staff — a
maintenance/housekeeping login has no business landing there. `(staff)/index.tsx` is an
explicit role-based `<Redirect>`, evaluated once on entry to the group:

```tsx
// app/(staff)/index.tsx
export default function StaffIndex() {
  const role = useAuthStore((s) => s.activeRole);
  if (role === 'maintenance') return <Redirect href="/(staff)/housekeeping" />;
  return <Redirect href="/(staff)/(tabs)/eaters" />;
}
```

### Guard-flip behavior (test case required, not assumed)

When a `Stack.Protected` guard flips `true → false`, Expo Router removes every history entry
in that group — not a redirect, a full history wipe. This matters here specifically because
role can change mid-session (a manager promoted, staff reassigned) while someone is mid-flow
in, say, Payments or Procurement. The auth-flow implementation phase (below) must include a
deliberate test: flip `activeRole` while several screens deep in a protected group and
confirm the resulting behavior is an acceptable bounce, not a silent data-loss surprise. This
is called out explicitly so it isn't discovered by accident during the Owner or Staff phase.

## Tab mechanism: headless primitives, not `<Tabs tabBar={...}>`

`<Tabs>`'s `tabBar` prop is still React Navigation's bottom-tabs underneath — getting pixel
parity with the current pill-style tab bar means fighting its assumptions rather than
controlling them. `expo-router/ui`'s `TabList` / `TabTrigger` / `TabSlot` are headless (no
default rendering at all), so the existing tab bar visual design carries over unchanged; only
the mechanism under it changes. Each dashboard's `(tabs)/_layout.tsx` looks like:

```tsx
import { TabList, TabTrigger, TabSlot } from 'expo-router/ui';

export default function OwnerTabsLayout() {
  return (
    <>
      <TabSlot />
      <TabList style={styles.tabBar}>
        <TabTrigger name="overview" href="/overview" asChild>
          {/* existing pill-tab visual component, unchanged */}
        </TabTrigger>
        {/* …one TabTrigger per tab, same pattern */}
      </TabList>
    </>
  );
}
```

## Params replace store side-channels

Three places currently stash "which one to show next" in `useGroceryUiStore` instead of
passing it as data:

| Today | Becomes |
|---|---|
| `selectedProductId` + `GROCERY_PRODUCT` | `groceries/product/[id]` |
| `selectedCategoryName` + `GROCERY_CATEGORY` | `groceries/category?name=...` |
| `selectedOrderId` + `GROCERY_ORDER_DETAIL` | `groceries/orders/[id]` |
| "most recent complaint" hack + `TICKET_DETAIL` | `(guest)/ticket/[id]` |

`useGroceryUiStore` keeps whatever else it holds that is genuinely cross-cutting UI state;
only these id-passing responsibilities move to route params.

## Modals

`INVOICE_DETAIL` becomes a real route with `presentation: 'modal'` in its `Stack.Screen`
options, replacing the current dead switch case (which prints "Invoice detail opens as a
modal" as body text) plus the separately-invoked `InvoiceDetailModal` component. One
mechanism, not two.

## Push notifications

`routeFromPushData` (`features/notifications/channels.ts`) stops writing `currentScreen`
into the Zustand store and calls `router.push(...)` instead.

**Cold-start gotcha, called out explicitly so it isn't improvised mid-phase:** on a killed-app
cold start, the notification tap can fire before the router has mounted. The push
implementation phase must hold the target route (e.g. in a ref or a small pending-nav store
slice) and flush it once the router is confirmed ready — checking `useRootNavigationState()`
is non-null, or the equivalent ready-check for whatever Expo Router version's recommended
pattern is current at implementation time — rather than calling `router.push` unconditionally
at cold-start and assuming it lands.

## Hardware back / iOS swipe-back

Comes free from the `react-native-screens`-backed `Stack` navigator. Deletes the ~15+ manual
`BackHandler` listeners currently duplicated across `HubScreenWrapper` consumers and
individual screens (`GroceriesScreen`, `GroceryCategoryScreen`, etc.), and adds the iOS
swipe-back gesture that `PGowApp.tsx`'s own comment says is missing today.

## What moves, what doesn't

**Deleted outright from `usePGowStore.ts` (not deprecated, not kept behind a flag):**
`currentScreen`, `screenStack`, `pushScreen`, `popScreen`, `replaceScreen`, `resetScreenTo`.
(`replaceScreen` and `resetScreenTo` have zero call sites today beyond their own
definitions — confirmed by search — so this is a pure deletion, not a migration, for those two.)

**Deleted from `PGowApp.tsx`:** the entire `renderScreen()` switch; the 23
`<RoleGuard allowedRoles={...}>` wraps move to layout-level `Stack.Protected` guards, one per
group (4-5 guards total instead of 23 per-screen wraps).

**Kept exactly as-is:** every non-navigation Zustand slice (`usePGowStore`'s data slices,
`authStore`, all five Groceries feature stores). The `useRoleGuard` *hook* stays — it answers
in-page questions like "does this signed-in person see the Approve button or the Submit
button," which is a content concern, not a navigation one, and Expo Router has no opinion
about it.

## Migration ordering

Sequenced by area so each phase is independently testable, not one unreviewable diff:

1. **Root layout + auth flow** — `app/_layout.tsx`, `(auth)/*`, the guard/redirect mechanism
   itself. This is also where the guard-flip history-wipe test case (above) gets proven out,
   before the pattern is copied across Owner/Guest/Staff.
2. **Owner group** — tabs + every drill-down screen.
3. **Guest group** — tabs + `ticket/[id]` + `invoice/[id]` modal + hub services.
4. **Staff group** — tabs + the `(staff)/index.tsx` role redirect + housekeeping.
5. **Groceries stack** — shared, its own guard.
6. **Push notifications** — `routeFromPushData` → `router.push`, with the cold-start hold.
7. **Delete the legacy system** — remove `screenStack`/`pushScreen`/etc. from
   `usePGowStore.ts`, remove `renderScreen()` and the 23 `RoleGuard` wraps from
   `PGowApp.tsx`, remove the manual `BackHandler` listeners superseded by the `Stack`.

## Explicitly out of scope

- Any change to non-navigation state management (the god-store size, the `refreshAll`
  refetch pattern) — separate, already-discussed concern.
- Turning on the real backend (`fetchWithTimeout` stays pointed at `mockFetch`).
- Adding tests/lint/CI — deferred, per earlier discussion.
