/**
 * UpiConfigSection — Owner's UPI handle list: add, remove, set primary.
 * Shared between the "UPI Settings" quick-action screen and the Settings
 * tab so both entry points stay in sync with one implementation.
 */
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer, IconBtn } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useToast } from '@/hooks/useToast';
import { hapticSuccess, hapticError } from '@/utils/haptics';

export function UpiConfigSection() {
  const owner = usePGowStore((s) => s.loggedInOwner);
  const toast = useToast();
  const [upiList, setUpiList] = useState<string[]>(['pgowowner@ybl', 'hostelcollection@icici']);
  const [activeUpi, setActiveUpi] = useState(owner?.upiId || 'pgowowner@ybl');
  const [newUpi, setNewUpi] = useState('');

  const handleAddUpi = () => {
    const trimmed = newUpi.trim();
    if (!trimmed.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI VPA handle containing @ (e.g. owner@okaxis).');
      return;
    }
    if (upiList.includes(trimmed)) {
      Alert.alert('Duplicate UPI', 'This UPI handle is already in your account list.');
      return;
    }
    const updated = [...upiList, trimmed];
    setUpiList(updated);
    setActiveUpi(trimmed);
    if (owner) {
      owner.upiId = trimmed;
    }
    setNewUpi('');
    hapticSuccess();
    toast('success', 'UPI Activated', `"${trimmed}" is now set as the primary rent collection handle!`);
  };

  const handleDeleteUpi = (handle: string) => {
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
          onPress: () => {
            const updated = upiList.filter((u) => u !== handle);
            setUpiList(updated);
            if (activeUpi === handle) {
              const fallback = updated[0];
              setActiveUpi(fallback);
              if (owner) owner.upiId = fallback;
            }
            hapticError();
            toast('info', 'UPI Deleted', `Removed "${handle}" from your payment methods.`);
          },
        },
      ],
    );
  };

  const handleSetPrimary = (handle: string) => {
    setActiveUpi(handle);
    if (owner) owner.upiId = handle;
    hapticSuccess();
    toast('success', 'Primary UPI Updated', `Rent transfers will now route to ${handle}`);
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

      {/* UPI Handles List */}
      <View style={{ gap: 8 }}>
        {upiList.map((handle) => {
          const isPrimary = activeUpi === handle;
          return (
            <Card
              key={handle}
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
                    <Txt variant="body" weight="800" color={Colors.textPrimary}>{handle}</Txt>
                    <Txt variant="labelSmall" weight="400" color={isPrimary ? '#047857' : Colors.textMuted}>
                      {isPrimary ? '● ACTIVE PRIMARY HANDLE' : 'Secondary Handle'}
                    </Txt>
                  </Col>
                </Row>
                <Row gap={6} align="center">
                  {!isPrimary && (
                    <Btn
                      onPress={() => handleSetPrimary(handle)}
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
                    onPress={() => handleDeleteUpi(handle)}
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
        containerColor={Colors.primary}
        textColor={Colors.textInverse}
        borderRadius={10}
        height={40}
      >
        <Txt variant="caption" weight="800" color={Colors.textInverse}>+ Add & Activate New UPI Handle</Txt>
      </Btn>
    </Card>
  );
}
