import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/data/apiClient';
import { API } from '@/config';
import { uploadToPresignedUrl } from '@/features/kyc/useKyc';
import type { SupplyTrip } from '@/types/supply';

const MINE_KEY = ['supply_trips_mine'];

/** Every trip assigned to this agent, any status — filtering to "today's active run" is the
 *  screen's job, not the query's. */
export function useMyTripsQuery() {
  return useQuery<SupplyTrip[]>({
    queryKey: MINE_KEY,
    queryFn: () => apiFetch(API.SUPPLY_TRIPS_MINE),
    refetchInterval: 15000,
  });
}

export interface CompleteStopParams {
  tripId: string;
  orderId: string;
  outcome: 'delivered' | 'failed';
  note?: string;
  proofPhotoKey?: string;
}

export function useCompleteStopMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, orderId, outcome, note, proofPhotoKey }: CompleteStopParams) =>
      apiFetch<SupplyTrip>(API.SUPPLY_TRIP_STOP_COMPLETE(tripId, orderId), {
        method: 'POST',
        body: JSON.stringify({ outcome, note, proof_photo_key: proofPhotoKey }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MINE_KEY });
    },
  });
}

/** Step 1 of the two-step proof-of-delivery upload: presign, then PUT the captured photo's
 *  bytes straight to S3 (D-07 — never through our own server). Returns the object key
 *  `useCompleteStopMutation` needs as `proofPhotoKey`. */
export async function uploadStopProofPhoto(
  tripId: string,
  orderId: string,
  fileUri: string,
  contentType = 'image/jpeg'
): Promise<string> {
  const { upload_url, object_key } = await apiFetch<{ upload_url: string; object_key: string }>(
    API.SUPPLY_TRIP_STOP_PHOTO_UPLOAD_URL(tripId, orderId),
    { method: 'POST', body: JSON.stringify({ content_type: contentType }) }
  );
  await uploadToPresignedUrl(upload_url, fileUri, contentType);
  return object_key;
}
