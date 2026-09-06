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
  Text,
  ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, OutlinedTextField, AnimatedPress } from '@/components/ui';
import { Colors, Palette, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { qk } from '@/data/queryKeys';
import { listUpiIds, addUpiId, activateUpiId, removeUpiId } from '@/features/properties/useProperties';

// ── Design Tokens (Official LUNA Palette) ───────────────────────────────────
const GREEN = Colors.primary;        // Deep Ocean Blue brand primary
const BG = Colors.canvas;            // Light Ice Canvas BG
const CHARCOAL = Colors.textPrimary; // Obsidian Navy primary text
const MUTED = Colors.textMuted;      // Ocean Muted text
const BORDER = Colors.borderSubtle;  // Ice Cyan subtle border
const WHITE = Colors.surface;        // Pure White surface
const RADIUS = 20;            // Rounded corner radius

export function UpiConfigSection() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const pgId = activePgId ?? null;
  const toast = useToast();
  const qc = useQueryClient();

  const { data: upiList = [], isLoading, isError } = useQuery({
    queryKey: qk.properties.upiIds(pgId ?? ''),
    queryFn: () => listUpiIds(pgId!),
    enabled: !!pgId });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.properties.upiIds(pgId ?? '') });

  const addMutation = useMutation({
    mutationFn: (vpa: string) => addUpiId(pgId!, vpa),
    onSuccess: () => invalidate() });
  const activateMutation = useMutation({
    mutationFn: (id: string) => activateUpiId(pgId!, id),
    onSuccess: () => invalidate() });
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeUpiId(pgId!, id),
    onSuccess: () => invalidate() });

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
      toast('success', 'UPI Added', `"${trimmed}" was added successfully.`);
    } catch (err: any) {
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
              toast('info', 'UPI Deleted', 'Removed UPI handle successfully.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not delete UPI handle.');
            }
          } },
      ]
    );
  };

  const handleSetPrimary = async (upiId: string, handleStr: string) => {
    try {
      await activateMutation.mutateAsync(upiId);
      toast('success', 'Primary UPI Updated', `Rent collection handle set to "${handleStr}"`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update primary handle.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={GREEN} />
        <Text maxFontSizeMultiplier={1.3} style={styles.loadingText}>Loading UPI accounts...</Text>
      </View>
    );
  }

  return (
    <Col gap={24}>
      {/* ── Rent Collection List ── */}
      <Col gap={12}>
        <View>
          <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Rent Collection</Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.sectionSub}>
            Manage the UPI handles used to receive rent payments.
          </Text>
        </View>

        {isError ? (
          /* A failed fetch used to fall through to the empty state, so a network blip read as
             "you have no UPI handles" — and adding one from there would duplicate a handle
             that is already on the account. */
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={Colors.danger} />
            <Text maxFontSizeMultiplier={1.3} style={styles.emptyTitle}>Could not load your UPI handles</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.emptySubText}>
              Pull to refresh, or check your connection. Do not add a handle until this loads —
              you may already have one.
            </Text>
          </View>
        ) : upiList.length === 0 ? (
          /* Empty State */
          <View style={styles.emptyCard}>
            <Ionicons name="card-outline" size={32} color={MUTED} />
            <Text maxFontSizeMultiplier={1.3} style={styles.emptyTitle}>No UPI handles added</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.emptySubText}>
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
                        <Text maxFontSizeMultiplier={1.3} style={styles.vpaText} numberOfLines={1}>
                          {item.vpa_address}
                        </Text>
                        <Text maxFontSizeMultiplier={1.3} style={[styles.statusLabel, isPrimary && styles.statusLabelActive]}>
                          {isPrimary ? 'Primary · Active' : 'Secondary'}
                        </Text>
                      </Col>
                    </Row>
                    <Row gap={8} align="center">
                      {!isPrimary && (
                        <AnimatedPress accessibilityRole="button"
                          style={styles.primaryBtnAction}
                          onPress={() => handleSetPrimary(item.id, item.vpa_address)}
                        >
                          <Text maxFontSizeMultiplier={1.3} style={styles.primaryBtnActionText}>Set as Primary</Text>
                        </AnimatedPress>
                      )}
                      <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Delete" accessibilityRole="button"
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteUpi(item.id, item.vpa_address)}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </AnimatedPress>
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
        <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>Add UPI Handle</Text>
        <OutlinedTextField
          label="Enter UPI ID"
          required
          value={newUpi}
          onChangeText={(v) => {
            setNewUpi(v);
            if (errorMsg) setErrorMsg('');
          }}
          placeholder="propertyowner@okaxis"
          error={errorMsg || undefined}
          helper="This is where residents' rent lands"
          inputStyle={{ fontSize: 14 }}
        />

        <AnimatedPress accessibilityRole="button"
          style={[styles.submitBtn, addMutation.isPending && styles.submitBtnDisabled]}
          onPress={handleAddUpi}
          disabled={addMutation.isPending}
        >
          {addMutation.isPending ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text maxFontSizeMultiplier={1.3} style={styles.submitBtnText}>Add UPI Handle</Text>
          )}
        </AnimatedPress>
      </Col>
    </Col>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    padding: 32,
    alignItems: 'center',
    gap: 8 },
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
    padding: 16 },
  upiCardPrimary: {
    borderColor: '#C6E8D4' },
  statusDotWrapper: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center' },
  vpaText: { fontSize: 14, fontWeight: '700', color: CHARCOAL },
  statusLabel: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 2 },
  statusLabelActive: { color: GREEN },

  // Actions
  primaryBtnAction: {
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.control },
  primaryBtnActionText: { fontSize: 12, fontWeight: '800', color: WHITE },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.control,
    backgroundColor: Palette.TintRed,
    alignItems: 'center',
    justifyContent: 'center' },

  // Input

  submitBtn: {
    height: 52,
    backgroundColor: GREEN,
    borderRadius: Radii.card,
    alignItems: 'center',
    justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: WHITE },

  // Empty state
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: CHARCOAL, marginTop: 8 },
  emptySubText: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 2 } });
