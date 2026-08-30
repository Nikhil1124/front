/**
 * UpiConfigSection — Owner's UPI handle configuration list.
 * Redesigned for minimal, consistent flat styling: #176B3A green, #F7FAF7 canvas.
 * Integrates real listUpiIds, addUpiId, activateUpiId, removeUpiId API calls with React Query.
 */
import { useState } from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Spacer } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { hapticSuccess, hapticSelect, hapticError } from '@/utils/haptics';
import { qk } from '@/data/queryKeys';
import { listUpiIds, addUpiId, activateUpiId, removeUpiId } from '@/features/properties/useProperties';

// ── Design Tokens ─────────────────────────────────────────────────────────────
const GREEN = '#5B45E8';      // Indigo brand primary
const BG = '#F7F8FC';         // Canvas BG
const CHARCOAL = '#15171A';   // Primary text
const MUTED = '#6B7280';      // Muted text
const BORDER = '#E5E7EB';     // Subtle border
const WHITE = '#FFFFFF';
const LIGHT_GREEN = '#EEF2FF';// Soft indigo active tint
const RADIUS = 22;            // Premium rounded corner radius

export function UpiConfigSection() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const pgId = activePgId ?? null;
  const toast = useToast();
  const qc = useQueryClient();

  const { data: upiList = [], isLoading, isError } = useQuery({
    queryKey: qk.properties.upiIds(pgId ?? ''),
    queryFn: () => listUpiIds(pgId!),
    enabled: !!pgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.properties.upiIds(pgId ?? '') });

  const addMutation = useMutation({
    mutationFn: (vpa: string) => addUpiId(pgId!, vpa),
    onSuccess: () => invalidate(),
  });
  const activateMutation = useMutation({
    mutationFn: (id: string) => activateUpiId(pgId!, id),
    onSuccess: () => invalidate(),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeUpiId(pgId!, id),
    onSuccess: () => invalidate(),
  });

  const [newUpi, setNewUpi] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleAddUpi = async () => {
    const trimmed = newUpi.trim();
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
    try {
      await addMutation.mutateAsync(trimmed);
      setNewUpi('');
      hapticSuccess();
      toast('success', 'UPI Added', `"${trimmed}" was added successfully.`);
    } catch (err: any) {
      hapticError();
      setErrorMsg(err?.message || 'Could not add UPI handle.');
    }
  };

  const handleDeleteUpi = (upiId: string, handleStr: string) => {
    if (upiList.length <= 1) {
      Alert.alert('Action Restricted', 'You must maintain at least one active UPI handle for rent collections.');
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
              await removeMutation.mutateAsync(upiId);
              hapticSuccess();
              toast('info', 'UPI Deleted', 'Removed UPI handle successfully.');
            } catch (err: any) {
              hapticError();
              Alert.alert('Error', err?.message || 'Could not delete UPI handle.');
            }
          },
        },
      ]
    );
  };

  const handleSetPrimary = async (upiId: string, handleStr: string) => {
    try {
      await activateMutation.mutateAsync(upiId);
      hapticSuccess();
      toast('success', 'Primary UPI Updated', `Rent collection handle set to "${handleStr}"`);
    } catch (err: any) {
      hapticError();
      Alert.alert('Error', err?.message || 'Could not update primary handle.');
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
                          isPrimary ? { backgroundColor: '#EEF2FF' } : { backgroundColor: BG },
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
          style={[styles.submitBtn, addMutation.isPending && styles.submitBtnDisabled]}
          onPress={handleAddUpi}
          activeOpacity={0.85}
          disabled={addMutation.isPending}
        >
          {addMutation.isPending ? (
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
