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
import { apiFetch, clearConditionalCache } from "../../data/apiClient";
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
    body: JSON.stringify(rest),
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
 * Always resolves, deliberately — same anti-enumeration shape as login: the caller cannot
 * tell from the response whether the phone belongs to an account, only whether the feature
 * itself is live (a 503 `DEPENDENCY_UNAVAILABLE` when the backend has no SES config yet).
 */
export function requestPasswordReset(phone: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(API.PASSWORD_RESET_REQUEST, {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

/** Redeems the token from the emailed reset link. Auto-signs in on success, same as
 *  `changePassword` — the token itself is what proves it's them. */
export function confirmPasswordReset(token: string, newPassword: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(API.PASSWORD_RESET_CONFIRM, {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
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

/** A resident's own away/vacation toggle. Guest-only server-side; see `users.service.set_away`. */
export function setAway(isAway: boolean): Promise<User> {
  return apiFetch<User>(API.ME_AWAY, { method: "PATCH", body: JSON.stringify({ is_away: isAway }) });
}

/**
 * End the session everywhere: unsubscribe this phone from push, tell the server, then clear
 * local tokens. Every step past the first is best effort — a failure must never strand
 * someone inside a session they asked to leave.
 */
export async function logoutEverywhere(): Promise<void> {
  const { deviceId } = useAuthStore.getState();

  // Both requests are STARTED here, synchronously, before this function suspends even once.
  // `apiFetch` reads the access token before its first `await`, so a call begun now carries a
  // valid Authorization header — and callers deliberately do not await this function
  // (`usePGowStore.logout` fires it and clears the store on the next line, because nobody
  // should be held on a dashboard waiting for a network round trip to sign out).
  //
  // Awaiting them in sequence, as this used to, meant only the FIRST one got a live token:
  // by the time `await unregisterDevice(...)` resolved, the store was already cleared, so the
  // logout call went out unauthenticated, 401'd, and had its error swallowed below. The
  // device was cleaned up and the session never was — the refresh token stayed valid on the
  // server until it expired on its own.
  const pending: Promise<unknown>[] = [];
  if (deviceId) {
    // A missed device cleanup self-corrects: the server reassigns a token when a different
    // account registers it.
    pending.push(unregisterDevice(deviceId));
  }
  // Revokes the refresh token server-side. This is the half that makes signing out mean
  // something to a token that has already been copied off the device.
  pending.push(apiFetch(API.LOGOUT, { method: "POST" }));

  // `allSettled`, not `all`: neither failure may strand someone inside a session they asked
  // to leave, and the local clear below happens either way.
  await Promise.allSettled(pending);

  // Cached poll bodies are this account's order data — they must not survive into the next
  // sign-in on the same phone.
  clearConditionalCache();
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

/**
 * Shared by every credential mutation: store the pair, then load who it belongs to.
 *
 * Fetches and sets `user` directly rather than just invalidating the session query — nothing
 * mounts `useSession()` as an active observer at the moment a login mutation resolves (it's
 * mounted once, at the root, only to keep `user` fresh afterwards), so an invalidate here could
 * race a not-yet-subscribed query and silently do nothing. `setQueryData` then seeds that query's
 * cache so the root's `useSession()` reads this same fetch instead of firing a redundant one.
 */
export function useTokenLanding() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  return async (data: TokenResponse) => {
    await setTokens(data.access_token, data.refresh_token);
    if (!data.must_change_password) {
      const user = await fetchMe();
      setUser(user);
      queryClient.setQueryData(qk.session(), user);
    }
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

/** POST /v1/auth/password/reset-request — always resolves; see `requestPasswordReset`. */
export function useRequestPasswordResetMutation() {
  return useMutation({
    mutationFn: requestPasswordReset,
  });
}

/** POST /v1/auth/password/reset-confirm — redeems the emailed token, and signs the caller in. */
export function useConfirmPasswordResetMutation() {
  const land = useTokenLanding();
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      confirmPasswordReset(token, newPassword),
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

/** PATCH /v1/me/away — a resident's own away/vacation toggle. */
export function useSetAwayMutation() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setAway,
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

