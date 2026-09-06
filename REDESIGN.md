# PGow redesign — working specification and handover

You are continuing a UI/UX redesign of a React Native (Expo) app for PG / co-living property
management. About two-thirds of it is done. This document is the specification for the rest.

**Read sections 0–5 before touching any file.** Section 6 is the work queue. The rules in
section 1 exist because they were violated during the first two-thirds and had to be corrected;
they will feel over-strict until you hit the situation each one describes.

---

## 0. How to use this document

This is not a summary. It is the design reasoning, written down so you make the same calls
the previous work made rather than re-deciding from scratch and producing a third design
language inside one app.

**When you pick up a screen:**

1. Read section 1 (rules) and section 4 (design system) — every time. They're short.
2. Find the screen in section 6. It says what it currently is and what it should become.
3. Follow the method in section 5.
4. Verify with section 3's commands. All must pass before you call it done.

**The single most important idea in this document:** almost everything you are about to build
already exists as a primitive. The remaining screens are large because they drew their own
version of rows, cards, sheets, headers, inputs and buttons. Your job is mostly *deletion* —
replacing 80 lines of hand-rolled layout with 10 lines of primitive. If a screen gets longer
under your hands, stop and re-read section 4.

---

## 1. Standing rules

These come from the app's owner. They override your defaults.

### 1.1 Never invent data

If a number, date or status isn't in the API response, do not render a placeholder and do not
compute a plausible substitute. Leave the element out, or say the data isn't available.

Real examples caught during this work:
- A "waiting N days" badge on KYC submissions. There is no usable submitted-at timestamp on
  the roster. The badge was inventing a number.
- Occupancy percentage falling back to `85` when the fetch failed — so a broken request looked
  like a healthy property.
- Complaint counts falling back to `22` on an empty property. A property with zero complaints
  is *good news*, not a reason to draw 22 invented tickets.
- Deltas like "↑ 12%" with no prior value behind them. Only P&L's `compData` and Overview's
  `revenueGrowthPct` are real comparisons. Everywhere else, there is no baseline — so no delta.

### 1.2 No AI/ML

This app is hand-written deterministic business logic, on purpose. If something looks like it
wants a model, it wants a rule with a threshold. Propose the rule and its number.

### 1.3 Pickers over typing

If the set of valid answers is knowable, offer it. Free text is for when it genuinely isn't.

- **≤ 6 options** → `ChoiceChips` (wraps, all visible at once)
- **> 6 options** → `PickerField` (a row that opens a sheet)
- **Free text** → `OutlinedTextField`, and only when the answer really is open-ended

Why this matters: a free-text "sharing" box lets someone create a 40-bed room. A free-text
"floor" box files a room on floor 99 of a two-storey building. Neither is caught until someone
notices the layout is wrong.

### 1.4 Check twice before deleting

Before removing anything that looks dead:

```bash
git show HEAD:<file> | grep -c 'styles\.<name>\b'   # was it already dead?
grep -rn '<Symbol>' app src                          # every caller
```

About a third of the "orphaned" styles found during this work were already dead beforehand.
Attribute them correctly — you're reporting what your change did, and a claim that isn't true
is worse than no claim.

### 1.5 Show the design before building it

For anything with a visual outcome: describe or mock up what you intend, then wait for an
explicit go-ahead. "Use your judgment", "I trust you" and "I'm counting on you" authorise your
*recommendation*, not your *implementation*.

This was corrected twice during the first two-thirds. Both times the work was technically fine
and still wrong, because it wasn't asked for yet.

---

## 2. How the current design was arrived at

Context you need in order to extend it consistently.

### 2.1 The starting problem

The app had a "prototype" look: navy gradient hero banners, emoji used as icons, cards floating
on a near-white page, eight different status-pill implementations, three header components plus
eighteen hand-rolled copies, 803 hardcoded corner radii against 55 uses of the tokens.

The owner's brief, in their words, was that it looked "like a past 5 to 10 years design" and
needed to be "modern, smart, attractive" — while staying familiar. Several rounds of options
were presented; the direction chosen was the one that keeps a flat white ground and earns
attention through type, hairlines and a small number of *meaningful* filled surfaces.

### 2.2 The ground: warm white, and why

**Two passes happened here. Read both — the second superseded the first.**

**Pass one (the fix).** The original canvas was `#F6F9FB`. A white card on it measured
**1.06:1** — optically the same colour. So nothing read as a surface, and the only thing
drawing a card edge was a 1.46:1 border, which is invisible. You cannot make a white card
visible on a near-white page; the page has to stop being near-white. Canvas and surface both
became pure `#FFFFFF`, and structure moved to `separator` hairlines and to type.

**Pass two (the warm direction).** Pure white plus a cool ocean-blue brand read as *correct
and corporate* — right for a bank, wrong for an app about where people live. The ground is now
a warm white, `#FFFCF9`.

The rule that survived both passes, and matters more than either value:

> **The warmth lives in the ground, the hairlines and the type — never in large coloured
> fills.** Big tinted areas are what make a warm palette look beige and cheap. Hairlines and
> warm near-black type are what make it look considered.

`canvas` and `surface` are still the *same value*, deliberately. Structure still comes from
`separator`, not from a background difference. **A filled surface is still reserved for
something that means it** — a metric card, a state tint, an alert. Be suspicious of any new
tinted background: if it doesn't carry meaning, it shouldn't be tinted.

### 2.3 Colour: measured, not chosen

Every value in `Colors` was verified with real WCAG arithmetic, and `colors.check.ts`
re-computes it on every build. The rules it enforces:

- Anything carrying white text clears **4.5:1**. The old teal/green/cyan fills sat at 2.5–2.6:1.
- Status colours are different **hues**, not different blues. `warning` used to be `#54ACBF` —
  the exact same cyan as `secondary` — so "pay your rent" and "here's an accent" rendered
  identically. Amber means caution, green means good, red means stop.
- Body text is softened, not maximised. `textPrimary` was 15.94:1, near-black on near-white,
  a known source of eye strain. It's 12.5:1 now — still crisp, considerably kinder.
- Icons are non-text and held to **3:1**, not 4.5:1 (WCAG 1.4.11).

`DeckTints` are four verified `{ fill, ink, sub }` triplets. A tinted surface needs ink of its
own hue — generic near-black on an amber fill looks like a mistake, and `textMuted` on any of
them misses AA.

### 2.4 Radii: named by role, not size

The old scale was `sm/md/lg/xl/xxl/big/huge/round/mega` — sizes with no purpose, so nobody
could tell which one their card was supposed to use. Result: 803 hardcoded values spanning 14
distinct numbers, including 3, 19 and 22.

Five role-named values now, each with one job. **If a new shape fits none of them, the shape is
probably wrong** — that's the point of the constraint, not a limitation to work around.

### 2.5 Motion: what springs and what doesn't

The rule settled on:

- **Direct manipulation** — drag, scrub, a gesture releasing — is a **spring**. Something a
  finger was driving a frame ago should decelerate the way the finger did.
- **State transitions** — a screen fading, a scrim, a label folding away — is **timing**.
  Opacity has no momentum to model; springing a scrim overshoots past opaque.

Two discoveries worth knowing:

- `AnimatedPress` was built on `TouchableOpacity` with `activeOpacity={scale}`. But
  `activeOpacity` is a *transparency*, not a transform — so passing `0.92` meant "stay 92%
  opaque", i.e. barely dim at all. The documented "scale-down on press" **never happened**, at
  ~83 call sites, for as long as the component existed. It's a real spring transform now.
- Reanimated primitives read the OS "reduce motion" setting themselves. Anything *not* built on
  Reanimated — like `CountUp`'s `requestAnimationFrame` loop — must check `useReducedMotion()`
  explicitly.

### 2.6 Haptics: narrow on purpose

`expo-haptics` was installed and entirely unused; someone had removed the vibration feedback
before. It's back, but only on **real, consequential confirmations**: verify/reject a payment
or an ID, publish an announcement. Never on navigation, never on ordinary taps.

They're attached to the **mutations**, not the UI call sites — so verifying from the
notifications inbox and verifying from the Payments tab are the same action, not two parallel
ones that could drift.

`hapticSuccess()` for a decision that went the way it was intended; `hapticCaution()` for a
deliberate negative like a rejection. A rejection is a *successful operation with a negative
outcome*, so it's `Warning`, not `Error`. `Error` is reserved for a request that actually
failed.

### 2.7 Navigation: ordered by frequency, laid out centre-out

A bottom bar is held one-handed. The **centre** is the easiest place for either thumb; the two
outer slots are the hardest. So destinations are declared in `navTabs.ts` in **frequency
order**, and `centreOut()` maps that ranking onto physical slots — rank 1 to the middle, 2 and
3 flanking it, 4 and 5 at the ends.

Declaring by rank rather than position is the point: if a destination gets busier you move it
up the array and the layout follows. Nobody has to work out which index the middle is.

Both Material 3 and Apple's HIG cap a bottom bar at five, because past five the targets fall
below 48dp on a 360dp phone and labels truncate. Every profile respects that using routes that
already exist — nothing invented a screen to fill a slot.

**`unstable_settings = { anchor: … }` in each tab layout is load-bearing.** Expo Router takes
the initial route from the *first trigger*, and centre-out deliberately puts the least-used
destination there. Delete the anchor and every session opens on the wrong screen.

### 2.8 Forms: the shape tells you what it wants

The field primitive had **eleven styling escape hatches and zero validation props** — no
`error`, no `helper`, no `required`. So validation had nowhere to go, and went into **34
blocking `Alert.alert` popups** that describe in prose which of thirteen fields is empty, then
disappear.

Now: errors live on the field, in words you can act on, and clear as you type — so you never
re-submit to find out whether the fix counted.

The visual grammar is the enforcement mechanism for rule 1.3:

- **A soft filled box means you type here** (`OutlinedTextField`)
- **A row with a chevron means you choose here** (`PickerField`, opens a sheet)

Someone can see, before touching anything, which fields will make them use the keyboard. And a
free-text field that *should* have been a picker is no longer invisible in review — it's the
wrong shape.

### 2.9 Sheets: three surfaces, and why not one

36 files were hand-rolling `<Modal>`, at three different animation styles, with 13 hand-rolled
sheet surfaces and 14 hand-rolled backdrop scrims. `DetailBottomSheet` already existed, was
well-built, said in its own comment that it existed because "every screen was rolling its own
Modal" — and had **three adopters**.

The lesson that shaped the guards: *in this codebase, a primitive without a check that fails
the build stalls at about 10% adoption.* Every prior consolidation followed the same curve.

The split chosen:

| Situation | Surface | Why |
|---|---|---|
| Detail / form / picker | `Sheet` (bottom) | Rises from the bottom, leaves context visible behind |
| Plain yes/no confirm | native `Alert.alert` | 30 of 31 confirms already were one. Familiar, accessible, cannot style-drift |
| Confirm needing a reason | `TextPromptDialog` (centered) | **`Alert.prompt` is iOS-only** — its whole body is behind `if (Platform.OS === 'ios')`. A native confirm cannot hold a text field on Android |

Centered rather than bottom for the reason dialog is deliberate: it *interrupted* you, which is
what a confirmation is for. A bottom sheet reads as somewhere you went.

### 2.10 The guards, and why two of them are ratchets

Five guards assert zero. Two are **ratchets** — they record today's per-file count, allow it to
fall, and fail if it rises. They also fail if you convert something and forget to lower the
number, because a stale budget is a lie about how much is left.

This shape was chosen because the sweeps behind them are genuinely unfinished, and pretending
otherwise would either block all work or let the problem quietly grow back. A ratchet lets the
work happen a screen at a time while making regression impossible.

**The ratchets are the task list.** `npm run check` prints the live remaining counts.

---

## 3. Verification — run all of these, every time

```bash
cd pgowfrontend
npx tsc --noEmit                      # must be silent
npm run check                         # 8 guards, all must pass
npx expo export --platform android    # must produce a bundle
```

After any deletion, also:

```bash
npx tsc --noEmit --noUnusedLocals
```

This will **not** be clean — there are ~19 pre-existing unused declarations deliberately left
alone under rule 1.4. Compare against the same command *before* your change; only fix what you
newly created.

There is no test framework and no bundler in the guards. They run under plain `node` with type
stripping, which is why every guarded module must stay free of runtime imports.

| Guard | Enforces |
|---|---|
| `mappers.check.ts` | API-shape mapping — money, dates, statuses |
| `logic.check.ts` | UPI URIs, role mapping, status tones, nav slot ordering |
| `headers.check.ts` | One header component |
| `tokens.check.ts` | Every radius is a role-named token |
| `colors.check.ts` | Palette tokens only + live WCAG maths |
| `forms.check.ts` | One text field, and it can show an error |
| `sheets.check.ts` | **Ratchet** — raw `<Modal>` count |
| `press.check.ts` | **Ratchet** — `TouchableOpacity` outside groceries |

---

## 4. The design system

### 4.1 Tokens — `src/theme/`

Never write a raw hex or radius; the guards fail. **The ban list in `colors.check.ts` now also
bans raw white and every value of the old cool palette**, so a copy-paste from an old screen
fails loudly instead of quietly leaving a cold patch on a warm page.

**Colours — the warm palette (every pair verified, see 2.3):**

| Token | Value | Role |
|---|---|---|
| `canvas` / `surface` | `#FFFCF9` | Warm white. Same value on purpose |
| `surfaceMuted` | `#F7F2ED` | Input fills, secondary grounds |
| `surfaceElevated` | `#F2EAE3` | Active chips, soft highlights |
| `separator` | `#EBE2DA` | The hairline that groups. 1.25:1 |
| `borderSubtle` | `#DCD0C5` | A visible edge when one is needed |
| `primary` | `#A24A2A` | Terracotta. **The accent — not chrome** |
| `primaryDark` | `#5C2B18` | Pressed states, deep headings |
| `textPrimary` | `#3A2F25` | Warm near-black, 12.73:1 — softened on purpose |
| `textSecondary` | `#4B3F36` | Supporting copy |
| `textMuted` | `#77685C` | Captions, meta, **navigation chrome** |
| `textInverse` | `#FFFCF9` | Text on a coloured fill |
| `success` / `warning` / `danger` | `#2C6248` / `#8A5A15` / `#A83226` | Three distinct hues, warm-world |

**`DeckTints`** — `{ fill, ink, sub }` triplets, ink and sub both verified on their own fill:

| | fill | ink | sub |
|---|---|---|---|
| `brand` | `#F6E9E1` | `#5C2B18` | `#8A5138` |
| `green` | `#E6F0E9` | `#1F4A37` | `#3F6B56` |
| `amber` | `#F9EEDA` | `#6A4310` | `#825D2C` |
| `slate` | `#F2EDE8` | `#2A231E` | `#6B5D52` |

- **`Radii`** — `badge` 6 · `control` 10 · `card` 18 · `sheet` 22 · `feature` 24 · `pill` 999
- **`Motion`** — `timing.micro` 120 · `.small` 180 · `.tab` 200 · `.sheet` 300 · `.chart` 500

### 4.2 Primitives — `src/components/ui/`

| Component | Use for | Notes |
|---|---|---|
| `Txt` | All text | `tabular` on any number in a list or beside another number |
| `ListRow` | A row about a **thing** | 36px identity tile, 56 min height. `first`/`last` bound a run |
| `MetricRow` | A row about a **number** | No tile. A tile means "tap into this"; a number has no identity |
| `MetricDeck` | Tinted metric cards, swipeable | Optional `numericValue` + `format` makes it count up |
| `TrendChart` | The one bar chart | Drag to scrub. One series = recency ramp; two = grouped |
| `StatusChip` | Every status | `toneFor()` maps the vocabulary → 5 tones. `variant="dot"` in lists |
| `CountUp` | A number animating to a new value | Checks reduce-motion itself |
| `OutlinedTextField` | **Type here** | Filled, borderless at rest. `error` / `helper` / `required` |
| `PickerField` | **Choose here** | Row + chevron. Same 56px as `ListRow`, deliberately |
| `SearchField` | Filter a list | No label, no validation, has a clear button |
| `ChoiceChips` | Pick one of ≤6 | Wraps. Takes `error` too |
| `Sheet` | The one bottom surface | Handle, header, scroll body, pinned `footer`, safe-area, spring |
| `AnimatedPress` | Every tappable thing | Real spring transform |
| `EmptyState` | Empty **and** loading **and** error | These three are not interchangeable |
| `AppHeader` | Every screen header | Two variants: root, or `onBack` |

### 4.2b How feedback reaches the user — the five surfaces

This is a whole design layer and it is easy to miss, because no screen owns it. There are five
places a message can appear, and picking the wrong one is the most common mistake here.

| Surface | Use for | Where it lives |
|---|---|---|
| **Inline field error** | "This field is wrong, fix it here" | `OutlinedTextField.error` etc. |
| **Toast** (`AlertOverlay`) | "That worked" / "That didn't" — short-lived, non-blocking | `useToast(tone, title, desc?)` |
| **Native `Alert.alert`** | A decision you must make now, or a failure you must acknowledge | Built in |
| **`TextPromptDialog`** | A decision that needs a typed reason | `components/dialogs/` |
| **Persistent badge / strip** | "Something is waiting, whenever you're ready" | Header bell dot · `DockAlert` |

**The decision rule:** is it about *a field*? Inline. Is it *confirmation that something
happened*? Toast. Does it *require an answer before continuing*? Alert (or the reason dialog).
Is it *state that persists until acted on*? Badge or strip — never a toast, because a toast
that carries the only copy of important information is information you can miss by blinking.

#### The toast — `AlertOverlay`

**Mounted once**, at `app/_layout.tsx`, above everything. Driven by `activeAlert` in the
Zustand store, set from ~45 call sites plus `useToast`. None of those call sites knows what a
toast looks like, which is the point.

Three things about it were fixed and must not regress:

1. **It clears the header.** It used to sit at `insets.top + 8` — *above* where every role
   header draws (`insets.top + 12..14`) — so for the toast's whole life it covered the back
   button, the title and the notification bell. And because the card is itself pressable, it
   *swallowed* those taps: tapping "back" during a toast dismissed the toast instead. It now
   offsets by `HEADER_BAND_HEIGHT`, which is the Material "banner sits below the app bar" rule.
2. **It is announced.** A card that appears and vanishes in three seconds doesn't exist for a
   screen-reader user unless something says it aloud.
3. **Its timeout scales with its content.** A bare title cleared in 2.2s; a title plus a
   two-line description did not.

**Top-anchored, not a bottom snackbar** — deliberately. Login toasts fire while the keyboard
may still be up, and a bottom card would be behind it.

Tones: `success` · `warning` · `error` · `info` · `meal` · `payment`. A left accent bar carries
the tone. It replaced a full-width banner with a giant icon bubble and an all-caps tagline per
type — which looked like a system alert rather than a toast, and fired on *every* login the
same way it fired on a payment being recorded.

#### Push notifications

- `src/features/notifications/channels.ts` — sets the handler at **module scope**, not inside a
  hook, so it's live from the first notification the process sees, including one delivered
  before any screen mounts. Also defines the Android channels.
- `src/data/notificationHelper.ts` — local/scheduled notifications (the chef's three daily
  meal-posting alarms live here).
- `useRegisterDeviceForPush()` — device token registration.
- `app/_layout.tsx` — `addNotificationResponseReceivedListener` handles a **tap** on a push and
  routes to the right screen.

#### Foreground push — decided: leave the OS banner, refresh the state

This was left open and is now settled, on the app's own rule from the top of 4.2b.

A push like "3 payments need verification" is **persistent state, not a confirmation**. By the
decision rule, it must not be a toast — a toast auto-dismisses in ~3 seconds and carries no
action, so making it one would put the only copy of something you must act on inside a card
that vanishes.

So the resolution is not "convert push to toast". It is:

- **Leave `shouldShowAlert: true`.** The OS banner handles the momentary "something happened".
  It is familiar, accessible, carries the app icon, and costs nothing to maintain. This is what
  most non-messaging apps do; the elaborate in-app banner is a pattern from apps where messages
  *are* the product (Slack, WhatsApp), and PGow is a management app.
- **Make the push refresh the state it's about.** A foreground push should invalidate the query
  behind the badge and the nav strip, so the persistent surfaces update. That is the piece
  actually worth building — and it is not a visual change at all.

Write this down if you revisit it. The reason to prefer it isn't taste, it's that the toast and
the badge answer different questions, and a push answers the badge's.

#### The bell dot and the nav strip are not inconsistent

Second look: they measure different things, and both are right.

- **Header bell dot** — "there is something unread". Boolean, because unread-ness is boolean:
  you either have new items or you don't, and a count of unread *notices* isn't a workload.
- **`DockAlert` strip** — "N still need your decision". A count and a sentence, because open
  decisions *are* a workload, and the number changes what you do next.

Keep them different. What matters is that the labels stay honest about which is which — the
bell must not start counting decisions, and the strip must not start counting unread notices.

### 4.3 Things `Sheet` already does — stop if you're writing these

A backdrop scrim · a drag handle · a header row with title, subtitle, icon and close button ·
a scrolling body · a footer pinned below the scroll so the primary action never scrolls away ·
safe-area bottom padding · a spring entrance with a faded scrim.

**~90 style blocks were deleted** during the sheet work that were re-implementing exactly these.
One screen even carried a comment explaining a bug it had hit by getting the pinned-footer part
wrong. If you're writing a `modalBackdrop`, `sheetHandle`, `sheetTitle` or `closeBtn` style,
you are rebuilding `Sheet`.

### 4.4 What is *not* a sheet

- A **full-screen map picker** — takes over the display
- An **image / video inspector** — edge-to-edge dark surface
- An **anchored dropdown** — a small menu positioned near its trigger
- A **near-fullscreen detail screen** with its own header bar and back arrow

These are screens presented modally. They live in `sheets.check.ts`'s `EXEMPT` set **with a
written reason**. Adding to that set is allowed; doing it without a reason is not.

---

## 4.6 What "attractive" means here — the aesthetic bar

Everything above tells you how to be **consistent**. Consistency alone produces a correct, flat,
forgettable app. This section is the difference between "uses the primitives" and "looks good",
and it is the actual brief: **take the current design as the foundation and make it attractive.**

Do not invent a new visual language. Extend this one, well.

### 4.6.1 One hero per screen, then quiet

The strongest thing about the redesigned screens is restraint. Each has **exactly one** loud
element, and everything below it is deliberately calm:

```
┌─────────────────────────────┐
│  header — title, actions    │   quiet chrome
├─────────────────────────────┤
│  ███ THE HERO ███           │   the one filled, tinted, large thing
│  ███  (deck / chart) ███    │
├─────────────────────────────┤
│  Label              value   │   hairline-separated rows
│  Label              value   │   no fills, no borders, no shadows
│  Label              value   │
└─────────────────────────────┘
```

The hero is usually a `MetricDeck` (tinted cards, big tabular numbers) or a `TrendChart`. Below
it, rows. **If a screen has two heroes it has none** — the eye has nowhere to land.

For a screen with no numbers (a form, a list), the hero is the *first thing you came to do* —
the primary field, or the first row. Give it room; don't decorate it.

### 4.6.2 Hierarchy comes from size and weight, not colour

Look at any redesigned screen: the big number is big. It isn't also coloured, boxed, badged and
underlined. Colour is spent on **meaning** (a status, a state tint), never on emphasis.

The scale in practice:

| Role | Size | Weight |
|---|---|---|
| Hero number | 27 | 700 |
| Row title | 13.5 | 600–700 |
| Row value | 13.5 | 600 |
| Meta / label | 11 | 400–600 |
| Caption | 10.5 | 400 |

Three sizes on a screen is plenty. Four is usually one too many.

### 4.6.3 Tint is a sentence, not decoration

`DeckTints` exist to say something. `brand` = the headline number. `green` = money in, or a
clear queue. `amber` = something wants attention. `slate` = a plain count with no opinion.

**A tint that doesn't mean anything is noise.** When you reach for one, finish the sentence
"this is tinted because…". If you can't, use white.

The same applies to the nav bar's state tinting: amber means work is queued, green means the
queue is empty, and there's a numeral because colour alone reaches nobody who can't see it.

### 4.6.4 Space is the separator — hairlines are the grouping

Two mechanisms, two jobs, and mixing them is what made the old screens look busy:

- **A hairline (`Colors.separator`) groups.** A run of rows bounded top and bottom reads as one
  object. Never put a hairline between things that aren't a set.
- **Whitespace separates.** Sections are divided by 24–28px of nothing, not by a rule, not by a
  card, not by a background change.

If you find yourself adding a border to make something feel separate, add space instead.

### 4.6.5 Shadows are almost never the answer

`Layout.shadowCard` exists and is soft. Use it for a standalone card that genuinely floats —
one or two per screen at most. **Never on a row inside a list**: it's per-view overdraw on
Android, which is exactly what makes a long list stutter, and forty soft shadows read as fog.

A white surface on a white page is separated by its hairline, not by elevation.

### 4.6.6 Numbers are typography

Every figure in a list, a row, or beside another figure gets `tabular`. Without it, "₹1,42,300"
and "₹86,400" sit on different optical grids and a column of rupee figures never lines up —
which reads as sloppiness even to someone who can't name why.

Round in the display, format at the edge. `formatINR` for money.

### 4.6.7 Motion is felt, not watched

The motion in this app should be almost invisible. A press compresses slightly. A sheet springs
up. A number counts rather than snapping. A chart reveals when you touch it.

**Nothing moves on its own.** An auto-advancing carousel was deleted from Overview for hiding
content behind a timer nobody asked for — if there's one on a screen you're redesigning, check
whether it's doing the same thing before preserving it.

### 4.6.8 Copy is part of the design

Short, sentence case, verb-first, specific. "Give the notice a title" rather than "Validation
error". "3 payments waiting to be verified" rather than "You have pending items".

An empty state is an invitation, not an apology: name what goes here and offer the action.

### 4.6.9 The test

Before you call a screen done, look at it and ask:

1. **Where does my eye land first?** If the answer isn't the most important thing, fix hierarchy.
2. **What is the one thing I came here to do?** Is it obvious and reachable with a thumb?
3. **Could I remove something?** Nearly always yes. Borders, labels that repeat the value,
   a second heading, a card wrapper around something that could be rows.
4. **Does anything shout without earning it?** Every colour, shadow, border and bold weight
   should be answerable with "because…".

The direction chosen for this app was described by its owner as wanting to be *modern and
attractive* while staying *familiar* — MAYA, most-advanced-yet-acceptable. That means the
restraint above is not minimalism for its own sake; it's leaving enough quiet that the one
thing that matters can be loud.

---

## 4.7 Making it attractive — the remaining work, in order

The warm palette (2.2) is **done and verified**. Everything below is not. It is ordered by
impact per unit of effort, and each item says what to do, what *not* to do, and how to check.

**The principle that governs all of it:** users describe a good interface as "clean",
"premium", "easy". They cannot usually point at *why*. That is because the quality comes from
clarity, consistency, spacing, readable type and meaningful emphasis — not from decoration.
Every item below buys one of those. Nothing below is ornament.

---

### 4.7.1 Typography — the single biggest remaining lever

**Current state:** zero custom fonts. `useFonts` is never called. Every screen renders in the
platform default — San Francisco on iOS, Roboto on Android. So the app looks like *two
different apps* depending on the phone, and like a system utility on both.

**Why this is first:** one good typeface changes every screen at once, costs no layout work,
and is the difference people read as "premium" without being able to name it.

**What to do:**

1. Add `@expo-google-fonts/<family>` and load in `app/_layout.tsx` with `useFonts`, holding the
   splash until loaded (`SplashScreen.preventAutoHideAsync`) — a font pop on first paint is
   worse than a slightly longer splash.
2. Wire it into `Txt` as the default `fontFamily`, so it lands everywhere at once. **Do not**
   set `fontFamily` at call sites; `Txt` is the only place it belongs.
3. Numbers keep `tabular`.

**Choosing the family — the constraints, not a recommendation:**

- It must have **true tabular figures**, or the money columns lose their alignment and you have
  undone 2.6. Verify before committing.
- It needs **400 / 500 / 600 / 700** at minimum. The app uses all four.
- It must stay legible at **10px** (captions) and **27px** (hero numbers).
- A warm, slightly humanist face suits the ground better than a geometric one. Geometric sans
  on a warm ground reads cold and fights it.
- **One family, not two.** A display face plus a body face is a real design system decision and
  this app does not need it.

**What not to do:** do not load four weights you don't use — each is a real download on a slow
connection. Do not use a font with lining-only figures. Do not put a serif in the chrome.

**Check:** every screen still renders; no `fontFamily` outside `Txt`; the P&L and Payments
columns still line up.

---

### 4.7.2 Accent discipline — terracotta must stay rare

**Current state after the palette pass:**

| Use of `Colors.primary` | Count | Verdict |
|---|---|---|
| Icon tints | ~206 | **Mostly wrong.** Most are chrome |
| Filled surfaces | ~149 | Some right (primary buttons), many wrong |
| Text colour | ~200 | Mixed |
| Borders | ~72 | Mostly wrong — a border is structure |
| Navigation chevrons | **0** | Already swept ✓ |

**The rule:** on any given screen, the accent should appear on **at most three** things. If you
can see more than three terracotta elements at once, the accent has stopped meaning anything —
it has become the new grey, which is exactly what happened to the ocean blue it replaced.

**What earns the accent:**
- The one primary action on the screen
- The active state of a control the user is currently in
- A single number or status that is genuinely the point of the screen

**What does not, and should be `textMuted` or `textPrimary`:**
- Chevrons, close buttons, back arrows *(done)*
- Decorative icons beside a label — the label already says it
- Borders and dividers — that is `separator`'s job
- Icons in a list where every row has one. Forty accent icons is a texture, not an emphasis
- Section-heading icons

**How to work through it:** do not codemod this. Go screen by screen, open it, count the
terracotta. If it is more than three, decide which three earn it and demote the rest. This is
judgement, and a regex cannot make it.

**Check:** screenshot a screen, squint at it. The accent should draw your eye to the thing you
came to do. If your eye goes nowhere in particular, there is too much of it.

---

### 4.7.3 Spacing rhythm

**Current state:** spacing is per-screen and ad hoc. `Spacing` tokens exist (`xs` 4 · `sm` 8 ·
`md` 12 · `lg` 16 · `xl` 20 · `xxl` 24 · `section` 28) and are inconsistently used; most screens
write raw numbers.

**The rhythm to apply:**

| Gap | Value | Between |
|---|---|---|
| Inside a component | 8–12 | Icon and its label, a label and its value |
| Between rows in a run | 0 | The hairline does it — never add margin between rows |
| Between a heading and its content | 8 | |
| Between sections | **24–28** | This is the one that makes a screen feel calm |
| Screen horizontal padding | 16–20 | Use `useResponsivePadding` |

**The single most common mistake** in the current screens: sections separated by 12px, which
reads as one continuous wall of content. Section separation is the primary thing that makes an
interface feel effortless — it tells the eye where one idea ends.

**What not to do:** do not add a card, a border or a background change to separate sections.
Space does it. That is 4.6.4, and it is the difference between calm and busy.

---

### 4.7.4 Empty, loading and error states

**Current state:** an Ionicon, a title, a subtitle. Functional and forgettable. This is where
personality lives in every app that has any, and PGow currently has none.

**What to do, in priority order:**

1. **Make the copy do the work first.** "Start your first property" beats "No data". An empty
   state is an invitation, not an apology. This costs nothing and is most of the benefit.
2. **Always offer the action.** An empty list that doesn't tell you how to fill it is a
   dead end.
3. **Then, and only then, consider illustration.** If you add one: a single simple line
   illustration in `textMuted` weight with one terracotta accent, sized ~120px, used on maybe
   five screens — first run, empty residents, empty payments, empty tickets, all-caught-up.
   **Not one per screen.** A different illustration on all 44 screens is a zoo.
4. **Loading is not empty.** `EmptyState` already takes `loading` and `error` separately, and
   they must stay separate — a query in flight, a query that returned nothing, and a 403 are
   three different messages. A permissions failure that reads "nothing here yet" is a lie.

**What not to do:** no spinners on a full screen where a skeleton would be calmer; no
animated illustrations; no mascot.

---

### 4.7.5 Depth — where elevation is allowed

**Current state:** flat, with `Layout.shadowCard` available and rarely used.

**The rule:** at most **one** elevated thing on screen at a time.

| Surface | Depth |
|---|---|
| Rows in a list | **None.** Hairlines. Never a shadow — per-view overdraw is what stutters a long list on Android |
| The hero deck card | A soft shadow is allowed, or none. Not both a shadow and a border |
| A `Sheet` | Yes — it is genuinely floating |
| The nav bar | The upward hairline shadow it already has |
| Buttons | None. A fill is enough |

**What not to do:** do not put a shadow on something that also has a border — pick one. Forty
soft shadows read as fog, not as depth.

---

### 4.7.6 Micro-interactions — three worth building

Motion should be almost invisible (4.6.7). These three are worth it because each carries
*information*, not decoration:

1. **A confirmation that draws itself.** After verify/approve, a checkmark that strokes in over
   ~250ms. It says "this landed" better than a toast, and it's at the moment of highest
   consequence. Pairs with the haptic that already fires there.
2. **The deck settling on refresh.** `CountUp` already exists and is wired on Overview only —
   extend it to the other analytics screens. Numbers that count read as live data.
3. **Row press that follows the finger.** `AnimatedPress` already springs. Verify it *feels*
   right on a slow Android device; the value is currently a guess (0.97/0.99).

**What not to do:** no staggered list entrance animations (they delay content for decoration),
no page transitions beyond the existing tab cross-fade, nothing that moves on its own.

---

### 4.7.7 The order to do this in

1. **Typography** — one change, every screen, largest perceived gain
2. **Spacing rhythm** on the eight screens that matter most (4.6.1's "where you spend")
3. **Accent discipline** on those same eight, screen by screen with judgement
4. **Empty-state copy** everywhere; illustration on five screens at most
5. **Micro-interactions** last — they are the polish on top of a thing that is already good

**Do steps 1–3 on ONE screen first and look at it on a device.** If it doesn't feel different,
the direction is wrong and you have spent one screen finding out rather than forty.

---

## 5. The method for redesigning a screen

### Step 1 — measure it

```bash
f=src/features/.../Screen.tsx
echo "lines: $(wc -l < $f)"
grep -cE 'ListRow|MetricRow|MetricDeck|TrendChart|StatusChip|Sheet\b|PickerField|SearchField|EmptyState' $f
grep -cE '^  [a-zA-Z]+: \{' $f    # hand-rolled style blocks
```

High styles + low primitives = not redesigned. A redesigned screen of any size lands around
20–30 style blocks, because the primitives own the rest.

### Step 2 — identify the archetype

Almost every screen in this app is one of five shapes:

| Archetype | Looks like | Built from |
|---|---|---|
| **List** | Residents, staff, orders, tickets | `ListRow` + `ListSectionHeader` + `EmptyState` |
| **Analytics** | Overview, P&L, RSVP trends | `MetricDeck` on top, `TrendChart`, then `MetricRow` runs |
| **Detail** | One resident, one order, one ticket | `Sheet` or a screen with `AppHeader` + `MetricRow` runs |
| **Form** | Add staff, checkout, book a repair | `OutlinedTextField` / `PickerField` / `ChoiceChips`, actions in a pinned footer |
| **Hub** | Groceries home, services | Cards in a grid, each opening one of the above |

If a screen is more than one of these, it's more than one screen — or it needs sub-tabs, which
several already have.

### Step 3 — convert, deleting as you go

Work top to bottom. For each block ask: *is there a primitive for this?* Replace, don't wrap.
The line count should fall.

### Step 4 — sweep what you orphaned

```bash
# dead style blocks (this codebase closes objects inline, so line-regexes miss them —
# use a brace counter, see the pattern used throughout this work)
python3 - <<'EOF'
import re
s = open('<file>').read()
print([m.group(1) for m in re.finditer(r'^  ([A-Za-z][\w]*): \{', s, re.M)
       if not re.search(r'styles\.' + m.group(1) + r'\b', s)])
EOF
```

Then check each against `git show HEAD:<file>` (rule 1.4) before deleting, and report which
were yours versus already dead.

### Step 5 — verify, then lower any ratchet budget you moved

---

## 6. The work queue

### 6.1 Modals — 21 left, ~12 convertible

`node src/data/sheets.check.ts` prints the live per-file budget.

`KycUploadDialog` (1 of 2; other is a dropdown) · `GuestPaymentsTab` ×2 ·
`HousekeepingDashboard` ×2 (one is a two-state save confirm — probably two `Alert.alert`s) ·
`OwnerServicesTab` · `ProcurementScreen` cart · `overview` overdue list ·
`FeaturedMonetizedAdCard` · `SignInScreen` · `AddPgPropertyDialog` / `EditPgPropertyDialog`
(1 each; other is a map picker) · 5 in groceries.

**One at a time, typecheck between each.** The conversion cuts across a `</ScrollView>`
boundary; a careless tail match silently deletes form fields. Count inputs against
`git show HEAD:<file>` when a form is involved — four were nearly lost this way.

---

### 6.2 Groceries — 9 screens + 19 components. The largest block.

Also holds **all 96 remaining `TouchableOpacity`** and 5 modals. Deferred deliberately so it
gets **one** pass covering layout, press feedback and modals together.

`p:` = primitives used · `s:` = hand-rolled style blocks · `to:` = TouchableOpacity

#### Screens

| File | Lines | p | s | to | Archetype → what to build |
|---|---|---|---|---|---|
| `GroceryCartScreen` | 815 | 2 | **84** | 8 | **List + total.** Line items → `ListRow` with `amount` and a `QuantityStepper` as `trailing`. Totals → `MetricRow` run. Sticky total + checkout button → the `Sheet` footer pattern |
| `GroceryCheckoutScreen` | 799 | 4 | **76** | 7 | **Form.** Address, slot and payment method are all *choices* → three `PickerField` rows in one bounded group. `OutlinedTextField` only for the delivery note. Place-order in a pinned footer |
| `GroceryProductScreen` | 474 | 2 | **75** | 12 | **Detail.** Full-bleed image header, spec rows → `MetricRow`, variants → `ChoiceChips` (≤6) or `PickerField`. Add-to-cart pinned |
| `GroceryOrderDetailScreen` | 472 | 5 | 41 | 5 | **Detail.** Status timeline (see `OrderStepper`), line items → `ListRow`, order state → `StatusChip` |
| `GroceryCategoryScreen` | 474 | 3 | 35 | 5 | **List.** Product grid. **Keep its bespoke header search** — it carries a mic and a conditional clear |
| `GroceriesScreen` (home) | 326 | 5 | 25 | 3 | **Hub.** **Keep its bespoke `SearchBar`** — animated rotating placeholder plus a scan button |
| `GroceryWishlistScreen` | 253 | 2 | 26 | 6 | **List.** Straight `ListRow` + `EmptyState` |
| `GroceryProfileScreen` | 159 | 2 | 14 | 2 | **List.** Settings-style rows |
| `GroceryOrdersScreen` | 172 | 4 | 11 | 2 | **List.** Closest to done already |

#### Components

| File | Lines | s | to | Notes |
|---|---|---|---|---|
| `ProductCard` | 469 | 39 | 8 | Biggest component. Drawing its own card, price, badge, stepper — `PriceDisplay` and `QuantityStepper` already exist beside it |
| `FilterSheet` | 266 | 21 | 7 | A bottom sheet → `Sheet`. Filter groups → `ChoiceChips` |
| `MenuEditorModal` | 268 | 25 | 6 | → `Sheet` with pinned footer |
| `TodaysKitchenNeeds` | 473 | 24 | 5 | Holds the **only two `activeOpacity={1}`** in the app — deliberately no press feedback. Decide each individually rather than converting blind |
| `OrderStepper` | 174 | 26 | 0 | Status timeline. High styles, no touchables — a pure visual worth keeping but retokenising |
| `BulkPricingGrid` | 177 | 17 | 1 | Tiered price table → `MetricRow` run |
| `MiniProductCard` | 175 | 12 | 3 | |
| `SearchBar` | 171 | 10 | 3 | **Keep bespoke** — animated placeholder + scan button |
| `Header` | 144 | 12 | 2 | Check against `AppHeader` — `headers.check.ts` allows it today, verify that's still right |
| `CategoryGrid` | 139 | 9 | 2 | |
| `KitchenNeedsBanner` | 122 | 11 | 1 | |
| `CustomAlertModal` | 109 | 10 | 1 | **Delete it.** The app standardised on native `Alert.alert` 30:1; this is the single outlier |
| `ReplacementPicker` | 103 | 9 | 1 | → `PickerField` + `Sheet` |
| `QuantityStepper` | 87 | 6 | 2 | Small, reusable — likely fine |
| `PriceDisplay` | 84 | 5 | 0 | Should use `Txt tabular` |
| `MainBannerCarousel` | 240 | 9 | 1 | Auto-scrolling carousel. **Check whether it auto-advances on a timer** — one was deleted from Overview for hiding content behind a timer nobody asked for |
| `ProductRow` | 72 | 5 | 1 | → `ListRow` |
| `SectionHeader` | 47 | 3 | 1 | → `ListSectionHeader` |
| `AddAllToCartButton` | 51 | 2 | 1 | |

The 11 files under `app/groceries/` are 3-line route shims — nothing to redesign.

---

### 6.3 Resident-facing — used daily

| Screen | Lines | p | s | What it needs |
|---|---|---|---|---|
| `GuestRSVPsTab` (Meals) | 925 | 11 | 49 | Day strip and meal cards still bespoke. **Keep its `LinearGradient`** — it fades a hero photo into the surface, it is *not* a decorative banner |
| `(guest)/home.tsx` | 828 | 9 | 46 | Same — the gradient is an image fade and must stay. The card stack below is hand-rolled |
| `GuestPaymentsTab` | 888 | 10 | 29 | Closest to done; 2 modals left |
| `GuestFeedbackComplaintsTab` | 642 | 4 | 33 | 8 hand-rolled `Card`s. Ticket list → `ListRow` + `StatusChip`. Its image preview modal is an inspector — leave it |
| `book-technician` | 817 | 2 | 14 | Barely touched. A long single-scroll form — the strongest candidate in the app for a step-by-step treatment instead |
| `GuestHubServicesTab` | 223 | 2 | 11 | Service tiles → consistent grid |
| `GuestSecurityTab` | 340 | 4 | 12 | Mostly done |
| `TicketDetailScreen` | 271 | 2 | 4 | Detail archetype |
| `GuestKycVerificationTab` | 244 | 2 | 1 | |

### 6.4 Staff-facing

| Screen | Lines | p | s | What it needs |
|---|---|---|---|---|
| `HousekeepingDashboard` | 1037 | 3 | 10 | **10 hand-rolled `Card`s, 9 `.map()`s, 3 primitives.** Checklist rows → `ListRow`. Identity card already converted. 2 modals left |
| `(staff)/broadcast.tsx` | 835 | 4 | 33 | Dish picker + RSVP summary; 8 `.map()`s drawing their own rows |
| `(staff)/eaters.tsx` | 508 | 7 | 6 | Mostly done |
| `(staff)/kitchen.tsx` | 231 | 2 | 6 | Mostly done |

### 6.5 Owner long-tail

| Screen | Lines | p | s | What it needs |
|---|---|---|---|---|
| `OwnerServicesTab` | 519 | 13 | 51 | Half converted, 51 styles still hand-rolled |
| `ManagePropertiesScreen` | 548 | 4 | 17 | 7 hand-rolled `Card`s — a property list wanting `ListRow` |
| `UpiConfigSection` | 307 | 2 | 19 | Handle list → `ListRow` + `StatusChip` for the active one |
| `ProcurementScreen` | 639 | 10 | 11 | Mostly done; cart modal left |
| `ManageAdScreen`, `manager-provisioning`, `settings`, `upi-settings` | — | — | — | Small, unaudited |

### 6.6 Auth — 6 screens, never opened

`welcome` · `owner-login` · `staff-login` · `owner-register` · `reset-password` · `guest-join`

Validation is already inline (done in this pass). Layouts are untouched. `JoinPgScreen` (289)
and `SignInScreen` (268) are the substantial ones.

**These are the first thing anyone sees, and the last thing that got attention.**

---

## 6.7 Cross-cutting work — not tied to any one screen

These apply to **every** screen and are easy to miss because no single file owns them. None is
covered by a guard yet; each would be a good candidate for one once swept.

### Accessibility

`maxFontSizeMultiplier` is at 100% coverage on `<Text>` — that one is done. Two gaps remain:

- **12 icon-only buttons have no `accessibilityLabel`**, so a screen reader announces them as
  nothing at all. Find them with:
  ```bash
  # AnimatedPress whose only child is an Ionicons, with no label
  grep -rn -A2 "<AnimatedPress" app src --include='*.tsx' | grep -B1 "<Ionicons" | grep -v accessibilityLabel
  ```
  Known: `OwnerGuestsManagementTab` (3), `GuestFeedbackComplaintsTab` (2), `GuestSecurityTab`
  (2), `+not-found`, `HousekeepingDashboard`, `OwnerPaymentsTab`, `OwnerAnnouncementsTab`,
  `LocationField`.
- **Touch targets** must clear 48dp. `ListRow`/`PickerField` are 56 and fine; small icon
  buttons need `hitSlop` (42 files already use it — follow that pattern).
- State must never be **colour alone**. The nav bar's amber "work waiting" tint carries a
  numeral for exactly this reason — amber and green there sit at the same lightness (1.01:1),
  which is precisely the pair a red-green colour-blind reader cannot separate.

### Empty, loading and error states

`EmptyState` handles all three and they are **not interchangeable** — a query in flight, a
query that returned nothing, and a 403 are three different messages. Before this was fixed,
a permissions failure sat there looking like an answer, because the query client deliberately
doesn't retry a 4xx.

**Lists with no empty state today:** `OwnerComplaintsTab`, `GroceryWishlistScreen`,
`GroceriesScreen`, `ProductRow`, `MainBannerCarousel`.

### Copy conventions

The app is inconsistent — Title Case and sentence case sit side by side. Settle on **sentence
case** (it's what most of the redesigned screens already use) and normalise as you go.

Known stragglers: `View All`, `Add Photo`, `View Menu`, `View Details`, `View Cart`,
`Start Shopping`, `Sign Out`, `Taxable Value`.

Also: buttons are **verb-first and 1–3 words** ("Save changes", "Publish", "Reject payment"),
errors say what happened *and* what to do, and empty states are an invitation rather than an
apology.

### List performance

Several screens render potentially unbounded lists with `.map()` inside a `ScrollView`, which
mounts every row at once. Worst: `OwnerReviewsTab` (11 `.map()`s),
`PnLAnalyticsDetailScreen` (10), `HousekeepingDashboard` (9), `broadcast` (8).

A short fixed list is fine as `.map()`. Anything that grows with the property's data —
residents, payments, tickets, orders, products — wants `FlatList`.

### Responsive

15 files use `useResponsivePadding` / `useWindowDimensions`; the rest assume a phone. Not a
blocker, but a tablet currently gets phone-width content stretched across the screen.

### Dark mode — explicitly out of scope

There is **no** dark mode: zero `useColorScheme` usage, and the palette is a single light
theme with measured contrast. Do not half-add it. If it's ever wanted it is a deliberate
project — every one of the verified colour pairs needs a dark counterpart and
`colors.check.ts` needs to check both.

---

## 6.8 Production standards audit — what is missing, and what already isn't

Audited against what a shipped React Native app is expected to have. Three buckets.

### A. UX-facing gaps — these belong in the redesign

**1. No autofill or password-manager support anywhere.** `textContentType` and `autoComplete`
appear on **zero** fields in the app. Every login, registration, phone, OTP and address field
should carry them; without it, iOS won't offer the saved password, Android won't offer the SMS
code, and people retype things they shouldn't have to.

This is a `OutlinedTextField` change plus a pass over the auth screens:

```tsx
// password
textContentType="password"        autoComplete="current-password"
// new password
textContentType="newPassword"     autoComplete="new-password"
// phone
textContentType="telephoneNumber" autoComplete="tel"          keyboardType="phone-pad"
// email
textContentType="emailAddress"    autoComplete="email"        keyboardType="email-address"
// one-time code
textContentType="oneTimeCode"     autoComplete="sms-otp"
```

Do it once in the primitive as pass-through props, then apply per field. It pairs naturally
with 6.6 (auth), which is where most of the affected fields live.

**2. Images have no placeholder, no caching, no transition.** 24 files render RN's `<Image>`;
`expo-image` is not installed. Exactly **one** file handles `onError`. So every remote image —
KYC documents, property photos, dish images, ad banners — pops in when it arrives, shows
nothing while loading, and shows nothing at all if it fails.

`expo-image` gives a placeholder, a fade-in transition, memory/disk caching and a proper error
slot. It's a drop-in for most call sites. This is one of the most *visible* quality differences
in the whole list — image pop-in is the thing that reads as "unfinished" fastest.

The one place already handling this well is `KycDocumentsCard`, which tracks `idFailed` /
`selfieFailed` and falls back to a labelled empty box. Copy that behaviour, don't reinvent it.

**3. Offline is handled but never shown.** `apiClient` deals with connection failures, and four
screens mention offline in passing, but there is no app-level indication that you are offline.
A person on a bad connection sees a spinner or an error card and can't tell whether it's the
app, the property's data, or their signal.

The right surface for this is a **persistent strip**, not a toast (see 4.2b) — it's state that
lasts until it changes. `DockAlert` is the existing precedent for a thin strip above the nav.

### B. Already solid — do not "fix" these

Checked, and better than expected. Leave them alone:

- **Error boundary** — `AppErrorBoundary` is wired through Expo Router's own `ErrorBoundary`
  export convention in `app/_layout.tsx`, so a render error shows a real screen rather than a
  white one.
- **401 handling** — `apiClient` raises *typed* errors and notifies a registered handler rather
  than driving navigation itself, specifically so a 401 during a background refresh can't tear
  down the screen someone is typing into. Auth endpoints that answer 401 for bad credentials
  surface it to their own form instead of triggering session recovery. That's careful work.
- **Token storage** — `SecureStore`, not AsyncStorage.
- **Screen-capture guard** — active while KYC documents are on screen.
- **Keyboard avoidance** — `FormScroll` on both platforms, with the reasoning documented.
- **Safe areas** — runtime insets everywhere, no hardcoded platform guesses.
- **Orientation** — locked to portrait in `app.json`, which is right for this app.

### C. Engineering gaps — real, but outside a redesign's scope

Worth knowing; don't let them block UI work, and don't quietly take them on either.

- **No test framework at all.** No Jest, no Vitest, no component tests. The eight `.check.ts`
  guards plus `tsc` are the entire safety net. They're good at what they cover — pure logic,
  tokens, contrast, structural drift — and cover no rendering behaviour whatsoever.
- **No ESLint and no Prettier config.** Formatting consistency is by hand and by convention.
- **No crash reporting** (Sentry/Bugsnag). A crash in the wild is currently invisible.
- **No OTA update path** — `expo-updates` isn't configured, so every fix needs a store release.
- **No i18n.** Copy is English string literals throughout. Like dark mode, treat this as a
  deliberate scope decision rather than an oversight — but if the app ever needs another
  language, it is a project, not a pass.

---

## 6.9 Definition of done, per screen

A screen is finished when **all** of these are true:

- [ ] Style-block count is down near 20–30; the primitives own the layout
- [ ] Every list row is `ListRow` (a thing) or `MetricRow` (a number) — not a hand-rolled `Card`
- [ ] Every modal is `Sheet`, `Alert.alert`, or `TextPromptDialog` — or is in `EXEMPT` with a reason
- [ ] Every input is `OutlinedTextField` / `PickerField` / `ChoiceChips` / `SearchField`
- [ ] Every validation error is inline on its field, and clears as you type
- [ ] Every tappable thing is `AnimatedPress`, and icon-only ones have a label
- [ ] Lists have empty, loading **and** error states
- [ ] Feedback uses the right surface (4.2b) — inline for fields, toast for confirmations,
      alert for decisions, badge/strip for anything that persists
- [ ] No invented numbers, no fabricated deltas (rule 1.1)
- [ ] Copy is sentence case, buttons are verb-first
- [ ] Images have a placeholder and an error fallback (6.8 A2)
- [ ] Auth/contact fields carry `textContentType` + `autoComplete` (6.8 A1)
- [ ] At most **three** terracotta elements visible at once (4.7.2)
- [ ] Sections separated by 24–28px of space, not by a card or a border (4.7.3)
- [ ] Empty state is an invitation with an action, not an apology (4.7.4)
- [ ] At most one elevated surface on screen (4.7.5)
- [ ] **It passes the 4.6.9 test** — one clear hero, obvious primary action, nothing shouting
      without a reason, and something removed rather than added
- [ ] `tsc`, all guards, and the Android bundle pass
- [ ] Any ratchet budget you moved is lowered in the same commit

---

## 6.10 The honest gap: nothing has been run

**This entire redesign was verified by typecheck, guards and a successful bundle build. It has
not been opened on a device or emulator.**

That is a real limitation and you should treat it as one. Type-correct, guard-clean code that
builds can still lay out wrongly, clip at small widths, animate badly on a slow device, or put
a control under the Android gesture strip.

Before this is called finished, someone needs to walk every screen on a real device — ideally a
small Android phone with gesture navigation, which is where the safe-area and touch-target
problems show up first. Several bugs fixed during this work (a footer landing inside the
swipe-up strip; a dialog whose buttons were the only visible part) were exactly this class, and
were only found by reading code carefully rather than by seeing them.

## 7. Traps that cost real time here

- **`expo-router/ui` `Tabs` only walks `TabList`, Fragments and arrays** looking for triggers.
  It does not recurse into a `View`. A `.map()` is fine; wrapping triggers in a `View` makes
  them invisible and crashes with "Couldn't find any screens for the navigator".
- **`Dock` must stay a re-export of `TabList`**, never a wrapper — `isTabList()` compares by
  reference identity, and a wrapper silently breaks every trigger.
- **`{/* comment */}` inside `{cond && (`** is invalid — that's an expression slot, not JSX
  children. Put the comment above the conditional.
- **Style objects here close inline** (`color: CHARCOAL },`), so line-based regexes for finding
  dead styles match nothing. Use a brace counter.
- **`activeOpacity` is a transparency, not a transform.** See 2.5.
- **`Alert.prompt` is iOS-only.** See 2.9.
- **The guards need Node ≥ 22.18.** They execute `.ts` directly under plain `node`, which
  relies on native type stripping — added in 22.6 behind a flag, unflagged from 22.18. Node 20
  fails them with `ERR_UNKNOWN_FILE_EXTENSION`. The floor is declared in three places that must
  stay in step: `.nvmrc`, `engines` in `package.json`, and `node-version-file` in the CI
  workflow. If you change one, change all three — CI silently ran Node 20 against guards that
  needed 22 for exactly as long as nothing declared the requirement.
- **`react` and `react-dom` must match exactly** — `react-dom` is a transitive web-only
  dependency that CI's `npm ci` resolves strictly, so a skew breaks the build while local
  `node_modules` keeps working. Both pinned at `19.2.3` for Expo SDK 57.
- **`npx expo install --check`** currently reports ~13 packages behind their SDK-expected
  versions, including `react-native@0.86.2` vs `0.86.3`. Unrelated to the redesign; deserves
  its own deliberate pass.

---

## 8. What going wrong looks like

Concrete failure modes from this work, so you can catch yourself:

- **The screen got longer.** You wrapped instead of replacing. Re-read section 4.
- **It's consistent but flat.** You applied section 4 and skipped 4.6. Consistency is the floor,
  not the goal — there should be one thing your eye lands on.
- **Two heroes on one screen.** Then there are none. See 4.6.1.
- **You tinted something that doesn't mean anything.** Finish the sentence "this is tinted
  because…" or make it white.
- **You added a new tinted background** that doesn't carry meaning. See 2.2.
- **You wrote a `modalBackdrop` style.** You're rebuilding `Sheet`. See 4.3.
- **You converted a modal and the guard passed silently.** You forgot to lower the budget — the
  guard should have failed. If it didn't, you edited the budget without doing the work.
- **A form lost fields.** Your tail match crossed a `</ScrollView>`. Count against `HEAD`.
- **You "fixed" a `LinearGradient`.** Check first whether it's fading an image into the surface
  (keep) or a decorative hero banner (replace). Resident Home and Meals are the former.
- **You flattened a bespoke search.** The groceries hero search and category header both carry
  features `SearchField` doesn't have.
- **You reported deleting dead code that was already dead.** True, but not caused by you. Say
  which is which.
- **You used a toast to carry information the user must act on.** A toast is a confirmation,
  not a task. Anything that persists until acted on belongs in a badge or the nav strip.
- **You anchored a toast to the bottom**, or above the header. Both were bugs here — see 4.2b.
- **You can see more than three terracotta things at once.** The accent has become the new
  grey — exactly what happened to the ocean blue it replaced. See 4.7.2.
- **You separated sections with a card or a border.** Space does that. See 4.7.3.
- **You set `fontFamily` at a call site.** It belongs in `Txt`, once. See 4.7.1.
- **You added a shadow to something that already has a border.** Pick one. See 4.7.5.
- **You gave every screen its own illustration.** That's a zoo, not a design language.
- **You implemented before showing the design.** See 1.5.

---

## 9. Where the real documentation lives

**The code comments are the specification.** Every non-obvious decision is written down at the
point it applies, usually alongside the bug that motivated it. Before changing any primitive,
read its header comment — `Sheet`, `OutlinedTextField`, `PickerField`, `SearchField`,
`navTabs`, `AnimatedPress`, `CountUp` and every `*.check.ts` explain *why*, not just *what*.

If you disagree with one of those decisions, the comment usually tells you what breaks if you
reverse it. That is deliberate. Several were written after the mistake had already been made
once.
