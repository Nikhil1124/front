import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../data/apiClient";
import { uploadToPresignedUrl } from "../kyc/useKyc";

export interface TripStop {
  id: string;
  order_id: string;
  order_no: string;
  sequence: number;
  status: "pending" | "completed" | "failed" | string;
  eta_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  proof_photo_url: string | null;
  pg_name: string;
  pg_address: string;
  recipient_name: string;
  recipient_phone: string;
  item_count: number;
}

export interface Trip {
  id: string;
  trip_no: string;
  warehouse_id: string;
  vehicle_label: string;
  driver_name: string;
  driver_phone: string;
  status: "planned" | "active" | "completed" | string;
  planned_departure_at: string | null;
  departed_at: string | null;
  completed_at: string | null;
  route_generated_at: string | null;
  stops: TripStop[];
}

export function fetchMyTrips(): Promise<Trip[]> {
  return apiFetch<Trip[]>("/v1/supply/trips/mine");
}

export function departTrip(tripId: string): Promise<Trip> {
  return apiFetch<Trip>(`/v1/supply/trips/${tripId}/depart`, {
    method: "POST",
  });
}

export function getStopPhotoUploadUrl(
  tripId: string,
  orderId: string
): Promise<{ upload_url: string; object_key: string }> {
  return apiFetch<{ upload_url: string; object_key: string }>(
    `/v1/supply/trips/${tripId}/stops/${orderId}/photo-upload-url`,
    {
      method: "POST",
      body: JSON.stringify({ content_type: "image/jpeg" }),
    }
  );
}

export function completeStop(
  tripId: string,
  orderId: string,
  params: { outcome: "delivered" | "failed"; note?: string; proof_photo_key?: string | null }
): Promise<Trip> {
  return apiFetch<Trip>(`/v1/supply/trips/${tripId}/stops/${orderId}/complete`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function useMyTripsQuery() {
  return useQuery<Trip[]>({
    queryKey: ["supply", "trips", "mine"],
    queryFn: fetchMyTrips,
  });
}

export function useDepartTripMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: departTrip,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supply", "trips", "mine"] });
    },
  });
}

export function useCompleteStopMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      orderId,
      params,
    }: {
      tripId: string;
      orderId: string;
      params: { outcome: "delivered" | "failed"; note?: string; proof_photo_key?: string | null };
    }) => completeStop(tripId, orderId, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supply", "trips", "mine"] });
    },
  });
}

export { uploadToPresignedUrl };
