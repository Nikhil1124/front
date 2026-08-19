/**
<<<<<<< HEAD
 * UpiConfigSection — Owner's UPI handle configuration list.
 * Redesigned for minimal, consistent flat styling: #176B3A green, #F7FAF7 canvas.
 * Integrates real listUpiIds, addUpiId, activateUpiId, removeUpiId API calls.
=======
 * UpiConfigSection — Owner's UPI handle list: add, remove, set primary.
 * Shared between the "UPI Settings" quick-action screen and the Settings
 * tab so both entry points stay in sync with one implementation.
 *
 * Real data end to end — `GuestPaymentsTab` routes actual rent payments to whichever handle
 * is active here, so this can never fall back to fabricated state.
>>>>>>> 5791b7e97b3c51320a8545c43ef6ccf4ebe3ef4a
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
<<<<<<< HEAD
import { Row, Col, Spacer } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useUpiIds, type UpiIdResponse } from '@/features/properties/useProperties';
import { useToast } from '@/hooks/useToast';
import { hapticSuccess, hapticSelect, hapticError } from '@/utils/haptics';

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
=======
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Txt, Btn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { hapticSuccess, hapticError } from '@/utils/haptics';
import { qk } from '@/data/queryKeys';
import { listUpiIds, addUpiId, activateUpiId, removeUpiId } from '@/features/properties/useProperties';

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

  const handleAddUpi = async () => {
    const trimmed = newUpi.trim();
    if (!trimmed.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI VPA handle containing @ (e.g. owner@okaxis).');
      return;
    }
    if (upiList.some((u) => u.vpa_address === trimmed)) {
      Alert.alert('Duplicate UPI', 'This UPI handle is already in your account list.');
      return;
    }
    try {
      await addMutation.mutateAsync(trimmed);
      setNewUpi('');
      hapticSuccess();
      toast('success', 'UPI Added', `"${trimmed}" has been added to your payment methods.`);
    } catch (err: any) {
      hapticError();
      toast('error', 'Could not add UPI', err?.message ?? 'Please try again.');
    }
  };

  const handleDeleteUpi = (id: string, handle: string) => {
    if (upiList.length <= 1) {
      Alert.alert('Action Restricted', 'You must maintain at least one active UPI handle for rent collections.');
>>>>>>> 5791b7e97b3c51320a8545c43ef6ccf4ebe3ef4a
      return;
    }
    if (!trimmed.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID (e.g. name@upi).');
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
<<<<<<< HEAD
              await removeUpiId(pgId, upiId);
              await loadUpiHandles();
              hapticSuccess();
              toast('info', 'UPI Deleted', 'Removed UPI handle successfully.');
            } catch (e: any) {
              hapticError();
              Alert.alert('Error', e?.message || 'Could not delete UPI handle.');
=======
              await removeMutation.mutateAsync(id);
              hapticError();
              toast('info', 'UPI Deleted', `Removed "${handle}" from your payment methods.`);
            } catch (err: any) {
              hapticError();
              toast('error', 'Could not remove UPI', err?.message ?? 'This may still be your active handle — activate another one first.');
>>>>>>> 5791b7e97b3c51320a8545c43ef6ccf4ebe3ef4a
            }
          },
        },
      ]
    );
  };

<<<<<<< HEAD
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
=======
  const handleSetPrimary = async (id: string, handle: string) => {
    try {
      await activateMutation.mutateAsync(id);
      hapticSuccess();
      toast('success', 'Primary UPI Updated', `Rent transfers will now route to ${handle}`);
    } catch (err: any) {
      hapticError();
      toast('error', 'Could not set primary', err?.message ?? 'Please try again.');
    }
  };

  return (
    <Card
      containerColor={Colors.surface}
      borderRadius={18}
      borderWidth={1}
      borderColor={Colors.borderSubtle}
      padding={[16, 16]}
    >
      <Row justify="space-between" align="center">
        <Col style={{ flex: 1 }}>
          <Row gap={6} align="center">
            <Txt variant="cardTitle" weight="900" color={Colors.textPrimary}>💳 Rent Collection UPI Handles</Txt>
            <InfoTip text="Payments from tenants will route to the active primary handle." />
          </Row>
        </Col>
      </Row>

      <Spacer size={12} />

      {isLoading ? (
        <Txt variant="caption" color={Colors.textMuted}>Loading…</Txt>
      ) : isError ? (
        <Txt variant="caption" color={Colors.danger}>Couldn't load your UPI handles. Pull to refresh and try again.</Txt>
      ) : upiList.length === 0 ? (
        <Txt variant="caption" color={Colors.textMuted}>No UPI handle configured yet. Add one below so residents can pay rent.</Txt>
      ) : (
        <View style={{ gap: 8 }}>
          {upiList.map((handle) => {
            const isPrimary = handle.is_active;
            return (
              <Card
                key={handle.id}
                containerColor={isPrimary ? '#F0FDF9' : Colors.surfaceElevated}
                borderRadius={12}
                borderWidth={1}
                borderColor={isPrimary ? '#A7F3D0' : Colors.borderSubtle}
                padding={[12, 12]}
              >
                <Row justify="space-between" align="center">
                  <Row gap={8} align="center" style={{ flex: 1 }}>
                    <Ionicons
                      name={isPrimary ? 'checkmark-circle' : 'qr-code-outline'}
                      size={18}
                      color={isPrimary ? '#059669' : Colors.textMuted}
                    />
                    <Col style={{ flex: 1 }}>
                      <Txt variant="body" weight="800" color={Colors.textPrimary}>{handle.vpa_address}</Txt>
                      <Txt variant="labelSmall" weight="400" color={isPrimary ? '#047857' : Colors.textMuted}>
                        {isPrimary ? '● ACTIVE PRIMARY HANDLE' : (handle.label || 'Secondary Handle')}
                      </Txt>
                    </Col>
                  </Row>
                  <Row gap={6} align="center">
                    {!isPrimary && (
                      <Btn
                        onPress={() => handleSetPrimary(handle.id, handle.vpa_address)}
                        loading={activateMutation.isPending}
                        containerColor={Colors.primary}
                        textColor={Colors.textInverse}
                        borderRadius={8}
                        height={28}
                        contentStyle={{ paddingHorizontal: 8 }}
                      >
                        <Txt variant="labelSmall" weight="800" color={Colors.textInverse}>Set Primary</Txt>
                      </Btn>
                    )}
                    <IconBtn
                      onPress={() => handleDeleteUpi(handle.id, handle.vpa_address)}
                      icon="trash-outline"
                      size={16}
                      tint="#EF4444"
                      containerColor="#FEF2F2"
                    />
                  </Row>
                </Row>
              </Card>
            );
          })}
        </View>
      )}
>>>>>>> 5791b7e97b3c51320a8545c43ef6ccf4ebe3ef4a

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

<<<<<<< HEAD
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
=======
      <OutlinedTextField
        label="Add New UPI ID"
        placeholder="propertyowner@okaxis"
        value={newUpi}
        onChangeText={setNewUpi}
        containerColor={Colors.surfaceMuted}
        style={{ marginBottom: 10 }}
      />
      <Btn
        onPress={handleAddUpi}
        loading={addMutation.isPending}
        disabled={addMutation.isPending}
        containerColor={Colors.primary}
        textColor={Colors.textInverse}
        borderRadius={10}
        height={40}
      >
        <Txt variant="caption" weight="800" color={Colors.textInverse}>+ Add UPI Handle</Txt>
      </Btn>
    </Card>
>>>>>>> 5791b7e97b3c51320a8545c43ef6ccf4ebe3ef4a
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
