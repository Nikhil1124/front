/**
 * Moved here from app/(auth)/owner-subscription.tsx — that group is only registered in the
 * root Stack when `!accessToken` (see app/_layout.tsx's Stack.Protected guards), so for any
 * actual signed-in owner/manager, the screen was completely unreachable: Settings' "Subscription
 * & Billing" row pushed to a route that didn't exist in the active navigator, the same silent-
 * failure class as the owner header bell's old '/notices' push. A root-level route like this
 * one is registered regardless of which role group is active, same fix as that bell.
 */
import { OwnerSubscriptionScreen } from '@/features/owner/OwnerSubscriptionScreen';

export default OwnerSubscriptionScreen;
