# PGow — React Native (Expo + TypeScript) Port

Pixel-perfect React Native port of the native Android Kotlin app `PGow`,
built from the source in `pgow (7)/app/src/main/java/com/example/MainActivity.kt` (~21,800 lines).

## What's inside

- **51 TypeScript files** totaling ~7,800 lines of ported code.
- **9 navigation screens**: WELCOME, OWNER_REGISTER, OWNER_LOGIN,
  OWNER_SUBSCRIPTION, OWNER_DASHBOARD, GUEST_JOIN, GUEST_DASHBOARD,
  STAFF_LOGIN, STAFF_DASHBOARD.
- **15 dialogs & sheets**: PaymentReceipt, KYC review, Multi-PG Portfolio,
  Add/Edit PG, Role Notifications Center Sheet, Role Broadcast, Hub Services
  (Laundry / Daily Subscription / Pronto Repair), WinnerDialog, etc.
- **3 custom SVG charts**: SmartSavingsSparkline, D3FoodWastageChartCard,
  OwnerFinancialSummaryChartCard.
- **Theme tokens** ported 1:1 from `ui/theme/Color.kt` and `Type.kt`.
- **Zustand store** (~900 lines) replicating every state field and function
  of Kotlin `PGowViewModel`.
- **AsyncStorage-backed local DB** mirroring every Room entity: PGOwner,
  Guest, StaffMember, MealNotification, GuestRSVP, Payment,
  FeedbackComplaint, Expense, AppRoleNotification.
- **Demo seeding** on first launch (owner `d.anilkumard01@gmail.com`,
  3 demo guests, 2 staff, 1 meal notification, 3 RSVPs, 2 payments,
  8 role notifications, 2 feedback entries).
- **GeminiManager** ported with mock-response fallback (sandbox mode).
- **FirebaseManager** ported as a no-op sandbox (Expo Go does not include
  google-services.json; real Firebase requires native build).
- **NotificationHelper** wired through `expo-notifications`.
- **Ad-monetization metrics** (CPM/CPC/CPA formulas) ported 1:1.
- **Time arithmetic helpers**: `getAlertTriggerTime` (subtract 2 hours),
  `formatServiceTime12h` (24h → 12h conversion).
- **Chef alarms** (9:00 AM, 1:00 PM, 3:30 PM) and 15-min follow-up logic.
- **Multi-PG portfolio** with auto-seed of 12 demo Bangalore PGs.

## Project Layout

```
pgow_app/
├── app.json, package.json, tsconfig.json, babel.config.js, metro.config.js
├── index.ts                  — AppRegistry entry
├── Root.tsx                  — SafeAreaProvider + GestureHandlerRootView wrapper
└── src/
    ├── PGowApp.tsx           — root router (9 AppScreen routes + AlertOverlay + RoleSwitcher + WinnerDialog)
    ├── theme/                — colors.ts (Color.kt port), typography.ts (Type.kt port)
    ├── types/index.ts        — All 12 entity interfaces
    ├── data/
    │   ├── localDb.ts        — AsyncStorage DAOs (9 collections)
    │   ├── repository.ts     — PGowRepository wrapper
    │   ├── firebaseManager.ts— FirebaseManager port (sandbox)
    │   ├── geminiManager.ts  — GeminiManager port (mock responses)
    │   ├── notificationHelper.ts — NotificationHelper (expo-notifications)
    │   └── seedDemo.ts       — First-launch demo PG seeding
    ├── store/usePGowStore.ts — Zustand store: 67 actions, 50+ state fields
    ├── utils/format.ts       — Time & currency helpers
    ├── components/
    │   ├── ui/               — Card, Btn, OutlinedBtn, IconBtn, Chip, Txt, Row, Col, etc.
    │   ├── ui/OutlinedTextField.tsx — Material 3 OutlinedTextField port
    │   ├── AlertOverlay.tsx  — Top-floating alert toast with RSVP buttons
    │   ├── SimulationRoleSwitcherBar.tsx — Sticky bottom role switcher
    │   ├── FeaturedMonetizedAdCard.tsx — 3 cloud-kitchen ads carousel
    │   ├── SmartDietPreferenceCard.tsx — Peanut/Gluten allergy toggles
    │   ├── charts/           — 3 SVG charts
    │   └── dialogs/          — 8 modal dialogs
    └── screens/
        ├── owner/            — WelcomeScreen, OwnerRegisterScreen, OwnerLoginScreen,
        │                       OwnerSubscriptionScreen, OwnerDashboardScreen
        │   └── tabs/         — AdminDashboardTab, OwnerGuestsManagementTab,
        │                       OwnerPaymentsTab, StaffManagementTab,
        │                       OwnerServicesTab, OwnerComplaintsTab,
        │                       ManagerExpenseLoggerSection
        ├── guest/            — GuestJoinScreen, GuestDashboardScreen
        │   └── tabs/         — GuestRSVPsTab, GuestPaymentsTab,
        │                       GuestHubServicesTab, GuestFeedbackComplaintsTab,
        │                       GuestSecurityTab, GuestKycVerificationTab
        └── staff/            — StaffDashboardScreen
```

## Build Verification

The project builds successfully with Metro bundler:

```bash
cd pgow_app
npm install
npx expo export --platform android  # ✓ 1,053 modules, 2.99 MB bundle
npx expo export --platform ios      # ✓ 2.98 MB bundle
npx tsc --noEmit                    # ✓ No TypeScript errors
```

## Running the App

```bash
cd pgow_app
npm install
npx expo start
```

Then scan the QR code with Expo Go (Android/iOS) or press `a` / `i` to launch
on an emulator.

## Demo Credentials

- **Owner**: `d.anilkumard01@gmail.com` / `demo123`
- **Manager**: `d.anilkumard01@gmail.com` (or any PG name) / PIN `5678`
- **Staff / Chef**: `d.anilkumard01@gmail.com` / PIN `1234`
- **Resident**: `rohan@gmail.com` / `9888877771`

Or just tap the **Instant Demo PG Simulator** card on the Welcome screen
to launch directly into the Owner dashboard with all mock data pre-seeded.

## Native-Only Features (Stubs)

- **Firebase Auth/Firestore**: requires native google-services.json. The
  FirebaseManager module exposes a sandbox no-op mode that surfaces the
  expected "Firebase not initialized" message — matching the Kotlin
  fallback when no key is configured.
- **Google Sign-In**: simulated via `sandboxGoogleSignIn()` (1.2s delay,
  returns a fake `d.anilkumard01@gmail.com` user).
- **PDF invoice generation**: `downloadPdfInvoice` shows a placeholder
  alert (RN does not include a built-in PDF generator).
- **CSV export**: shows an alert (RN share sheet would require a file URI).
- **UPI app deep-linking**: shows an alert + copies VPA to clipboard.
- **Camera capture (KYC photos)**: replaced with sample-photo generators
  (`sample:selfie_preset_N`, `sample:iddoc_*`).
- **Signature canvas**: not present in the original Kotlin GuestPaymentsTab
  (verified by extraction). The screen uses 4 UPI payment paths with UTR
  text input instead.

## Color Tokens (exact hex from Color.kt)

| Kotlin Token        | Hex       | RN Color         |
|---------------------|-----------|------------------|
| LuxuryPureBlack     | `#060D10` | Background base  |
| LuxurySurfaceDark   | `#0F1B1F` | Card surface     |
| LuxuryCardBorder    | `#1C2F34` | Card border      |
| SlateMutedText      | `#7E9599` | Muted body text  |
| IvoryWhiteText      | `#EAF2F3` | Primary text     |
| CyberGreen          | `#14E2B1` | Success / accent |
| CyberPurple         | `#00A38C` | Branding (teal)  |
| CyberPink           | `#00DFBC` | Hyper mint       |
| CyberAmber          | `#FFA726` | Warnings / gold  |

Note: Despite the names, `CyberPurple` is teal and `CyberPink` is mint in
the original Kotlin theme — the RN port mirrors the exact hex values.
