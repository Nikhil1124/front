/**
 * Cross-platform key/value storage for auth tokens.
 *
 * expo-secure-store has no web implementation (its web module is a literal `export
 * default {}` — every method is missing, not just unsupported), so this app's `web` target
 * (declared in app.json, react-native-web is a real dependency) hard-crashed on the very
 * first render, in hydrateFromStorage, before anything could paint.
 *
 * Native (iOS/Android) keeps the real Keychain/Keystore-backed SecureStore. Web falls back
 * to localStorage — not encrypted at rest, which is the accepted tradeoff every RN-web app
 * makes here since there's no equivalent secure-enclave API in a browser reachable this way.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
