import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { API } from "../../config";

export interface KycRecord {
  id: string;
  pg_id: string;
  membership_id: string;
  status: "pending" | "verified" | "rejected";
  reject_reason: string | null;
  submitted_at: string;
  decided_at: string | null;
  /** Short-lived — re-fetch the record rather than caching these across screens. */
  front_url: string | null;
  back_url: string | null;
  selfie_url: string | null;
}

// POST /v1/kyc/upload-url — 503 if S3 isn't configured server-side; the caller decides
// whether that's fatal (it is, for a real submission — there is nowhere to put the photo).
export function getUploadUrl(
  kind: string,
  contentType = "image/jpeg"
): Promise<{ upload_url: string; object_key: string }> {
  return apiFetch<{ upload_url: string; object_key: string }>(API.KYC_UPLOAD_URL, {
    method: "POST",
    // S3 signs Content-Type into the presigned PUT. The value here must be identical
    // to the header used by uploadToPresignedUrl below.
    body: JSON.stringify({ kind, content_type: contentType }),
  });
}

/** PUTs the picked image's bytes straight to S3 via the presigned url — the image never
 *  passes through our own server (D-07 in the backend's own words). */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  fileUri: string,
  contentType: string
): Promise<void> {
  // Mock builds hand out a `mock://` url from getUploadUrl — nothing real to PUT to.
  if (uploadUrl.startsWith("mock://")) return;
  const blob = await (await fetch(fileUri)).blob();
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail ? `Upload failed: ${res.status} — ${detail}` : `Upload failed: ${res.status}`
    );
  }
}

// POST /v1/kyc/submit
export function submitKyc(params: {
  pg_id: string;
  kind: string;
  front_object_key: string;
  back_object_key: string;
  selfie_object_key: string;
  aadhaar_last4?: string;
}): Promise<KycRecord> {
  return apiFetch<KycRecord>(API.KYC_SUBMIT, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// GET /v1/kyc/pending?pg_id=
export function listPending(pgId: string): Promise<Page<KycRecord>> {
  return apiFetch<Page<KycRecord>>(`${API.KYC_PENDING}?pg_id=${pgId}`);
}

// POST /v1/kyc/{kyc_id}/verify
export function verifyKyc(kycId: string): Promise<KycRecord> {
  return apiFetch<KycRecord>(API.KYC_VERIFY(kycId), { method: "POST" });
}

// POST /v1/kyc/{kyc_id}/reject
export function rejectKyc(kycId: string, reason: string): Promise<KycRecord> {
  return apiFetch<KycRecord>(API.KYC_REJECT(kycId), {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function useKyc() {
  return {
    getUploadUrl,
    uploadToPresignedUrl,
    submitKyc,
    listPending,
    verifyKyc,
    rejectKyc,
  };
}
