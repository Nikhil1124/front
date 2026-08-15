/**
 * Session and credentials.
 *
 * No navigation happens here. The previous version called `router.replace()` inside each
 * mutation, which both coupled auth to one app's route table and made "am I signed in" a
 * thing you had to *do* rather than a thing you could *read*. Screens derive what to show
 * from `useSession()`; this layer only moves tokens.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";
import { useAuthStore, type User } from "../../store/authStore";
import { unregisterDevice } from "../devices/useDevices";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  must_change_password: boolean;
}

// ─── Plain functions ─────────────────────────────────────────────────────────
// The Zustand store drives the login screens and cannot call a hook, so every credential
// request is a top-level function and the mutations below are thin wrappers over these.
// One implementation, two callers.

export function fetchMe(): Promise<User> {
  return apiFetch<User>(API.ME);
}

export function register(params: {
  name: string;
  phone: string;
  password: string;
  email?: string;
}): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(API.REGISTER, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function login(params: { phone: string; password: string; asGuest?: boolean }): Promise<TokenResponse> {
  const { asGuest, ...rest } = params;
  return apiFetch<TokenResponse>(API.LOGIN, {
    method: "POST",
    // `as_guest` tells the (mock) backend not to auto-provision an owner account for an
    // unrecognised phone — the resident tab must match an existing invited guest, full stop.
    body: JSON.stringify(asGuest ? { ...rest, as_guest: true } : rest),
    // A wrong password is this form's answer to show, not a reason to tear down the
    // session and bounce the user somewhere else.
    unauthorized: "throw",
  });
}

export function pinLogin(params: { phone: string; pin: string }): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(API.PIN_LOGIN, {
    method: "POST",
    body: JSON.stringify(params),
    unauthorized: "throw",
  });
}

export function changePassword(params: {
  current_password: string;
  new_password: string;
}): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(API.CHANGE_PASSWORD, {
    method: "POST",
    body: JSON.stringify(params),
    unauthorized: "throw",
  });
}

/**
 * Step one of setting a profile photo: a presigned PUT.
 *
 * The bytes go straight to storage and never touch our server, same as KYC. Step two is
 * `updateMe({ avatar_object_key })` — an upload nobody confirms is just an orphan object.
 */
export function avatarUploadUrl(
  contentType = "image/jpeg"
): Promise<{ upload_url: string; object_key: string }> {
  return apiFetch<{ upload_url: string; object_key: string }>(API.ME_AVATAR_UPLOAD_URL, {
    method: "POST",
    body: JSON.stringify({ content_type: contentType }),
  });
}

export function updateMe(params: {
  name?: string;
  email?: string;
  /** Null clears the photo. */
  avatar_object_key?: string | null;
}): Promise<User> {
  return apiFetch<User>(API.ME, { method: "PATCH", body: JSON.stringify(params) });
}

/**
 * End the session everywhere: unsubscribe this phone from push, tell the server, then clear
 * local tokens. Every step past the first is best effort — a failure must never strand
 * someone inside a session they asked to leave.
 */
export async function logoutEverywhere(): Promise<void> {
  // Unsubscribe first, while the access token is still valid — otherwise whoever just
  // signed out keeps receiving their old property's notifications.
  const { deviceId } = useAuthStore.getState();
  if (deviceId) {
    try {
      await unregisterDevice(deviceId);
    } catch {
      // The server reassigns a token when a different account registers it, so a missed
      // cleanup self-corrects on the next sign-in on this phone.
    }
  }
  try {
    await apiFetch(API.LOGOUT, { method: "POST" });
  } catch {
    // Clear locally regardless.
  }
  await useAuthStore.getState().logout();
}

/**
 * The signed-in user, or null.
 *
 * `enabled` on the presence of a token so a signed-out app makes no request at all rather
 * than firing a 401 on every launch. `retry: false` because a failure here means the
 * session is gone — retrying an expired token three times only delays the login screen.
 */
export function useSession() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: qk.session(),
    enabled: !!accessToken,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const user = await fetchMe();
      setUser(user);
      return user;
    },
  });
}

/** Shared by every credential mutation: store the pair, then load who it belongs to. */
function useTokenLanding() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const queryClient = useQueryClient();

  return async (data: TokenResponse) => {
    await setTokens(data.access_token, data.refresh_token);
    // Refetch rather than reuse: the session query is disabled while signed out, so its
    // cache holds nothing, and every screen keys off it.
    await queryClient.invalidateQueries({ queryKey: qk.session() });
    return data;
  };
}

/** POST /v1/auth/register — owner self-signup only. */
export function useRegister() {
  const land = useTokenLanding();
  return useMutation({
    mutationFn: register,
    onSuccess: land,
  });
}

/** POST /v1/auth/login — phone + password. */
export function useLogin() {
  const land = useTokenLanding();
  return useMutation({
    mutationFn: login,
    onSuccess: land,
  });
}

/** POST /v1/auth/login/pin — staff PIN login. */
export function usePinLogin() {
  const land = useTokenLanding();
  return useMutation({
    mutationFn: pinLogin,
    onSuccess: land,
  });
}

/** POST /v1/auth/password — forced first change, or a normal one. */
export function useChangePassword() {
  const land = useTokenLanding();
  return useMutation({
    mutationFn: changePassword,
    // Both tokens are replaced — the old pair is invalid the moment this returns.
    onSuccess: land,
  });
}

/** PATCH /v1/me — own name and/or email. Not phone (that is the login identity) or role. */
export function useUpdateMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(qk.session(), user);
    },
  });
}

/** POST /v1/auth/logout, plus unsubscribing this phone from push. */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutEverywhere,
    onSuccess: () => {
      // Not `invalidateQueries` — that refetches. Every cached property, roster and payment
      // belongs to the account that just left and must not survive into the next one.
      queryClient.clear();
    },
  });
}
