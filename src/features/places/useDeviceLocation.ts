import { useState, useCallback } from "react";
import { Alert, Linking, Platform } from "react-native";
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
   * Request foreground location permission with helpful dialogs if denied.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.granted) return true;

      if (!existing.canAskAgain) {
        Alert.alert(
          "Location Permission Disabled",
          "PGow needs location permission to pinpoint your property on the map. Please enable location permissions in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                if (Platform.OS === "ios") {
                  Linking.openURL("app-settings:");
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return false;
      }

      const requested = await Location.requestForegroundPermissionsAsync();
      if (!requested.granted) {
        Alert.alert(
          "Permission Required",
          "Location permission is needed to automatically find and pinpoint your property's address."
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
        Alert.alert(
          "Location Services Off",
          "Please enable GPS / Location Services on your device to pinpoint your property."
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

      Alert.alert(
        "Location Unavailable",
        "Could not determine current GPS position. You can search by address or pin it manually on the map."
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
  };
}
