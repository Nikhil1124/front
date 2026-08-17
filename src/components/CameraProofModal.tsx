/**
 * CameraProofModal — full-screen camera capture for proof-of-work uploads.
 *
 * Used by the housekeeping and maintenance flows: a "before" photo on punch-in,
 * an "after" photo to resolve a complaint. The screen that opens this modal
 * decides what the photo is for; this component only captures and submits it.
 *
 * Flow:
 *   1. On open, request camera permission. If denied, render a "Camera
 *      permission required" card with an "Open Settings" button that calls
 *      `Linking.openSettings()`.
 *   2. If granted, show a large circular capture button. Tapping it launches
 *      `expo-image-picker`'s native camera UI (`launchCameraAsync`).
 *   3. Once a photo is captured, show it as a preview with "Retake" (outlined)
 *      and "Submit" (solid CyberGreen) below.
 *   4. Submit calls `onCapture(photoUri)`, shows a spinner for the duration of
 *      the returned promise, then closes via `onClose`.
 *
 * Why a full-screen modal and not a sheet: the camera is a focused interaction
 * — there is nothing else to look at while capturing, and a sheet that floats
 * over a list invites taps on the list behind it. A full-screen overlay is also
 * what the native camera picker expects to return to.
 *
 * ── Integration note (Task 8) ──────────────────────────────────────────────
 * This is a SINGLE-capture modal: open → shoot → submit → close. A
 * before/after flow calls it twice (once with title "Before Photo", once with
 * "After Photo"), not once with two slots. The previous Task 8 stub exposed a
 * dual before/after contract; that dual UX is now the screen's job, composed
 * from two single-capture invocations. This keeps the modal reusable for the
 * one-shot "verify delivery" and "log expense receipt" flows too.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
  Image,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Card, Txt, Row, Col, Btn, OutlinedBtn, Spacer } from '@/components/ui';
import { Colors, Palette, Radii } from '@/theme';
import { haptic } from '@/utils/haptics';

export interface CameraProofModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Called with the local photo URI on submit. Resolves once upload finishes. */
  onCapture: (photoUri: string) => Promise<void>;
  onClose: () => void;
}

type PermissionState = 'unknown' | 'granted' | 'denied';

export function CameraProofModal({ visible, title, subtitle, onCapture, onClose }: CameraProofModalProps) {
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-check permission every time the modal opens. The user may have toggled
  // it in OS settings between two opens, and a cached "denied" would block them
  // forever even after granting.
  useEffect(() => {
    if (!visible) return;
    setPhotoUri(null);
    setSubmitting(false);
    ImagePicker.getCameraPermissionsAsync().then((res) => {
      setPermission(res.status === 'granted' ? 'granted' : 'denied');
    });
  }, [visible]);

  const requestPermission = async () => {
    const res = await ImagePicker.requestCameraPermissionsAsync();
    setPermission(res.status === 'granted' ? 'granted' : 'denied');
  };

  const handleCapture = async () => {
    haptic('light');
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });
      // `canceled` is the user backing out of the camera without shooting —
      // not an error, just stay on the capture button.
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        haptic('success');
        setPhotoUri(asset.uri);
      }
    } catch {
      // On Android the activity can be destroyed mid-capture; surface as a
      // denied state so the user gets a recovery path rather than a hang.
      setPermission('denied');
    }
  };

  const handleSubmit = async () => {
    if (!photoUri || submitting) return;
    haptic('medium');
    setSubmitting(true);
    try {
      await onCapture(photoUri);
      haptic('success');
      onClose();
    } catch {
      haptic('error');
      setSubmitting(false);
      // Stay open with the preview so the user can retry the submit. The
      // capture itself is intact; only the upload failed.
    }
  };

  const handleRetake = () => {
    haptic('light');
    setPhotoUri(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <Row align="center" justify="space-between" style={styles.header}>
            <Col style={{ flex: 1 }}>
              <Txt variant="screenTitle" color={Colors.IvoryWhiteText} numberOfLines={1}>
                {title}
              </Txt>
              {subtitle ? (
                <Txt variant="caption" color={Colors.SlateMutedText} numberOfLines={2}>
                  {subtitle}
                </Txt>
              ) : null}
            </Col>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={Colors.SlateMutedText} />
            </Pressable>
          </Row>

          {/* Body */}
          {permission === 'denied' ? (
            <PermissionDeniedCard onRequest={requestPermission} />
          ) : photoUri ? (
            <PreviewBody
              photoUri={photoUri}
              submitting={submitting}
              onRetake={handleRetake}
              onSubmit={handleSubmit}
            />
          ) : (
            <CaptureBody onCapture={handleCapture} />
          )}
        </View>
      </View>
    </Modal>
  );
}

/** The capture state: a hint card above the big circular shutter button. */
function CaptureBody({ onCapture }: { onCapture: () => void }) {
  return (
    <Col align="center" justify="center" gap={24} style={{ flex: 1 }}>
      <Card
        containerColor={Palette.SurfaceInk}
        borderRadius={Radii.xxl}
        borderColor={Palette.BorderMid}
        padding={[16, 18]}
        style={{ maxWidth: 320 }}
      >
        <Row align="center" gap={10}>
          <MaterialCommunityIcons name="camera-iris" size={20} color={Colors.CyberGreen} />
          <Txt variant="caption" color={Colors.IvoryWhiteText} weight="600">
            Frame the area clearly
          </Txt>
        </Row>
        <Spacer size={4} />
        <Txt variant="caption" color={Colors.SlateMutedText}>
          Ensure good lighting. This photo is the proof that completes the task.
        </Txt>
      </Card>

      <Pressable
        onPress={onCapture}
        style={({ pressed }) => [
          styles.shutterBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Capture photo"
        testID="camera-proof-capture"
      >
        <MaterialCommunityIcons name="camera" size={32} color={Colors.CyberGreen} />
      </Pressable>
      <Txt variant="caption" color={Colors.SlateMutedText}>Tap to capture</Txt>
    </Col>
  );
}

/** The preview state: the captured image fills the body, with Retake / Submit below. */
function PreviewBody({
  photoUri,
  submitting,
  onRetake,
  onSubmit,
}: {
  photoUri: string;
  submitting: boolean;
  onRetake: () => void;
  onSubmit: () => void;
}) {
  return (
    <Col style={{ flex: 1 }} gap={12}>
      <Card
        containerColor={Palette.SurfaceInk}
        borderRadius={Radii.xxl}
        borderColor={Palette.BorderMid}
        padding={0}
        style={{ flex: 1, overflow: 'hidden' }}
      >
        <Image
          source={{ uri: photoUri }}
          style={{ flex: 1, resizeMode: 'cover' }}
          testID="camera-proof-preview"
        />
      </Card>

      {submitting ? (
        <Card containerColor={Palette.SurfaceInk} borderRadius={Radii.lg} borderColor={Palette.BorderMid} padding={[14, 14]}>
          <Row align="center" justify="center" gap={10}>
            <ActivityIndicator color={Colors.CyberGreen} />
            <Txt variant="caption" weight="600" color={Colors.IvoryWhiteText}>Uploading proof…</Txt>
          </Row>
        </Card>
      ) : (
        <Row gap={10}>
          <OutlinedBtn
            onPress={onRetake}
            borderColor={Palette.BorderStrong}
            textColor={Colors.IvoryWhiteText}
            height={46}
            style={{ flex: 1 }}
            testID="camera-proof-retake"
          >
            <MaterialCommunityIcons name="camera-retake" size={18} color={Colors.IvoryWhiteText} />
            <Txt variant="caption" weight="700" color={Colors.IvoryWhiteText} style={{ marginLeft: 6 }}>Retake</Txt>
          </OutlinedBtn>
          <Btn
            onPress={onSubmit}
            containerColor={Colors.CyberGreen}
            textColor={Colors.LuxuryPureBlack}
            height={46}
            style={{ flex: 1 }}
            testID="camera-proof-submit"
          >
            <MaterialCommunityIcons name="check-circle" size={18} color={Colors.LuxuryPureBlack} />
            <Txt variant="caption" weight="700" color={Colors.LuxuryPureBlack} style={{ marginLeft: 6 }}>Submit</Txt>
          </Btn>
        </Row>
      )}
    </Col>
  );
}

/** The denied state: explain + offer the two recovery paths. */
function PermissionDeniedCard({ onRequest }: { onRequest: () => void }) {
  return (
    <Col align="center" justify="center" gap={16} style={{ flex: 1 }}>
      <View style={[styles.deniedIcon, { backgroundColor: `${Palette.StatusRed}22` }]}>
        <MaterialCommunityIcons name="camera-off" size={36} color={Palette.StatusRed} />
      </View>
      <Txt variant="cardTitle" color={Colors.IvoryWhiteText} align="center">
        Camera permission required
      </Txt>
      <Txt variant="caption" color={Colors.SlateMutedText} align="center" style={{ paddingHorizontal: 24 }}>
        PGow needs camera access to capture proof-of-work photos. Grant access in settings to continue.
      </Txt>
      <Row gap={10}>
        <OutlinedBtn
          onPress={onRequest}
          borderColor={Colors.CyberGreen}
          textColor={Colors.CyberGreen}
          height={42}
          testID="camera-proof-retry-permission"
        >
          Retry
        </OutlinedBtn>
        <Btn
          onPress={() => Linking.openSettings()}
          containerColor={Colors.CyberGreen}
          textColor={Colors.LuxuryPureBlack}
          height={42}
          testID="camera-proof-open-settings"
        >
          Open Settings
        </Btn>
      </Row>
    </Col>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.LuxuryPureBlack,
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Colors.CyberGreen,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deniedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CameraProofModal;
