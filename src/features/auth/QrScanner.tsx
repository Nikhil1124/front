/**
 * QR scanner for the lobby poster.
 *
 * Replaces a "scan" flow that opened a modal and asked you to type the code by hand — the
 * camera was never involved. The owner's invite screen now renders a real QR (see
 * `InviteQr`), and this reads it.
 *
 * Only `qr` is requested from the barcode scanner: this screen exists to read one specific
 * thing, and every other symbology it could match is a false positive waiting to happen.
 */
import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Radii } from '@/theme';
import { Btn, Spacer, Txt } from '@/components/ui';

/**
 * A PGow join link or a bare code.
 *
 * The generated QR carries `pgow://join/<CODE>` so a phone's own camera app can deep-link
 * into the app, but a code typed into any generic QR generator is just the code — accept both
 * rather than making the poster's provenance the user's problem.
 */
function codeFrom(raw: string): string | null {
  const value = raw.trim();
  const viaUrl = value.match(/(?:pgow:\/\/join\/|[?&]code=)([A-Za-z0-9]{4,32})/i);
  if (viaUrl) return viaUrl[1].toUpperCase();
  if (/^[A-Za-z0-9]{4,32}$/.test(value)) return value.toUpperCase();
  return null;
}

export function QrScanner({
  onScanned, onCancel,
}: { onScanned: (code: string) => void; onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [rejected, setRejected] = useState(false);
  // The camera fires continuously while a code is in frame; without this the parent gets the
  // same scan a dozen times and starts a dozen lookups.
  const handled = useRef(false);

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.centre]}>
        <Ionicons name="camera-outline" size={40} color={Colors.textMuted} />
        <Spacer size={14} />
        <Txt size={15} weight="700" color={Colors.textPrimary} align="center">Camera access needed</Txt>
        <Txt size={12.5} color={Colors.textMuted} align="center" style={{ marginTop: 6, paddingHorizontal: 32 }}>
          {permission.canAskAgain
            ? 'PGow needs the camera to read the QR on your lobby poster. You can always type the code instead.'
            : 'Camera access is turned off for PGow in your phone settings. You can still type the code instead.'}
        </Txt>
        <Spacer size={20} />
        {permission.canAskAgain && (
          <>
            <Btn onPress={requestPermission} height={48} borderRadius={Radii.card} width="80%">
              <Txt size={14} weight="700" color={Colors.textInverse}>Allow camera</Txt>
            </Btn>
            <Spacer size={10} />
          </>
        )}
        <AnimatedPress onPress={onCancel} style={styles.link}>
          <Txt size={13} weight="700" color={Colors.primary}>Type the code instead</Txt>
        </AnimatedPress>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const code = codeFrom(data);
          if (!code) { setRejected(true); return; }
          handled.current = true;
          onScanned(code);
        }}
      />

      {/* Aiming frame — the camera reads the whole view, this only tells the eye where to aim. */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Txt size={13} weight="700" color={Colors.textInverse} align="center" style={{ marginTop: 18 }}>
          Point at the QR on your lobby poster
        </Txt>
        {rejected ? (
          <Txt size={12} color={Colors.textInverse} align="center" style={{ marginTop: 8, opacity: 0.85 }}>
            That code is not a PGow join code.
          </Txt>
        ) : null}
      </View>

      <View style={styles.footer}>
        <AnimatedPress onPress={onCancel} style={styles.link} accessibilityLabel="Cancel scanning">
          <Txt size={14} weight="700" color={Colors.textInverse}>Type the code instead</Txt>
        </AnimatedPress>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  centre: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.canvas },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 240,
    height: 240,
    borderRadius: Radii.card,
    borderWidth: 3,
    borderColor: Colors.surface,
    backgroundColor: 'transparent',
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 44, alignItems: 'center' },
  link: { paddingVertical: 12, paddingHorizontal: 18 },
});
