/**
 * UpiConfigSection — Owner's UPI handle configuration list.
 * Redesigned for minimal, consistent flat styling: #176B3A green, #F7FAF7 canvas.
 * Integrates real listUpiIds, addUpiId, activateUpiId, removeUpiId API calls.
 */
import { useState, useEffect } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Row, Col, Spacer } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useUpiIds, type UpiIdResponse } from '@/features/properties/useProperties';
import { useToast } from '@/hooks/useToast';
import { hapticSuccess, hapticError } from '@/utils/haptics';
// ponytail: this section fetches with a manual useState/useEffect instead of the
// useUpiIdsQuery/useMutation pair @/features/properties/useProperties also exports — an
// alternate implementation existed briefly on another branch using that pattern with the
// shared Card/Colors design system, but this file's own StyleSheet (bottom of the file) is
// built for the local-hex-token styling below, matching every other tab in this directory.
// Upgrade to the query-hook version if this component ever needs to share a cache with
// another screen reading the same PG's UPI list.

// ── Design Tokens ─────────────────────────────────────────────────────────────
const GREEN = '#176B3A';
const BG = '#F7FAF7';
const CHARCOAL = '#17201A';
const MUTED = '#66736B';
const BORDER = '#E6EFEA';
const WHITE = '#FFFFFF';
const LIGHT_GREEN = '#EEF8F1';
const RADIUS = 18;

export function UpiConfigSection() {
  const owner = usePGowStore((s) => s.loggedInOwner);
  const activePgId = useAuthStore((s) => s.activePgId);
  const pgId = activePgId ?? owner?.id ?? null;

  const toast = useToast();
  const { listUpiIds, addUpiId, activateUpiId, removeUpiId } = useUpiIds();

  // State
  const [upiList, setUpiList] = useState<UpiIdResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUpi, setNewUpi] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Load real data
  const loadUpiHandles = async () => {
    if (!pgId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await listUpiIds(pgId);
      setUpiList(res);
    } catch (e) {
      console.warn('Failed to load UPI IDs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUpiHandles();
  }, [pgId]);

  // Handlers
  const handleAddUpi = async () => {
    if (!pgId) return;
    const trimmed = newUpi.trim();

    // Inline validation
    if (!trimmed) {
      setErrorMsg('UPI ID is required.');
      return;
    }
    if (!trimmed.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID (e.g. name@upi).');
      return;
    }
    if (upiList.some((u) => u.vpa_address === trimmed)) {
      setErrorMsg('This UPI handle is already in your account list.');
      return;
    }
    setErrorMsg('');
    setIsAdding(true);

    try {
      await addUpiId(pgId, trimmed);
      setNewUpi('');
      await loadUpiHandles();
      hapticSuccess();
      toast('success', 'UPI Added', `"${trimmed}" was added successfully.`);
    } catch (e: any) {
      hapticError();
      setErrorMsg(e?.message || 'Could not add UPI handle.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUpi = (upiId: string, handleStr: string) => {
    if (!pgId) return;
    // At least one handle must survive — GuestPaymentsTab routes rent to whichever one is
    // active, so removing the last one would leave nothing for it to route to.
    if (upiList.length <= 1) {
      Alert.alert('Action Restricted', 'You must maintain at least one UPI handle for rent collection.');
      return;
    }

    Alert.alert(
      'Delete UPI handle?',
      'This handle will no longer be available for rent collection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeUpiId(pgId, upiId);
              await loadUpiHandles();
              hapticSuccess();
              toast('info', 'UPI Deleted', `Removed "${handleStr}" from your payment methods.`);
            } catch (e: any) {
              hapticError();
              // The server 409s if this is still the active handle and another exists —
              // name that specifically rather than a generic failure message.
              Alert.alert('Error', e?.message || 'Could not delete UPI handle. This may still be your active handle — activate another one first.');
            }
          },
        },
      ]
    );
  };

  const handleSetPrimary = async (upiId: string, handleStr: string) => {
    if (!pgId) return;
    try {
      await activateUpiId(pgId, upiId);
      await loadUpiHandles();
      hapticSuccess();
      toast('success', 'Primary UPI Updated', `Rent collection handle set to "${handleStr}"`);
    } catch (e: any) {
      hapticError();
      Alert.alert('Error', e?.message || 'Could not update primary handle.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={GREEN} />
        <Text style={styles.loadingText}>Loading UPI accounts...</Text>
      </View>
    );
  }

  return (
    <Col gap={24}>
      {/* ── Rent Collection List ── */}
      <Col gap={12}>
        <View>
          <Text style={styles.sectionTitle}>Rent Collection</Text>
          <Text style={styles.sectionSub}>
            Manage the UPI handles used to receive rent payments.
          </Text>
        </View>

        {upiList.length === 0 ? (
          /* Empty State */
          <View style={styles.emptyCard}>
            <Ionicons name="card-outline" size={32} color={MUTED} />
            <Text style={styles.emptyTitle}>No UPI handles added</Text>
            <Text style={styles.emptySubText}>
              Add a UPI ID to start receiving rent payments.
            </Text>
          </View>
        ) : (
          <Col gap={10}>
            {upiList.map((item) => {
              const isPrimary = item.is_active;
              return (
                <View key={item.id} style={[styles.upiCard, isPrimary && styles.upiCardPrimary]}>
                  <Row justify="space-between" align="center">
                    <Row gap={10} align="center" style={{ flex: 1 }}>
                      <View
                        style={[
                          styles.statusDotWrapper,
                          isPrimary ? { backgroundColor: '#EAF5EE' } : { backgroundColor: BG },
                        ]}
                      >
                        <Ionicons
                          name={isPrimary ? 'checkmark-circle' : 'qr-code-outline'}
                          size={18}
                          color={isPrimary ? GREEN : MUTED}
                        />
                      </View>
                      <Col style={{ flex: 1 }}>
                        <Text style={styles.vpaText} numberOfLines={1}>
                          {item.vpa_address}
                        </Text>
                        <Text style={[styles.statusLabel, isPrimary && styles.statusLabelActive]}>
                          {isPrimary ? 'Primary · Active' : 'Secondary'}
                        </Text>
                      </Col>
                    </Row>
                    <Row gap={8} align="center">
                      {!isPrimary && (
                        <TouchableOpacity
                          style={styles.primaryBtnAction}
                          onPress={() => handleSetPrimary(item.id, item.vpa_address)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.primaryBtnActionText}>Set as Primary</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteUpi(item.id, item.vpa_address)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                      </TouchableOpacity>
                    </Row>
                  </Row>
                </View>
              );
            })}
          </Col>
        )}
      </Col>

      {/* ── Add UPI Handle ── */}
      <Col gap={12}>
        <Text style={styles.sectionTitle}>Add UPI Handle</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Enter UPI ID</Text>
          <View style={[styles.inputContainer, !!errorMsg && styles.inputContainerError]}>
            <TextInput
              style={styles.textInput}
              value={newUpi}
              onChangeText={(v) => {
                setNewUpi(v);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="propertyowner@okaxis"
              placeholderTextColor="#9EB09E"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, isAdding && styles.submitBtnDisabled]}
          onPress={handleAddUpi}
          activeOpacity={0.85}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.submitBtnText}>Add UPI Handle</Text>
          )}
        </TouchableOpacity>
      </Col>
    </Col>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: { fontSize: 13, color: MUTED },

  // Sections
  sectionTitle: { fontSize: 16, fontWeight: '700', color: CHARCOAL },
  sectionSub: { fontSize: 13, color: MUTED, marginTop: 2 },

  // Cards
  upiCard: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  upiCardPrimary: {
    borderColor: '#C6E8D4',
  },
  statusDotWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vpaText: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  statusLabel: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 2 },
  statusLabelActive: { color: GREEN },

  // Actions
  primaryBtnAction: {
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryBtnActionText: { fontSize: 12, fontWeight: '800', color: WHITE },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input
  inputWrapper: { width: '100%' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: CHARCOAL, marginBottom: 6 },
  inputContainer: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputContainerError: { borderColor: '#DC2626' },
  textInput: { fontSize: 14, color: CHARCOAL, height: '100%' },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 5 },

  submitBtn: {
    height: 52,
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: WHITE },

  // Empty state
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL, marginTop: 8 },
  emptySubText: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 2 },
});
