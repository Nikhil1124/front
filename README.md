# PGow — React Native (Expo + TypeScript)

A comprehensive, pixel-perfect React Native port of the native Android Kotlin app `PGow`, heavily expanded to include a full-scale Groceries module, modern file-based routing, and a deeply polished edge-to-edge UI.

## What's inside

- **Expo Router Architecture**: Fully utilizes file-based routing (`app/` directory) for clean navigation handling, replacing traditional `React Navigation` stacks.
- **Three Core User Roles**: 
  - **PG Owner**: Multi-PG Portfolio management, Staff Management, UPI Config, PnL Analytics, Guest Management, and Announcements.
  - **PG Guest**: Hub Services (Laundry, Repair), Rent Payments, KYC Verification, RSVPs, and Feedback.
  - **Staff / Chef**: Meal notifications, attendance, and direct grocery requesting.
- **Groceries Module (New)**: A robust e-commerce module for ordering kitchen supplies. Includes Product Listings, Cart Management, Checkout with time slots and delivery tracking, and Order History.
- **Edge-to-Edge UI**: True full-screen mode that beautifully fills the hardware notch on modern devices (iOS and Android), dynamically adapting header paddings using safe area insets.
- **Zustand State Management**: Lightweight, fast global state management replacing complex context providers.
- **AsyncStorage-Backed DB**: Complete local persistence mirroring a robust Room database for mock endpoints (Guests, Payments, Feedback, Analytics, etc).
- **Gemini & Firebase Integrations**: Scaffolded sandbox modes for AI queries and cloud syncing.

## Project Layout

```text
PGow-Frontend/
├── .expo/                  # Expo build artifacts and cache
├── .git/                   # Git repository data
├── android/                # Native Android build files
├── app/                    # Expo Router file-based routing (Auth, Tabs, etc.)
│   ├── (auth)/             # Login and Registration flows
│   ├── (guest)/            # Guest dashboard and tabs
│   ├── (owner)/            # Owner dashboard and tabs
│   └── _layout.tsx         # Root layout configuration
├── assets/                 # Images, fonts, and static resources
├── src/                    # Core source code
│   ├── components/         # Shared UI components (Cards, Buttons, Inputs, Dialogs)
│   ├── data/               # Mocks, local DB logic, and initial seeding
│   ├── features/           # Feature-based domains (Massive modular structure)
│   │   ├── groceries/      # Grocery shopping flow (Screens, Components, Store)
│   │   ├── owner/          # Owner-specific screens and tabs
│   │   ├── guest/          # Guest-specific screens and tabs
│   │   ├── staff/          # Staff-specific screens
│   │   ├── payments/       # Billing and UPI configurations
│   │   └── ...             # 15+ other micro-features (KYC, Meals, Analytics)
│   ├── store/              # Zustand global state (Auth, UI, Shopping Cart)
│   ├── theme/              # Color tokens and Typography (exact hex matches)
│   ├── types/              # Global TypeScript interfaces
│   └── utils/              # Formatting and generic helper functions
├── app.json                # Expo configuration (Status bar, orientation, icons)
└── package.json            # Dependencies and scripts
```

## Build Verification

The project builds successfully with the Metro bundler using Expo CLI.

```bash
npm install
npx expo export --platform android  # Export for Android
npx expo export --platform ios      # Export for iOS
npx tsc --noEmit                    # TypeScript type check
```

## Running the App

```bash
npm install
npm start
```

Then scan the QR code with the **Expo Go** app on your phone, or press `a` (Android) / `i` (iOS) in the terminal to launch on a running emulator.

## Demo Credentials

You can bypass normal authentication flows using these mock credentials to explore the different app states:

- **Owner**: `d.anilkumard01@gmail.com` / `demo123`
- **Manager**: `d.anilkumard01@gmail.com` (or any PG name) / PIN `5678`
- **Staff / Chef**: `d.anilkumard01@gmail.com` / PIN `1234`
- **Resident**: `rohan@gmail.com` / `9888877771`

> **Pro-tip**: Just tap the **Instant Demo PG Simulator** card on the Welcome screen to launch directly into the Owner dashboard with all mock data pre-seeded!

## Color Tokens

The UI is built on a specific dark-mode-first luxury aesthetic. 

| Token Name          | Hex       | Usage            |
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
