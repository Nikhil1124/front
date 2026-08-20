/**
 * Self sign-up: the code residents type to add themselves.
 *
 * Sits directly above "Create New Guest ID" deliberately. That is the moment the owner is
 * about to type somebody in by hand, which is exactly when the alternative is worth knowing
 * about — a settings screen they never open is where this feature would go to die.
 *
 * Two states, because the feature is off until an owner turns it on: that is the safe
 * default, since possession of the code is what lets a stranger create an account here.
 */
import { useState } from 'react';
import { Alert, Share, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { useActiveProperty } from '@/features/properties/useProperties';
import { usePGowStore } from '@/store/usePGowStore';
import { useIsManagerMode } from '@/store/authStore';
import { Colors } from '@/theme';

export function JoinCodeCard() {
  const { activeEntity: pg } = useActiveProperty();
  const isManagerMode = useIsManagerMode();
  const rotateJoinCode = usePGowStore((s) => s.rotateJoinCode);
  const disableJoinCode = usePGowStore((s) => s.disableJoinCode);
  const setDefaultRent = usePGowStore((s) => s.setDefaultRent);

  const [rentInput, setRentInput] = useState('6500');
  const [busy, setBusy] = useState(false);

  if (!pg) return null;

  const code = pg.joinCode;
  const rent = pg.defaultRentAmount;
  // The server refuses a join until the owner has said what a self-joined resident pays, so
  // a code without a rent figure is a door that looks open and is not.
  const rentMissing = !!code && rent <= 0;

  const guard = async (run: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(true);
    const result = await run();
    setBusy(false);
    if (!result.ok) Alert.alert('Failed', result.error ?? 'Something went wrong.');
    return result;
  };

  const handleEnable = async () => {
    const amount = parseFloat(rentInput);
    if (!(amount > 0)) {
      Alert.alert('Set the rent first', 'Enter the monthly rent a new resident should be put on.');
      return;
    }
    // Rent before code, so the door is never open with nothing behind it.
    const saved = await guard(() => setDefaultRent(amount));
    if (!saved?.ok) return;
    await guard(rotateJoinCode);
  };

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', `Code ${code} is on your clipboard.`);
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message:
          `Join ${pg.pgName} on PGow.\n\nCode: ${code}\n\n` +
          'Open the app, choose "Join PG", and enter this code with your details.',
      });
    } catch {
      // The user dismissed the sheet. Nothing to report.
    }
  };

  const handleRotate = () => {
    // Rotation IS revocation — there is one code per property. Anyone holding a printed or
    // forwarded copy loses access the moment this runs, so it is worth one confirmation.
    Alert.alert(
      'Replace the code?',
      'Anyone holding the current code — printed, photographed or forwarded — will no longer '
        + 'be able to join. Residents who already joined are unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => guard(rotateJoinCode),
        },
      ]
    );
  };

  const handleDisable = () => {
    Alert.alert(
      'Turn off self sign-up?',
      'New residents will have to be added by you again. Everyone already here keeps their account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn off', style: 'destructive', onPress: () => guard(disableJoinCode) },
      ]
    );
  };

  return (
    <Card
      containerColor={Colors.LuxurySurfaceDark}
      borderRadius={12}
      borderWidth={1}
      borderColor={code ? 'rgba(20,226,177,0.35)' : Colors.LuxuryCardBorder}
      padding={[16, 16]}
    >
      <Row align="center" gap={8}>
        <Ionicons name="qr-code" size={18} color={Colors.CyberGreen} />
        <Txt variant="cardTitle" color={Colors.CyberGreen}>
          Resident Self Sign-Up
        </Txt>
      </Row>
      <Spacer size={4} />
      <Txt variant="caption" color={Colors.SlateMutedText}>
        {code
          ? 'Residents who enter this code create their own account. You still verify their KYC before they can do anything.'
          : 'Share one code instead of typing every resident in yourself. Off until you turn it on.'}
      </Txt>

      {code ? (
        <>
          <Spacer size={12} />
          <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={styles.codeBox}>
            <Col>
              <Txt variant="labelSmall" color={Colors.SlateMutedText} style={styles.label}>
                PROPERTY CODE
              </Txt>
              <Txt variant="statValue" size={26} weight="900" color={Colors.IvoryWhiteText} style={styles.code}>
                {code}
              </Txt>
            </Col>
            <Ionicons name="copy-outline" size={20} color={Colors.CyberGreen} />
          </TouchableOpacity>

          {rentMissing && (
            <>
              <Spacer size={8} />
              <Txt variant="caption" weight="700" color={Colors.CyberAmber}>
                ⚠️ Set a monthly rent below — sign-ups are refused until you do.
              </Txt>
            </>
          )}

          <Spacer size={10} />
          <Row align="center" justify="space-between">
            <Txt variant="caption" color={Colors.SlateMutedText}>
              New residents start on
            </Txt>
            <Txt variant="body" weight="700" color={Colors.IvoryWhiteText}>
              {rent > 0 ? `₹${rent.toLocaleString('en-IN')} / month` : 'Not set'}
            </Txt>
          </Row>

          {!isManagerMode && (
            <>
              <Spacer size={12} />
              <Row gap={8}>
                <OutlinedTextField
                  label="Change monthly rent (₹)"
                  value={rentInput}
                  onChangeText={setRentInput}
                  keyboardType="number-pad"
                  testID="join_code_rent_input"
                  style={{ flex: 1 }}
                />
                <OutlinedBtn
                  onPress={() => guard(() => setDefaultRent(parseFloat(rentInput)))}
                  borderColor={Colors.CyberGreen}
                  textColor={Colors.CyberGreen}
                  borderRadius={10}
                  height={48}
                  style={{ width: 88 }}
                >
                  <Txt variant="caption" weight="700" color={Colors.CyberGreen}>
                    Save
                  </Txt>
                </OutlinedBtn>
              </Row>
            </>
          )}

          <Spacer size={12} />
          <Row gap={8}>
            <Btn
              onPress={handleShare}
              containerColor={Colors.CyberGreen}
              textColor={Colors.LuxuryPureBlack}
              borderRadius={10}
              height={40}
              style={{ flex: 1 }}
              testID="join_code_share_btn"
            >
              <Ionicons name="share-social" size={15} color={Colors.LuxuryPureBlack} />
              <Txt variant="caption" weight="700" color={Colors.LuxuryPureBlack} style={{ marginLeft: 6 }}>
                Share
              </Txt>
            </Btn>
            {!isManagerMode && (
              <OutlinedBtn
                onPress={handleRotate}
                borderColor={Colors.LuxuryCardBorder}
                textColor={Colors.SlateMutedText}
                borderRadius={10}
                height={40}
                style={{ flex: 1 }}
                testID="join_code_rotate_btn"
              >
                <Txt variant="caption" weight="700" color={Colors.SlateMutedText}>
                  New code
                </Txt>
              </OutlinedBtn>
            )}
          </Row>

          {!isManagerMode && (
            <>
              <Spacer size={8} />
              <TouchableOpacity onPress={handleDisable} testID="join_code_disable_btn">
                <Txt variant="caption" weight="700" color={Colors.CyberPink} align="center">
                  Turn off self sign-up
                </Txt>
              </TouchableOpacity>
            </>
          )}
        </>
      ) : (
        !isManagerMode && (
          <>
            <Spacer size={12} />
            <OutlinedTextField
              label="Monthly rent for new residents (₹) *"
              placeholder="6500"
              value={rentInput}
              onChangeText={setRentInput}
              keyboardType="number-pad"
              testID="join_code_initial_rent_input"
              style={{ marginBottom: 12 }}
            />
            <Btn
              onPress={handleEnable}
              containerColor={Colors.CyberGreen}
              textColor={Colors.LuxuryPureBlack}
              borderRadius={10}
              height={44}
              testID="join_code_enable_btn"
            >
              <Ionicons name="key" size={16} color={Colors.LuxuryPureBlack} />
              <Txt variant="body" weight="700" color={Colors.LuxuryPureBlack} style={{ marginLeft: 8 }}>
                Turn on self sign-up
              </Txt>
            </Btn>
          </>
        )
      )}

      {isManagerMode && !code && (
        <>
          <Spacer size={8} />
          <Txt variant="caption" color={Colors.SlateMutedText}>
            Only the owner can turn this on.
          </Txt>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(20,226,177,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(20,226,177,0.35)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  label: { letterSpacing: 0.5 },
  // Wide tracking because this gets read aloud and typed from a poster; tight digits are
  // where "8" and "B" start costing support calls.
  code: { letterSpacing: 4 },
});
