/**
 * UpiConfigSection — Owner's UPI handle list: add, remove, set primary.
 * Shared between the "UPI Settings" quick-action screen and the Settings
 * tab so both entry points stay in sync with one implementation.
 *
 * Real data end to end — `GuestPaymentsTab` routes actual rent payments to whichever handle
 * is active here, so this can never fall back to fabricated state.
 */
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const owner = usePGowStore((s) => s.loggedInOwner);
  const pgId = useAuthStore((s) => s.activePgId) ?? owner?.id ?? null;
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
      return;
    }
    Alert.alert(
      'Delete UPI Handle',
      `Are you sure you want to remove "${handle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMutation.mutateAsync(id);
              hapticError();
              toast('info', 'UPI Deleted', `Removed "${handle}" from your payment methods.`);
            } catch (err: any) {
              hapticError();
              toast('error', 'Could not remove UPI', err?.message ?? 'This may still be your active handle — activate another one first.');
            }
          },
        },
      ],
    );
  };

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

      <Spacer size={14} />

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
  );
}
