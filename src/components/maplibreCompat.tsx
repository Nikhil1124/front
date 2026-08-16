/**
 * Native (iOS/Android) entry point for MapLibre. Metro/React Native's platform-extension
 * resolution picks this file everywhere except web, where `maplibreCompat.web.tsx` is used
 * instead — `@maplibre/maplibre-react-native` is a native-only library with no web
 * implementation at all (throws, not a no-op, if you try to render it on web).
 *
 * LocationPicker.tsx and PropertyMap.tsx import from `@/components/maplibreCompat`, never
 * from the real package directly, so this file is the single place that split lives.
 */
export { Map, Camera, ViewAnnotation, type CameraRef } from "@maplibre/maplibre-react-native";
