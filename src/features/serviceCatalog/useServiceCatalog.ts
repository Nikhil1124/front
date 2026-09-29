/**
 * The services an owner books from PGow (`/v1/service-catalog`) — plumbing, AC service, deep
 * cleaning. A super admin keeps them in the portal: names, sections, visit fees, pictures. They
 * used to be a constant in OwnerServicesTab, so every change meant a new build.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/data/apiClient';
import { qk } from '@/data/queryKeys';
import { API } from '@/config';

export interface CatalogService {
  id: string;
  section: string;
  name: string;
  description: string;
  /** Decimal from the server, as a string ("149.00"). */
  visit_fee: string;
  problems: string[];
  includes: string[];
  /** An uploaded picture, or null — then `builtin_image`, one of the pictures this app ships. */
  image_url: string | null;
  builtin_image: string | null;
  sort_order: number;
}

export function useServiceCatalog() {
  return useQuery({
    queryKey: ['service-catalog'],
    queryFn: () => apiFetch<CatalogService[]>(API.SERVICE_CATALOG),
    staleTime: 5 * 60_000,
  });
}

/** Sections in the order of their first service, as the super admin arranged them. */
export function bySection(services: CatalogService[]): [string, CatalogService[]][] {
  const groups = new Map<string, CatalogService[]>();
  for (const s of services) groups.set(s.section, [...(groups.get(s.section) ?? []), s]);
  return [...groups.entries()];
}

/**
 * Book one for the property. It goes straight to PGow's technician for the area and is
 * priced from the catalog server-side — the app sends no amount.
 */
export function useBookServiceMutation(pgId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, note }: { serviceId: string; note: string }) =>
      apiFetch(API.SERVICE_CATALOG_BOOK(serviceId), {
        method: 'POST',
        body: JSON.stringify({ pg_id: pgId, note }),
      }),
    onSuccess: () => {
      if (pgId) qc.invalidateQueries({ queryKey: qk.requests.all(pgId) });
    },
  });
}
