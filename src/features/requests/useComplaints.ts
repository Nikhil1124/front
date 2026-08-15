import { apiFetch } from "../../data/apiClient";
import type { Page } from "../../data/apiClient";
import { API } from "../../config";

export interface RequestEventRecord {
  id: string;
  pg_id: string;
  request_id: string;
  actor_user_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  event_type: "comment" | "status_change" | "assignment";
  body?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  is_ai_generated?: boolean;
  created_at: string;
}

export interface RequestAttachment {
  id: string;
  content_type: string;
  size_bytes?: number | null;
  created_at: string;
  url?: string | null;
}

export interface RequestRecord {
  id: string;
  pg_id: string;
  raised_by: string;
  resident_name?: string | null;
  room_no?: string | null;
  phone?: string | null;
  kind: "complaint" | "feedback" | "grocery" | "repair" | "laundry";
  category?: string | null;
  title: string;
  description: string;
  status: "open" | "assigned" | "in_progress" | "resolved" | "cancelled";
  priority: "normal" | "express" | "scheduled";
  assigned_membership_id?: string | null;
  assigned_name?: string | null;
  assigned_role?: string | null;
  assigned_at?: string | null;
  amount?: number | string | null;
  service_date?: string | null;
  /**
   * Everything specific to one kind of service: the laundry's weight and pickup slot, the
   * grocery order's rider and ETA, the repair's urgency and technician rating.
   *
   * Free-form because `requests` serves five kinds, and a column per field of each would be
   * twenty nullable columns that nineteen rows out of twenty ignore.
   */
  details?: Record<string, unknown>;
  resolved_at?: string | null;
  resolution_note?: string | null;
  created_at: string;
  updated_at: string;
  events?: RequestEventRecord[];
  attachments?: RequestAttachment[];
}

export type RequestStatus = RequestRecord["status"];
export type RequestKind = RequestRecord["kind"];
export type RequestPriority = RequestRecord["priority"];

export interface SubmitComplaintParams {
  pg_id: string;
  kind?: RequestKind;
  category?: string;
  title: string;
  description?: string;
  priority?: RequestPriority;
  /** What the service is expected to cost. Only meaningful on the hub kinds. */
  amount?: number;
  /** When the service is wanted, for the kinds that are booked rather than reported. */
  service_date?: string;
  /** Kind-specific fields — see `RequestRecord.details`. */
  details?: Record<string, unknown>;
}

export interface AddRequestAttachmentParams {
  object_key: string;
  content_type: string;
  size_bytes?: number;
}

interface RequestAttachmentUploadUrl {
  upload_url: string;
  object_key: string;
}

// POST /v1/requests
export function submitComplaint(params: SubmitComplaintParams): Promise<RequestRecord> {
  return apiFetch<RequestRecord>(API.REQUESTS, {
    method: "POST",
    body: JSON.stringify({
      kind: "complaint",
      priority: "normal",
      ...params,
    }),
  });
}

// GET /v1/requests?pg_id=&kind=&status=&category=&priority=&limit=&cursor=
export function listComplaints(
  pgId: string,
  opts?: {
    kind?: RequestKind;
    status?: RequestStatus;
    category?: string;
    priority?: RequestPriority;
    limit?: number;
    cursor?: string;
  }
): Promise<Page<RequestRecord>> {
  const params = new URLSearchParams({ pg_id: pgId });
  if (opts?.kind) params.append("kind", opts.kind);
  if (opts?.status) params.append("status", opts.status);
  if (opts?.category) params.append("category", opts.category);
  if (opts?.priority) params.append("priority", opts.priority);
  if (opts?.limit) params.append("limit", opts.limit.toString());
  if (opts?.cursor) params.append("cursor", opts.cursor);
  return apiFetch<Page<RequestRecord>>(`${API.REQUESTS}?${params.toString()}`);
}

// GET /v1/requests/{id}
export function getComplaint(id: string): Promise<RequestRecord> {
  return apiFetch<RequestRecord>(API.REQUEST_DETAIL(id));
}

export function getAttachmentUploadUrl(
  id: string,
  contentType: string
): Promise<RequestAttachmentUploadUrl> {
  return apiFetch<RequestAttachmentUploadUrl>(API.REQUEST_ATTACHMENT_UPLOAD_URL(id), {
    method: "POST",
    body: JSON.stringify({ content_type: contentType }),
  });
}

export async function uploadAttachment(
  uploadUrl: string,
  uri: string,
  contentType: string
): Promise<void> {
  // Mock builds hand out a `mock://` url from getAttachmentUploadUrl — nothing real to PUT to.
  if (uploadUrl.startsWith("mock://")) return;
  const local = await fetch(uri);
  if (!local.ok) throw new Error("Could not read the selected photo.");
  const image = await local.blob();
  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: image,
  });
  if (!uploaded.ok) {
    const detail = (await uploaded.text()).trim().slice(0, 180);
    throw new Error(`Photo upload failed (${uploaded.status})${detail ? `: ${detail}` : ""}`);
  }
}

export function addAttachment(
  id: string,
  params: AddRequestAttachmentParams
): Promise<RequestAttachment> {
  return apiFetch<RequestAttachment>(API.REQUEST_ATTACHMENTS(id), {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// POST /v1/requests/{id}/events
export function addComment(
  id: string,
  body: string,
  toStatus?: RequestStatus
): Promise<RequestRecord> {
  return apiFetch<RequestRecord>(API.REQUEST_EVENTS(id), {
    method: "POST",
    body: JSON.stringify({
      event_type: "comment",
      body,
      to_status: toStatus,
    }),
  });
}

// POST /v1/requests/{id}/assign
export function assignComplaint(
  id: string,
  assignedMembershipId: string
): Promise<RequestRecord> {
  return apiFetch<RequestRecord>(API.REQUEST_ASSIGN(id), {
    method: "POST",
    body: JSON.stringify({ assigned_membership_id: assignedMembershipId }),
  });
}

// POST /v1/requests/{id}/resolve
export function resolveComplaint(id: string, resolutionNote?: string): Promise<RequestRecord> {
  return apiFetch<RequestRecord>(API.REQUEST_RESOLVE(id), {
    method: "POST",
    body: JSON.stringify({ resolution_note: resolutionNote }),
  });
}

// POST /v1/requests/{id}/cancel
export function cancelComplaint(id: string, reason?: string): Promise<RequestRecord> {
  return apiFetch<RequestRecord>(API.REQUEST_CANCEL(id), {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function useComplaints() {
  return {
    submitComplaint,
    listComplaints,
    getComplaint,
    getAttachmentUploadUrl,
    uploadAttachment,
    addAttachment,
    addComment,
    assignComplaint,
    resolveComplaint,
    cancelComplaint,
  };
}
