// types/notification.ts
// Conceptual types for PGow notifications. Merge into your existing
// notification/data-model types file if one already exists.

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

export interface NotificationAd {
  id: string;
  brandName: string;
  tagline: string;
  ctaLabel?: string;
  imageUrl?: string; // brand logo / creative
  accentColor?: string; // brand's own color, falls back to a neutral tone
  deepLink?: string; // where CTA tap should navigate/open
  /** The sponsor's code, copied to the clipboard on tap. Carried over from the standalone
   *  ad card this one replaces: copying a code is a `coupon_copy` event, which is one of the
   *  three things `/v1/ads/metrics` counts and the owner is paid on. Dropping the mechanic
   *  would have quietly removed a revenue signal rather than moved it. */
  discountCode?: string;
  discountPercent?: number;
  /** The longer blurb. Carried over from the standalone ad card this slot replaced — the
   *  tagline sells, this explains. */
  description?: string;
  /** "Salads, Keto Plates". What a food sponsor is, in the words a resident scans for. */
  cuisines?: string;
  /** "12-18 min", shown on the banner. For a delivery sponsor it is the offer. */
  deliveryTime?: string;
}

export interface MealNotificationData {
  id: string;
  appLabel: string; // e.g. "MyPG" / "PGow"
  mealType: MealType;
  title: string; // e.g. "Today's Lunch is Ready!"
  chefName: string;
  menuItems: string[];
  createdAt: string; // ISO timestamp
  /** Chef-confirmed, never inferred from the menu text. Null renders no tag rather than a
   *  guess — in a shared kitchen this is the field a resident scans for first. */
  dietaryType?: 'veg' | 'non_veg' | 'pure_veg' | null;
  /** When it is served, "12:30". The hero this card replaced showed it, and it is the one
   *  fact a resident deciding whether to eat in actually needs. */
  serviceTime?: string;
  /** "Cut-off in 2h 15m", already formatted. Counted down from the server's
   *  `response_closes_at` — the value the backend enforces — not from a local guess. */
  cutoffLabel?: string;
  ad?: NotificationAd; // optional — card degrades gracefully without it
}

export type MealResponse = "eat" | "skip";

export interface MealResponsePayload {
  notificationId: string;
  mealType: MealType;
  response: MealResponse;
  respondedAt: string;
}
