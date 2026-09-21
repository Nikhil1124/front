// components/NotificationCard/MealAdNotificationCard.tsx
//
// Resident-facing meal notification card — finalized direction (image-banner
// ad, design "#03" from the exploration round), upgraded for Play Store /
// App Store compliance: the ad is a separately labeled, independently
// dismissible block below the Eat/Skip decision, and is never sent as part
// of the OS-level push notification itself (see formatPushNotificationBody
// at the bottom of this file).
//
// Usage:
//   <MealAdNotificationCard
//     data={notification}
//     onRespond={(payload) => mealResponseMutation.mutate(payload)}
//     onAdPress={(ad) => Linking.openURL(ad.deepLink)}
//     onAdDismiss={(ad) => adDismissMutation.mutate(ad.id)}
//   />
//
// Wire-in notes:
// - Swap the local `formatRelativeTime` for your existing date-utils if you have one.
// - Route onRespond/onAdDismiss through your React Query mutation -> service/API
//   layer (mock service now, real endpoint later) per the project's data-flow convention.
// - If you already have Button/Card/StatusBadge primitives, replace the raw
//   AnimatedPress/View here with those instead of duplicating styles.
// - Ad creative images should be provided pre-cropped to a ~16:6 ratio by
//   whatever ad source you integrate — the banner uses resizeMode="cover"
//   at a fixed 90px height, so mismatched aspect ratios will crop, not letterbox.

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
  AccessibilityInfo,
} from "react-native";
import {
  MealNotificationData,
  MealResponse,
  MealResponsePayload,
  NotificationAd,
} from "../../types/notification";
import { AnimatedPress } from "@/components/ui";
import { NotificationCardColors, Radii } from "@/theme";

// The card's palette, unchanged, but named in the theme rather than inline — see
// `NotificationCardColors` there for why it stays separate from `Colors`.
const COLORS = NotificationCardColors;

const MEAL_ICON: Record<MealNotificationData["mealType"], string> = {
  breakfast: "☕",
  lunch: "🍽️",
  dinner: "🌙",
  snacks: "🍪",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface AdSlotProps {
  ad: NotificationAd;
  onPress?: (ad: NotificationAd) => void;
  onDismiss?: (ad: NotificationAd) => void;
}

// Store-compliance notes (Google Play ads policy + App Store 4.5.4):
// - This slot is only ever rendered inside the IN-APP card, never inside the
//   OS-level push notification itself (see formatPushNotificationBody / the
//   integration note at the bottom of this file). Ads embedded directly in a
//   system notification are restricted unless the notification is an
//   integral app feature — a third-party ride/food ad is not, so it must
//   live here instead.
// - The "Ad · served by {brand}" label makes the source explicit, per Play
//   Store's requirement that "it must be clear to the user which app/entity
//   is serving each ad."
// - The ad has its own independent close control (onDismiss), separate from
//   the Eat/Skip buttons, so it can never be mistaken for part of the meal
//   decision and is always dismissible without side effects (disruptive-ads
//   policy: never force interaction with an ad to use the app).
const AdSlot: React.FC<AdSlotProps> = ({ ad, onPress, onDismiss }) => {
  return (
    <View style={styles.adWrap}>
      <View style={styles.adHeaderRow}>
        <Text style={styles.adLabel} numberOfLines={1}>
          Ad · served by {ad.brandName}
        </Text>
        {onDismiss ? (
          <AnimatedPress
            onPress={() => onDismiss(ad)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss ad"
          >
            <Text style={styles.adDismissGlyph}>✕</Text>
          </AnimatedPress>
        ) : null}
      </View>

      <AnimatedPress
        onPress={() => onPress?.(ad)}
        accessibilityRole="button"
        accessibilityLabel={`Advertisement from ${ad.brandName}: ${ad.tagline}`}
        style={styles.adCard}
      >
        {ad.imageUrl ? (
          <Image
            source={{ uri: ad.imageUrl }}
            style={styles.adBanner}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.adBanner,
              styles.adBannerFallback,
              { backgroundColor: ad.accentColor ?? COLORS.neutralBg },
            ]}
          >
            <Text style={styles.adBrandFallback} numberOfLines={1}>
              {ad.brandName}
            </Text>
          </View>
        )}
        <View style={styles.adFooterRow}>
          <View style={styles.adFooterText}>
            <Text style={styles.adBrandName} numberOfLines={1}>
              {ad.brandName}
            </Text>
            <Text style={styles.adTagline} numberOfLines={2}>
              {ad.tagline}
            </Text>
          </View>
          {ad.ctaLabel ? (
            <View style={styles.adCtaPill}>
              <Text style={styles.adCtaText}>{ad.ctaLabel}</Text>
            </View>
          ) : null}
        </View>
      </AnimatedPress>
    </View>
  );
};

export interface MealAdNotificationCardProps {
  data: MealNotificationData;
  onRespond?: (payload: MealResponsePayload) => void;
  onAdPress?: (ad: NotificationAd) => void;
  /** Called when the resident dismisses the ad specifically (not the whole card). */
  onAdDismiss?: (ad: NotificationAd) => void;
  /** Called when the card is tapped outside the action buttons (e.g. expand/navigate) */
  onPress?: () => void;
}

export const MealAdNotificationCard: React.FC<MealAdNotificationCardProps> = ({
  data,
  onRespond,
  onAdPress,
  onAdDismiss,
  onPress,
}) => {
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const [responded, setResponded] = useState<MealResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [adDismissed, setAdDismissed] = useState(false);

  const handleRespond = useCallback(
    async (response: MealResponse) => {
      if (submitting || responded) return;
      setSubmitting(true);
      try {
        const payload: MealResponsePayload = {
          notificationId: data.id,
          mealType: data.mealType,
          response,
          respondedAt: new Date().toISOString(),
        };
        onRespond?.(payload);
        setResponded(response);
        AccessibilityInfo.announceForAccessibility?.(
          response === "eat" ? "Marked as eating" : "Meal skipped"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [data.id, data.mealType, onRespond, responded, submitting]
  );

  return (
    <AnimatedPress
      onPress={onPress}
      disabled={!onPress}
      style={styles.card}
      accessibilityRole={onPress ? "button" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.appIconWrap}>
          <Text style={styles.appIconGlyph}>🏠</Text>
        </View>
        <Text style={styles.appLabel}>{data.appLabel}</Text>
        <Text style={styles.timestamp}>{formatRelativeTime(data.createdAt)}</Text>
      </View>

      {/* Meal body */}
      <View style={styles.body}>
        <Text style={styles.mealEmoji}>{MEAL_ICON[data.mealType]}</Text>
        <View style={styles.mealTextBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {data.title}
          </Text>
          <Text style={styles.chefLine}>By {data.chefName}</Text>
        </View>
      </View>

      <Text style={styles.foodItemsLine} numberOfLines={1} ellipsizeMode="tail">
        {data.menuItems.join(" • ")}
      </Text>

      {/* Actions come before the ad — the meal decision is the primary task
          and must never be pushed down or blocked by ad content. */}
      {responded ? (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor:
                responded === "eat" ? COLORS.successBg : COLORS.neutralBg,
            },
          ]}
        >
          <Text
            style={[
              styles.statusBannerText,
              { color: responded === "eat" ? COLORS.success : COLORS.textSecondary },
            ]}
          >
            {responded === "eat" ? "✓ You're eating this meal" : "Meal skipped"}
          </Text>
        </View>
      ) : (
        <View style={[styles.actionRow, isCompact && styles.actionRowCompact]}>
          <AnimatedPress
            style={[styles.actionBtn, styles.eatBtn]}
            onPress={() => handleRespond("eat")}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Eat this meal"
          >
            <Text style={styles.eatBtnText}>🍴  Eat</Text>
          </AnimatedPress>
          <AnimatedPress
            style={[styles.actionBtn, styles.skipBtn]}
            onPress={() => handleRespond("skip")}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Skip this meal"
          >
            <Text style={styles.skipBtnText}>✕  Skip</Text>
          </AnimatedPress>
        </View>
      )}

      {/* Ad slot — separated below a divider, independently dismissible.
          Never rendered inside an OS push notification, only here. */}
      {data.ad && !adDismissed ? (
        <>
          <View style={styles.adDivider} />
          <AdSlot
            ad={data.ad}
            onPress={onAdPress}
            onDismiss={(ad) => {
              setAdDismissed(true);
              onAdDismiss?.(ad);
            }}
          />
        </>
      ) : null}
    </AnimatedPress>
  );
};

// --- Push-notification payload helper -----------------------------------
// Use this when building the actual OS-level push (e.g. via Expo
// Notifications / FCM / APNs). The system notification itself must stay
// ad-free and text-only — see the compliance notes above the AdSlot
// component. The ad only ever renders once the resident opens the app.
export function formatPushNotificationBody(data: MealNotificationData): {
  title: string;
  body: string;
} {
  return {
    title: data.appLabel,
    body: data.title, // e.g. "Today's lunch is ready" — no ad content, no image
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: Radii.card,      // was 20
    padding: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  appIconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radii.badge,     // was 8
    backgroundColor: COLORS.successBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  appIconGlyph: { fontSize: 14 },
  appLabel: {
    fontWeight: "700",
    fontSize: 14,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  timestamp: {
    marginLeft: "auto",
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  body: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  mealEmoji: { fontSize: 22, marginRight: 10, marginTop: 2 },
  mealTextBlock: { flex: 1 },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  chefLine: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  foodItemsLine: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  adDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
    marginTop: 2,
  },
  adWrap: {
    marginBottom: 2,
  },
  adHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  adLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  adDismissGlyph: {
    marginLeft: "auto",
    fontSize: 13,
    color: COLORS.textTertiary,
    paddingLeft: 12,
  },
  adCard: {
    borderRadius: Radii.control,   // was 14
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  adBanner: {
    width: "100%",
    height: 90,
  },
  adBannerFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  adBrandFallback: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  adFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: COLORS.surface,
  },
  adFooterText: { flex: 1 },
  adBrandName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  adTagline: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  adCtaPill: {
    alignSelf: "center",
    backgroundColor: COLORS.textPrimary,
    borderRadius: Radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  adCtaText: {
    color: COLORS.surface,
    fontSize: 12,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionRowCompact: {
    flexDirection: "column",
  },
  actionBtn: {
    flex: 1,
    minHeight: 44, // touch-friendly
    borderRadius: Radii.control,   // was 12
    alignItems: "center",
    justifyContent: "center",
  },
  eatBtn: { backgroundColor: COLORS.success },
  eatBtnText: { color: COLORS.surface, fontWeight: "700", fontSize: 15 },
  skipBtn: { backgroundColor: COLORS.neutralBg },
  skipBtnText: { color: COLORS.textSecondary, fontWeight: "700", fontSize: 15 },
  statusBanner: {
    borderRadius: Radii.control,   // was 12
    paddingVertical: 10,
    alignItems: "center",
  },
  statusBannerText: { fontWeight: "700", fontSize: 14 },
});

export default MealAdNotificationCard;
