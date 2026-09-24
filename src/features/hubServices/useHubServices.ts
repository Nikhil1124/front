import { useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/data/apiClient';
import { qk } from '@/data/queryKeys';
import { API } from '@/config';

/**
 * The service tiles on Home and in Hub Services, from PGow's catalog (`/v1/hub-services`).
 * A super admin adds, reorders and removes them in the portal; they used to be hard-coded
 * here, so every change meant a new build.
 */
export type HubServiceAction = 'groceries' | 'laundry' | 'support' | 'request';

export interface HubService {
  id: string;
  title: string;
  subtitle: string;
  action: HubServiceAction;
  routes_to: 'property' | 'pgow' | null;
  /** An uploaded picture, or null — then the picture this app ships for `action`. */
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

/** The pictures the service tiles have always had. The portal shows the same files. */
const SHIPPED_IMAGE: Partial<Record<HubServiceAction, ImageSourcePropType>> = {
  groceries: require('../../../assets/Quick Actions/Owner/grocery.png'),
  laundry: require('../../../assets/Quick Actions/Resident/laundry_nobg.png'),
  support: require('../../../assets/Quick Actions/Owner/04_complaints.png'),
};

export function serviceImage(s: HubService): ImageSourcePropType | null {
  return s.image_url ? { uri: s.image_url } : SHIPPED_IMAGE[s.action] ?? null;
}

/** Shown until the catalog loads, and if it cannot — the three services the app always had,
 *  so Home is never an empty grid because of a slow network. */
const BUILT_IN: HubService[] = [
  { id: 'built-in-groceries', title: 'Groceries', subtitle: 'Your daily needs, just a tap away', action: 'groceries', routes_to: null, image_url: null, sort_order: 10, is_active: true },
  { id: 'built-in-laundry', title: 'Laundry', subtitle: 'Wash & fold · Wash & iron', action: 'laundry', routes_to: null, image_url: null, sort_order: 20, is_active: true },
  { id: 'built-in-support', title: 'Support', subtitle: 'Report an issue or request', action: 'support', routes_to: null, image_url: null, sort_order: 30, is_active: true },
];

export function useHubServices(): HubService[] {
  const { data } = useQuery({
    queryKey: ['hub-services'],
    queryFn: () => apiFetch<HubService[]>(API.HUB_SERVICES),
    staleTime: 5 * 60_000,
  });
  return data ?? BUILT_IN;
}

/** What a tap on a tile does. The built-in flows open their own screens; a `request` service
 *  opens the request sheet, which the caller renders (see `ServiceRequestSheet`). */
export function useServiceTap() {
  const [requesting, setRequesting] = useState<HubService | null>(null);
  const open = (s: HubService) => {
    if (s.action === 'groceries') router.push('/groceries');
    else if (s.action === 'laundry') router.push('/laundry');
    else if (s.action === 'support') router.push('/support');
    else setRequesting(s);
  };
  return { open, requesting, close: () => setRequesting(null) };
}

export function useRequestHubServiceMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, note }: { serviceId: string; note: string }) =>
      apiFetch(API.HUB_SERVICE_REQUEST(serviceId), {
        method: 'POST',
        body: JSON.stringify({ pg_id: pgId, note }),
      }),
    onSuccess: () => {
      if (pgId) qc.invalidateQueries({ queryKey: qk.requests.all(pgId) });
    },
  });
}
