/**
 * Blocks screenshots and screen recording while a screen holding identity documents is open.
 *
 * KYC photos are somebody's Aadhaar, PAN or passport plus their face. The owner has to SEE
 * them to verify — that is the whole job — but nothing about that job requires a copy of them
 * living in the owner's camera roll, where it outlives the tenancy, syncs to their cloud
 * backup, and is one shared album away from being a data breach the property is liable for.
 *
 * Platform behaviour differs and neither is a guarantee:
 *   • Android — `FLAG_SECURE`, a real block: the screenshot fails and the recording/app
 *     switcher preview goes black.
 *   • iOS — the OS does NOT allow blocking a screenshot. expo-screen-capture can only
 *     obscure the screen during an active RECORDING, and detect that a screenshot happened
 *     after the fact. A determined person with an iPhone can still capture the image.
 *
 * So this raises the cost and removes the accident; it is not a control you can promise a
 * resident is absolute. Treat it as one layer — the presigned URLs expiring is the other.
 *
 * Guarded per-screen rather than app-wide because `preventScreenCaptureAsync` is reference
 * counted by tag: releasing on unmount restores normal behaviour everywhere else, so a user
 * can still screenshot their own rent receipt.
 */
import { useEffect } from "react";
import * as ScreenCapture from "expo-screen-capture";

export function useScreenCaptureGuard(active: boolean, tag = "pgow-kyc-documents"): void {
  useEffect(() => {
    if (!active) return;
    let released = false;

    ScreenCapture.preventScreenCaptureAsync(tag).catch(() => {
      // Unsupported (web, or a build without the native module). The documents still render —
      // failing closed here would mean an owner could not verify anyone.
    });

    return () => {
      if (released) return;
      released = true;
      ScreenCapture.allowScreenCaptureAsync(tag).catch(() => {});
    };
  }, [active, tag]);
}

export default useScreenCaptureGuard;
