import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

/**
 * What the KYC form has collected so far, kept outside the form so that closing it — or
 * Android killing the app while the camera is open — does not throw the photos away.
 *
 * Grant the camera "Only this time" and Android revokes it — and kills the app — once the app
 * has been in the background for about a minute, which a slow photo can be. The app used to
 * come back to the home screen with the form closed and everything in it gone. Now home reopens
 * the form (`pendingSlot` says a photo was in progress) with the rest of it intact. The photo
 * being taken at the moment of the kill is still lost: Android hands it to an app that has not
 * finished starting, and React Native drops it, so only that one has to be retaken.
 * `recoverPendingPhoto` covers the milder case, where Android destroys the screen but not the
 * app, and expo-image-picker can hand the photo back.
 *
 * The photos are local file uris in the app's cache — they never leave the phone until
 * submit. The Aadhaar number is held in memory only: the form promises the full number is
 * never saved, and that includes the phone's own storage. Cleared on submit and on sign-out.
 */
const KYC_DRAFT_KEY = 'pgow-kyc-draft';

export type KycPhotoSlot = 'selfie' | 'idPhoto';

export type KycDraft = {
  idType?: string;
  selfieUri?: string;
  idPhotoUri?: string;
  pendingSlot?: KycPhotoSlot;
};

let idNumberInMemory = '';
export const draftIdNumber = {
  get: () => idNumberInMemory,
  set: (v: string) => { idNumberInMemory = v; },
};

export async function loadKycDraft(): Promise<KycDraft> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KYC_DRAFT_KEY)) ?? '{}') as KycDraft;
  } catch {
    return {};
  }
}

export async function saveKycDraft(patch: Partial<KycDraft>): Promise<void> {
  try {
    const next = { ...(await loadKycDraft()), ...patch };
    await AsyncStorage.setItem(KYC_DRAFT_KEY, JSON.stringify(next));
  } catch {
    // A draft is a convenience; failing to keep one must not block taking the photo.
  }
}

export async function clearKycDraft(): Promise<void> {
  idNumberInMemory = '';
  try {
    await AsyncStorage.removeItem(KYC_DRAFT_KEY);
  } catch {
    // As above.
  }
}

/** The photo a camera or library launch produced after Android restarted the app, if any. */
export async function recoverPendingPhoto(): Promise<string | null> {
  try {
    const result = await ImagePicker.getPendingResultAsync();
    if (result && 'canceled' in result && !result.canceled) return result.assets?.[0]?.uri ?? null;
  } catch {
    // No pending result is the normal case.
  }
  return null;
}
