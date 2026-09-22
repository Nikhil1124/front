/**
 * Today's announced meals, each carrying the property's sponsor.
 *
 * Both halves are real and both already existed; nothing here is new server work. The meal
 * comes from `GET /v1/meals?pg_id=` (which now names the chef — `created_by` is a membership
 * id and no reader can resolve one), and the sponsor from `GET /v1/ads/config?pg_id=`, which
 * any member may read precisely because this card is what it is for.
 *
 * This file used to return a hardcoded array with a Rapido ad in it, and `respondToMeal` and
 * `dismissAd` were `console.log`. The card rendered, the buttons did nothing, and the ad
 * `ManageAdScreen` lets an owner configure was shown to nobody — which is also why
 * `/v1/ads/metrics` had nothing to report.
 *
 * Composed on the client rather than served as one endpoint: both calls are ones the app
 * already makes, and joining them here costs a `useMemo` instead of a route.
 */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listMeals, submitResponse } from '../meals/useMeals';
import { useNotificationAdQuery, recordAdEvent } from '../ads/useAds';
import { useAuthStore } from '../../store/authStore';
import { MealNotificationData, MealResponsePayload } from '../../types/notification';

/** A meal is "today's" by its service time in the device's own timezone — the resident's
 *  question is "what is for lunch today", asked where they are standing. */
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function useMealAdNotificationsQuery() {
  const pgId = useAuthStore((s) => s.activePgId);
  // PGow's own, rotated server-side — not the property owner's, which is a banner on the
  // meals tab and a different advertiser's money.
  const { data: ad } = useNotificationAdQuery();

  const meals = useQuery({
    queryKey: ['mealAdNotifications', pgId],
    queryFn: () => listMeals(pgId as string, { limit: 20 }),
    enabled: !!pgId,
  });

  const data = useMemo<MealNotificationData[]>(() => {
    const items = meals.data?.items ?? [];
    return items
      // A draft is a meal only its author has seen, and a card for one would announce it.
      .filter((m) => m.is_broadcast && isToday(m.service_at))
      .map((m) => ({
        id: m.id,
        appLabel: 'PGow',
        mealType: m.meal_type,
        title: `Today's ${m.meal_type[0].toUpperCase()}${m.meal_type.slice(1)} is ready!`,
        chefName: m.chef_name ?? 'The kitchen',
        // `menu_items` is one string server-side; the card wants the dishes.
        menuItems: m.menu_items.split(',').map((s) => s.trim()).filter(Boolean),
        createdAt: m.service_at,
        // No ad configured is the render-nothing signal, and the card already degrades
        // without one — so this stays undefined rather than inventing a house ad.
        ad: ad
          ? {
              id: ad.id,
              brandName: ad.brand_name,
              tagline: ad.tagline,
              ctaLabel: ad.cta_label || undefined,
              imageUrl: ad.image_url ?? undefined,
              accentColor: ad.accent_color ?? undefined,
              deepLink: ad.online_url ?? undefined,
              discountCode: ad.discount_code || undefined,
              discountPercent: ad.discount_percent || undefined,
              description: ad.description || undefined,
              cuisines: ad.cuisines || undefined,
              deliveryTime: ad.delivery_time || undefined,
            }
          : undefined,
      }));
  }, [meals.data, ad]);

  return { ...meals, data };
}

export function useMealAdRespondMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MealResponsePayload) =>
      submitResponse(payload.notificationId, payload.response === 'eat' ? 'eating' : 'skipping'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealAdNotifications'] });
    },
  });
}

/**
 * The three things the owner is actually paid on.
 *
 * `/v1/ads/metrics` counts impressions, clicks and coupon copies, and this card replaced the
 * one that reported all three — so all three have to keep arriving, or the owner's revenue
 * line falls for a reason that has nothing to do with residents.
 *
 * Fire-and-forget, matching `recordAdEvent`'s own contract: a failed metric must never
 * interrupt what the resident was doing, least of all their RSVP.
 *
 * Dismissal is deliberately not among them. There is no per-resident state for "I closed
 * this card", and a table to hold it would be storing the fact that somebody scrolled past
 * an advert. The card hides its own slot locally, and that is the whole feature.
 */
export function useAdReporter() {
  const pgId = useAuthStore((s) => s.activePgId);
  return (eventType: 'impression' | 'click' | 'coupon_copy', adRef: string) => {
    if (pgId) void recordAdEvent(pgId, eventType, adRef).catch(() => {});
  };
}
