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
  ad?: NotificationAd; // optional — card degrades gracefully without it
}

export type MealResponse = "eat" | "skip";

export interface MealResponsePayload {
  notificationId: string;
  mealType: MealType;
  response: MealResponse;
  respondedAt: string;
}
