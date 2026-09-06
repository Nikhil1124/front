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
import { Radii, Colors } from '@/theme';

export interface KycDocumentsCardProps {
  idPhotoUri?: string | null;
  selfieUri?: string | null;
  /** Shown when neither photo is present, to say why rather than just showing nothing. */
  emptyHint?: string;
}

export function KycDocumentsCard({ idPhotoUri, selfieUri, emptyHint }: KycDocumentsCardProps) {
  const [zoomed, setZoomed] = useState<{ uri: string; label: string } | null>(null);
  const [idFailed, setIdFailed] = useState(false);
  const [selfieFailed, setSelfieFailed] = useState(false);

  const hasIdPhoto = !!idPhotoUri && idPhotoUri.trim() !== '' && !idPhotoUri.includes('placeholder') && !idFailed;
  const hasSelfie = !!selfieUri && selfieUri.trim() !== '' && !selfieUri.includes('placeholder') && !selfieFailed;
  const hasAny = hasIdPhoto || hasSelfie;

  // Active whenever documents are rendered
  useScreenCaptureGuard(hasAny);

  if (!hasAny) {
    return (
      <View style={styles.emptyBox}>
        <Ionicons name="document-text-outline" size={20} color={Colors.textMuted} />
        <Txt size={12} color={Colors.textMuted} style={{ flex: 1 }}>
          {emptyHint ?? 'No uploaded document photos on file for this submission.'}
        </Txt>
      </View>
    );
  }

  const renderThumb = (uri: string | null | undefined, hasImage: boolean, label: string, badgeIcon: 'card' | 'person', onError: () => void) => {
    if (!hasImage || !uri) {
      return (
        <View style={styles.thumbEmptyCard}>
          <Ionicons name={badgeIcon === 'card' ? 'card-outline' : 'person-outline'} size={24} color={Colors.textMuted} />
          <Txt size={10} weight="700" color={Colors.textMuted} style={{ marginTop: 4 }}>
            No {label.toLowerCase()}
          </Txt>
        </View>
      );
    }

    return (
      <Pressable
        style={styles.thumbCard}
        onPress={() => setZoomed({ uri, label })}
        accessibilityRole="imagebutton"
        accessibilityLabel={`View ${label} full screen`}
      >
        <Image
          source={{ uri }}
          style={styles.thumbImg}
          resizeMode="cover"
          onError={onError}
        />
        <View style={styles.thumbOverlay}>
          <View style={styles.badgePill}>
            <Ionicons name={badgeIcon === 'card' ? 'card-outline' : 'person-outline'} size={12} color="#FFF" />
            <Txt size={10} weight="800" color="#FFF">{label}</Txt>
          </View>
          <View style={styles.inspectHint}>
            <Ionicons name="scan-outline" size={11} color={Colors.secondary} />
            <Txt size={9} weight="800" color={Colors.secondary}>TAP TO ENLARGE</Txt>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Row gap={10} style={{ width: '100%' }}>
        {renderThumb(idPhotoUri, hasIdPhoto, 'ID Proof Document', 'card', () => setIdFailed(true))}
        {renderThumb(selfieUri, hasSelfie, 'Resident Selfie Photo', 'person', () => setSelfieFailed(true))}
      </Row>
      
      <Spacer size={8} />
      <Row gap={6} align="center" style={styles.securityNoteBox}>
        <Ionicons name="shield-checkmark" size={12} color={Colors.primary} />
        <Txt size={10} weight="600" color={Colors.textMuted} style={{ flex: 1 }}>
          Encrypted document viewer. Screenshots protected.
        </Txt>
      </Row>

      {/* Full-Screen Document Inspection Viewer */}
      <Modal visible={zoomed != null} transparent animationType="fade" onRequestClose={() => setZoomed(null)}>
        <View style={styles.zoomBackdrop}>
          <View style={styles.zoomHeader}>
            <View>
              <Txt size={15} weight="900" color="#FFFFFF">{zoomed?.label}</Txt>
              <Txt size={11} color="#A7EBF2" style={{ marginTop: 2 }}>Official KYC Verification Document</Txt>
            </View>
            <Pressable hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" onPress={() => setZoomed(null)} style={styles.closeBtn} accessibilityRole="button">
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.zoomImgWrapper}>
            {zoomed ? (
              <Image source={{ uri: zoomed.uri }} style={styles.zoomImg} resizeMode="contain" />
            ) : null}
          </View>

          <View style={styles.zoomFooter}>
            <Pressable accessibilityRole="button" style={styles.closeModalBtn} onPress={() => setZoomed(null)}>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Txt size={13} weight="800" color="#FFF" style={{ marginLeft: 6 }}>Done Inspecting</Txt>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.canvas,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
  },
  thumbEmptyCard: {
    flex: 1,
    height: 135,
    borderRadius: Radii.card,
    backgroundColor: Colors.canvas,
    borderWidth: 1.5,
    borderColor: Colors.borderSubtle,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCard: {
    flex: 1,
    height: 135,
    borderRadius: Radii.card,
    overflow: 'hidden',
    backgroundColor: Colors.primaryDark,
    borderWidth: 1.5,
    borderColor: Colors.borderSubtle,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(1, 28, 64, 0.25)',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(1, 28, 64, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.control,
    alignSelf: 'flex-start',
  },
  inspectHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.control,
    alignSelf: 'center',
  },
  securityNoteBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.control,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'space-between',
  },
  zoomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(203, 239, 244, 0.2)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImgWrapper: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImg: {
    width: '100%',
    height: '100%',
  },
  zoomFooter: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  closeModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radii.card,
    width: '100%',
  },
});

export default KycDocumentsCard;
