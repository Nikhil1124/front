/**
 * The resident's KYC photos, for whoever is allowed to look at them.
 *
 * These used to be visible in exactly one place — the pending-review modal — and rendered
 * everywhere else as the words "ID document photo on file". So the moment an owner approved
 * somebody, the documents they had just approved became unreachable: no way to re-check a
 * name against a lease, no way to answer a police verification, no way to see what they had
 * agreed to. The data was always in the roster response (`kyc_front_url` / `kyc_selfie_url`,
 * presigned for any status), it simply was not drawn.
 *
 * Screen capture is blocked while this is mounted — see `useScreenCaptureGuard` for what
 * that does and does not guarantee per platform.
 */
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Txt, Row, Spacer } from '@/components/ui';
import { useScreenCaptureGuard } from '@/hooks/useScreenCaptureGuard';
import { Colors } from '@/theme';

export interface KycDocumentsCardProps {
  idPhotoUri?: string | null;
  selfieUri?: string | null;
  /** Shown when neither photo is present, to say why rather than just showing nothing. */
  emptyHint?: string;
}

export function KycDocumentsCard({ idPhotoUri, selfieUri, emptyHint }: KycDocumentsCardProps) {
  const [zoomed, setZoomed] = useState<{ uri: string; label: string } | null>(null);
  const hasAny = !!idPhotoUri || !!selfieUri;

  // Active whenever documents are on screen, zoomed or not.
  useScreenCaptureGuard(hasAny);

  if (!hasAny) {
    return (
      <View style={styles.emptyBox}>
        <Ionicons name="document-outline" size={18} color={Colors.textMuted} />
        <Txt size={12} color={Colors.textMuted} style={{ flex: 1 }}>
          {emptyHint ?? 'No documents on file yet.'}
        </Txt>
      </View>
    );
  }

  const thumb = (uri: string | null | undefined, label: string, icon: 'card' | 'person') => {
    if (!uri) {
      return (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Ionicons name={icon === 'card' ? 'card-outline' : 'person-outline'} size={22} color={Colors.textMuted} />
          <Txt size={10} color={Colors.textMuted} style={{ marginTop: 4 }}>No {label.toLowerCase()}</Txt>
        </View>
      );
    }
    return (
      <Pressable
        style={styles.thumb}
        onPress={() => setZoomed({ uri, label })}
        accessibilityRole="imagebutton"
        accessibilityLabel={`View ${label} full screen`}
      >
        <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" />
        <View style={styles.thumbLabel}>
          <Txt size={10} weight="700" color={Colors.textInverse}>{label}</Txt>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <Row gap={10}>
        {thumb(idPhotoUri, 'ID document', 'card')}
        {thumb(selfieUri, 'Selfie', 'person')}
      </Row>
      <Spacer size={6} />
      <Row gap={6} align="center">
        <Ionicons name="lock-closed" size={11} color={Colors.textMuted} />
        <Txt size={10} color={Colors.textMuted} style={{ flex: 1 }}>
          Screenshots are blocked on these documents. Links expire — reopen this screen to view them again.
        </Txt>
      </Row>

      <Modal visible={zoomed != null} transparent animationType="fade" onRequestClose={() => setZoomed(null)}>
        <View style={styles.zoomBackdrop}>
          <Row justify="space-between" align="center" style={styles.zoomHeader}>
            <Txt size={14} weight="800" color={Colors.textInverse}>{zoomed?.label}</Txt>
            <Pressable onPress={() => setZoomed(null)} accessibilityRole="button" accessibilityLabel="Close document viewer" hitSlop={12}>
              <Ionicons name="close" size={26} color={Colors.textInverse} />
            </Pressable>
          </Row>
          {zoomed ? <Image source={{ uri: zoomed.uri }} style={styles.zoomImg} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceMuted, borderRadius: 10, padding: 12,
  },
  thumb: {
    flex: 1, height: 104, borderRadius: 12, overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  thumbLabel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.62)', paddingVertical: 4, alignItems: 'center',
  },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  zoomHeader: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 12 },
  zoomImg: { flex: 1, width: '100%' },
});

export default KycDocumentsCard;
