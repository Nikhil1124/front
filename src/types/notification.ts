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
}

export interface MealNotificationData {
  id: string;
  appLabel: string; // e.g. "MyPG" / "PGow"
  mealType: MealType;
  title: string; // e.g. "Today's Lunch is Ready!"
  chefName: string;
  menuItems: string[];
  createdAt: string; // ISO timestamp
  ad?: NotificationAd; // optional — card degrades gracefully without it
}

export type MealResponse = "eat" | "skip";

export interface MealResponsePayload {
  notificationId: string;
  mealType: MealType;
  response: MealResponse;
  respondedAt: string;
}
