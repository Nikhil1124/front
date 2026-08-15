# Fix plan: owner sees guest UI, stale `activePgId`, misleading "Meal not found"

**Repo:** `pg-charan` (Expo/React Native client). A related, read-only reference to the
backend lives in the sibling repo `pg-new-backend` — nothing there needs to change for this
plan, it's cited only to prove root cause.

**Status:** Planned, not yet implemented. Apply fixes in the order below — each one is
independent to write, but #2 depends on #1's field existing, and #3 is what makes #1+#2
actually resolve visibly without a force-quit.

## Symptom report (from a real device test)

1. Registering a new owner never asked for a location/address.
2. After registering and logging in, the Home screen's quick actions showed **Meals** and
   **My KYC** — options meant for a *guest*, not an owner.
3. Opening a meal showed an alert: **"Meal not found."**

## Root cause summary

- **(1) is not a bug.** Location belongs to a *property*, not the owner's account. It's
  collected in `app/properties/create.tsx` (search autocomplete, drag-a-pin map picker, or a
  "same location as" shortcut for chain PGs), not at signup. Confirmed by the backend's own
  docstring: `register_owner()` in `pg-new-backend/app/modules/auth/service.py` — *"Create a
  self-signup account. The caller then creates their first property."* A freshly registered
  owner legitimately has **zero property memberships** until they create property #1. The
  real gap is just that nothing on screen tells them that's the next step (see Fix 2).

- **(2) is a real bug**, caused by two things stacking:
  - `app/(tabs)/index.tsx` picks which quick-action set to show with a ternary that has no
    "no role yet" branch, so a `null` `activeRole` (which is exactly what a memberships-less
    owner has) silently falls through to the guest option set.
  - Even after creating property #1, `app/properties/create.tsx` never refetches `/v1/me`,
    so the in-memory user object still has zero memberships and `activeRole` stays `null`
    until the app is force-quit and relaunched.

- **(3) is a real bug**, caused by `src/store/authStore.ts`'s `setUser()` keeping a
  previously-persisted `activePgId` from `SecureStore` even when the newly-logged-in user has
  no membership at that PG at all (e.g. a different account was tested earlier on the same
  physical device — reinstalling the APK via `adb install -r` does not clear app storage).
  That orphaned id then gets sent as `?pg_id=` to the backend, which correctly 404s
  (`"Property not found."` / `"Meal not found."` in `pg-new-backend/app/modules/meal/service.py`).
  The literal alert text comes from `app/meals/[meal_id].tsx`, which collapses *every* failure
  mode (404, 403 gate, network error) into one hardcoded string.

---

## Fix 1 — Don't trust a persisted `activePgId` that isn't one of this user's memberships

**File:** `src/store/authStore.ts`

**Current code** (inside `setUser`):

```ts
  setUser: (user) => {
    const { activePgId } = get();
    // Resolve activeRole from the activePgId membership
    const membership = user.memberships.find((m) => m.pg_id === activePgId)
      ?? user.memberships[0];
    set({
      user,
      activeRole: membership?.role ?? null,
      // Auto-set activePgId if not set yet
      activePgId: activePgId ?? membership?.pg_id ?? null,
    });
  },
```

**Problem:** the last line's `activePgId ??` keeps the *old* stored value whenever it's
already non-null — even when `membership` came back `undefined` because that id doesn't
belong to any of `user.memberships`. That's exactly the state after logging into a different
account on a device that still has an old `pgowActivePgId` in SecureStore.

**Proposed change:**

```ts
  setUser: (user) => {
    const { activePgId } = get();
    // Resolve activeRole from the activePgId membership
    const membership = user.memberships.find((m) => m.pg_id === activePgId)
      ?? user.memberships[0];
    set({
      user,
      activeRole: membership?.role ?? null,
      // Always derive from a membership this user actually holds — never keep a
      // persisted id from a previous account/session that doesn't match anything here.
      activePgId: membership?.pg_id ?? null,
    });
  },
```

**Why this is safe:** `membership` is already computed by trying to match the stored
`activePgId` first (`user.memberships.find(...)`) and only falling back to
`user.memberships[0]`. So a *valid* stored `activePgId` that does belong to this user is
still preserved — this only changes behavior for the invalid/orphaned case, which should
resolve to `null` (no property selected), not to a property this user can't access.

**Verification:**
- Unit-level: with a `user.memberships = []` and a stored `activePgId = "some-uuid"`, calling
  `setUser(user)` must result in `activePgId === null` and `activeRole === null` (not the
  stale uuid).
- Manual: log in as owner A on a device, then log out and register a brand-new owner B on the
  same device without reinstalling. B's Home screen must show `activePgId: null` / "None
  selected", never A's property id.

---

## Fix 2 — Give "authenticated, zero memberships anywhere" its own explicit UI state

**File:** `app/(tabs)/index.tsx`

**Current code:**

```tsx
const isOwner = activeRole === "owner" || activeRole === "manager";
const isChef = activeRole === "chef" || activeRole === "kitchen_staff";
const isGuest = activeRole === "guest";

const quickActions = isOwner ? OWNER_ACTIONS : isChef ? CHEF_ACTIONS : GUEST_ACTIONS;
```

**Problem:** when `activeRole` is `null` (a signed-up-but-propertyless owner), none of
`isOwner`/`isChef`/`isGuest` are true, and the ternary's final `else` silently picks
`GUEST_ACTIONS` — which includes "My KYC", a concept that doesn't apply to owners at all.

**Proposed change:** add a distinct branch, and render a "create your first property"
onboarding card instead of any quick-action grid when there are no memberships at all.

```tsx
const hasNoMemberships = (user?.memberships.length ?? 0) === 0;
const isOwner = activeRole === "owner" || activeRole === "manager";
const isChef = activeRole === "chef" || activeRole === "kitchen_staff";
const isGuest = activeRole === "guest";

const quickActions = isOwner ? OWNER_ACTIONS : isChef ? CHEF_ACTIONS : isGuest ? GUEST_ACTIONS : [];
```

And in the render, before (or instead of) the `actionsGrid` block, add:

```tsx
{hasNoMemberships ? (
  <Card accent="green" style={styles.pgCard}>
    <Text style={styles.pgCardTitle}>Get Started</Text>
    <Text style={{ color: Colors.textSecondary, fontSize: FontSize.md }}>
      Add your first property to start managing staff, residents, and meals.
    </Text>
    <TouchableOpacity onPress={() => router.push("/properties/create")}>
      <Text style={styles.pgCardLink}>Add Property →</Text>
    </TouchableOpacity>
  </Card>
) : (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Quick Actions</Text>
    <View style={styles.actionsGrid}>
      {quickActions.map((a) => ( /* ...unchanged... */ ))}
    </View>
  </View>
)}
```

`user` is already destructured from `useAuthStore()` at the top of this component — no new
selector needed. Reuse the existing `Card`/`pgCard*` styles already defined lower in the
file (used by the owner "Active Property" card) rather than adding new style rules.

**Verification:**
- Manual: register a brand-new owner, land on Home. Must see "Get Started / Add Property →",
  never "Meals" / "My KYC".
- Manual: after Fix 3 is also applied, creating property #1 must flip this card into the
  normal `OWNER_ACTIONS` grid without restarting the app.

---

## Fix 3 — Refresh membership/role data right after creating property #1 (or any property)

**File:** `app/properties/create.tsx`

**Current code** (inside `handleCreate`):

```tsx
  const handleCreate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const pg = await createProperty({
        name: name.trim(),
        address: address.trim() || undefined,
        total_beds: parseInt(totalBeds, 10),
        place_id: placeId ?? undefined,
      });
      await setActivePgId(pg.id);
      Alert.alert("Property Created", `"${pg.name}" is now your active property.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Failed", err?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };
```

**Problem:** `setActivePgId(pg.id)` (in `authStore.ts`) only re-derives `activeRole` from the
**already-in-memory** `user.memberships` — it does not talk to the backend. Since that user
object was fetched before this property existed, it doesn't contain the owner membership
`pg-new-backend/app/modules/pgs/service.py` just created server-side. Result: `activeRole`
stays `null`, and Fix 2's onboarding card never flips to the real owner quick actions until
the app is force-quit and relaunched (which triggers a fresh `/v1/me` in `app/_layout.tsx`).

**Proposed change:** pull in `fetchMe` from `useAuth()` (already used elsewhere in this
codebase for exactly this purpose) and call it right after `setActivePgId`:

```tsx
import { useAuth } from "../../src/features/auth/useAuth"; // add to existing imports

// ...inside the component, alongside the other hooks:
const { fetchMe } = useAuth();

// ...inside handleCreate:
      await setActivePgId(pg.id);
      await fetchMe(); // refresh memberships so `activeRole` reflects the new owner grant
      Alert.alert("Property Created", `"${pg.name}" is now your active property.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
```

Order matters: `setActivePgId` first (so the id is already set when `fetchMe`'s `setUser`
runs and tries to match a membership against it), then `fetchMe`.

**Verification:**
- Manual: register a new owner, confirm Fix 2's "Get Started" card appears, create property
  #1, dismiss the success alert, and confirm Home immediately shows the real owner quick
  actions (Properties/Residents/Staff/Meals) — no force-quit needed.

---

## Fix 4 — Stop collapsing every meal-detail error into "Meal not found"

**File:** `app/meals/[meal_id].tsx`

**Current code** (inside `load`):

```tsx
  const load = async () => {
    if (!meal_id) return;
    try {
      const [m, r] = await Promise.all([getMeal(meal_id), getMyResponse(meal_id)]);
      setMeal(m);
      setMyResponse(r);
    } catch { Alert.alert("Error", "Meal not found."); }
    finally { setLoading(false); }
  };
```

**Problem:** any thrown error — a genuine 404, a 403 gate (KYC/rent block), or a plain
network failure — surfaces as the same hardcoded "Meal not found.", which is actively
misleading for the non-404 cases and was the literal message seen in testing (root cause was
actually Fix 1/3's stale `activePgId`, not a missing meal).

**Proposed change:** match the error-handling pattern already used in `app/meals/index.tsx`
and `app/(tabs)/index.tsx` — inspect `PGowApiError`'s `httpStatus`/`code` and message
accordingly. This screen doesn't currently import `PGowApiError`; add it.

```tsx
import { PGowApiError } from "../../src/hooks/useApi"; // add to existing imports

// ...
  const load = async () => {
    if (!meal_id) return;
    try {
      const [m, r] = await Promise.all([getMeal(meal_id), getMyResponse(meal_id)]);
      setMeal(m);
      setMyResponse(r);
    } catch (err) {
      if (err instanceof PGowApiError) {
        if (err.httpStatus === 404) {
          Alert.alert("Not Found", "This meal no longer exists.");
        } else if (err.httpStatus === 403) {
          Alert.alert("Access Restricted", err.message);
        } else {
          Alert.alert("Error", err.message);
        }
      } else {
        Alert.alert("Error", "Couldn't load this meal. Check your connection.");
      }
    }
    finally { setLoading(false); }
  };
```

**Verification:**
- Manual: navigate to `/meals/<a-real-uuid-that-does-not-exist>` — should show "Not Found /
  This meal no longer exists.", not a generic message.
- Manual: as a guest under an active KYC/rent gate, opening a meal they're blocked from
  should show the actual gate message from the backend, not "Meal not found."
- Regression: a genuinely valid meal must still load normally (no change to the success
  path).

---

## Explicitly out of scope for this plan

- Adding a location step to `app/auth/register.tsx` — not a bug; location is correctly
  collected per-property, not per-owner-account. Fix 2's onboarding card is the intended
  bridge between "just registered" and "add a property with its location."
- `src/hooks/useApi.ts` has no request timeout/`AbortController` on its `fetch()` calls,
  which is a separate, already-known gap (a hung connection spins forever with no error). Not
  touched here; flagged for its own follow-up.

## Suggested apply order

1. Fix 1 (`authStore.ts`) — foundational, nothing else should be verified before this lands.
2. Fix 3 (`properties/create.tsx`) — depends on Fix 1's corrected `activePgId` derivation.
3. Fix 2 (`(tabs)/index.tsx`) — visible proof that 1+3 worked.
4. Fix 4 (`meals/[meal_id].tsx`) — independent, can be done any time.

After all four: full manual re-test — register a new owner on a device that has an old
account's data in SecureStore, confirm the onboarding card (not guest actions) appears,
create a property, confirm quick actions flip to owner actions without restarting, and open
a meal under both a valid and an invalid id to confirm distinct error messages.
