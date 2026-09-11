import { useState, useCallback } from "react";
import { Linking, Platform } from "react-native";
import { toastNow } from "../../hooks/useToast";
import * as Location from "expo-location";
import { BASE_URL, API } from "../../config";
import { fetchWithTimeout } from "../../hooks/useApi";
import { useAuthStore } from "../../store/authStore";
import { round6 } from "./geo";

export interface PinpointResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
  place_id?: string | null;
}

export function useDeviceLocation() {
  const { accessToken } = useAuthStore();
  const [locating, setLocating] = useState(false);
  /**
   * Permission denied for good is the one case here with something to DO about it, and a
   * toast has no button — so this raises a flag the caller turns into a real dialog with an
   * "Open settings" action. Everything else below is a notice, and a notice is a toast.
   */
  const [settingsPromptVisible, setSettingsPromptVisible] = useState(false);

  const openAppSettings = useCallback(() => {
    setSettingsPromptVisible(false);
    if (Platform.OS === "ios") Linking.openURL("app-settings:");
    else Linking.openSettings();
  }, []);

  /**
   * Request foreground location permission with helpful dialogs if denied.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.granted) return true;

      if (!existing.canAskAgain) {
        setSettingsPromptVisible(true);
        return false;
      }

      const requested = await Location.requestForegroundPermissionsAsync();
      if (!requested.granted) {
        toastNow(
          "warning",
          "Permission required",
          "Location is how the map finds your property's address for you."
        );
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Acquire precise current GPS coordinates.
   */
  const getCurrentCoordinates = useCallback(async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return null;

    setLocating(true);
    try {
      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        toastNow(
          "warning",
          "Location services are off",
          "Turn on GPS on your device to pinpoint your property."
        );
        return null;
      }

      // First try balanced/high accuracy with a reasonable timeout
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: round6(pos.coords.latitude),
        longitude: round6(pos.coords.longitude),
      };
    } catch (err: any) {
      // Fallback to last known position if fresh fix times out
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          return {
            latitude: round6(lastKnown.coords.latitude),
            longitude: round6(lastKnown.coords.longitude),
          };
        }
      } catch {}

      toastNow(
        "error",
        "Location unavailable",
        "Search by address, or drag the pin to the right spot on the map."
      );
      return null;
    } finally {
      setLocating(false);
    }
  }, [requestPermission]);

  /**
   * Acquire current GPS coordinates and reverse-geocode to a human-readable address.
   */
  const pinpointCurrentLocation = useCallback(async (): Promise<PinpointResult | null> => {
    const coords = await getCurrentCoordinates();
    if (!coords) return null;

    setLocating(true);
    try {
      // Call backend reverse-geocode proxy
      const res = await fetchWithTimeout(
        `${BASE_URL}${API.PLACES_REVERSE_GEOCODE}?lat=${coords.latitude}&lng=${coords.longitude}`,
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        }
      );

      if (res.ok) {
        const data = await res.json();
        return {
          latitude: coords.latitude,
          longitude: coords.longitude,
          formatted_address: data?.formatted_address ?? `${coords.latitude}, ${coords.longitude}`,
          place_id: data?.place_id ?? null,
        };
      }

      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        formatted_address: `${coords.latitude}, ${coords.longitude}`,
      };
    } catch {
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        formatted_address: `${coords.latitude}, ${coords.longitude}`,
      };
    } finally {
      setLocating(false);
    }
  }, [getCurrentCoordinates, accessToken]);

  return {
    locating,
    requestPermission,
    getCurrentCoordinates,
    pinpointCurrentLocation,
    settingsPromptVisible,
    dismissSettingsPrompt: () => setSettingsPromptVisible(false),
    openAppSettings,
  };
}
