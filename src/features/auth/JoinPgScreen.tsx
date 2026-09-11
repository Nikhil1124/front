/**
 * Join a PG with the code from the lobby poster.
 *
 * Replaces a six-field form living inside a four-tab login screen. Two rules drove the shape:
 *
 * **Never taller than the screen.** Answered steps collapse to a single tappable line, so the
 * form does not grow as it is filled and the keyboard cannot push the active field out of
 * view — which is the actual reason long forms scroll badly on a phone, not the field count.
 *
 * **Pick, never type, when the answer set is knowable.** The room used to be a text box, and
 * `POST /guests/join` takes `room_no` as a free string it never validates — so a typo created
 * a real resident in a room that does not exist, invisible until somebody went looking. The
 * code now resolves through `GET /pgs/join-preview/{code}` first, which names the property and
 * returns its rooms, so the room becomes a picker and the joiner can confirm they are joining
 * the right PG before typing anything about themselves.
 *
 * Email is genuinely optional — it is `Email | None` on `JoinPgRequest` and the old form's
 * asterisk was simply wrong.
 */
import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { FormScroll } from '@/components/ui/FormScroll';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Radii } from '@/theme';
import { useToast } from '@/hooks/useToast';
import { fetchJoinPreview, joinPg, type JoinPreview } from '@/features/guests/useGuests';
import { useTokenLanding } from '@/features/auth/useAuth';
import { PGowApiError } from '@/data/apiClient';
import * as map from '@/data/mappers';
import { QrScanner } from '@/features/auth/QrScanner';
import { Btn, Row, Spacer, StatusChip, Txt } from '@/components/ui';

type Step = 'code' | 'room' | 'you';

export function JoinPgScreen({ initialCode }: { initialCode?: string } = {}) {
  const land = useTokenLanding();
  const toast = useToast();

  const [step, setStep] = useState<Step>('code');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [code, setCode] = useState((initialCode ?? '').toUpperCase());
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // A deep-linked code is already "entered" — resolve it once on mount so the joiner lands on
  // the room picker rather than on a pre-filled field they have to confirm.
  const resolvedOnce = useRef(false);
  useEffect(() => {
    if (initialCode && !resolvedOnce.current) {
      resolvedOnce.current = true;
      void resolveCode(initialCode);
    }
  }, [initialCode]);

  const resolveCode = async (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('That code looks too short. Check the poster and try again.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const found = await fetchJoinPreview(trimmed);
      setCode(trimmed);
      setPreview(found);
      setStep(found.rooms.length ? 'room' : 'you');
    } catch (err) {
      // `pg_for_join_code` is deliberately vague about which codes exist, so this message is
      // too — repeating the server's distinction would make the form an enumeration oracle.
      setError(
        err instanceof PGowApiError && err.httpStatus === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : 'We could not find a PG with that code.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Enter your name and phone number.');
      return;
    }
    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.');
      return;
    }
    if (!room.trim()) {
      setError('Pick your room.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const tokens = await joinPg({
        join_code: code,
        name: name.trim(),
        phone: map.toE164(phone),
        password,
        room_no: room.trim(),
        email: email.trim().toLowerCase() || undefined,
      });
      await land(tokens);
      toast('success', `Joined ${preview?.name ?? 'your PG'}`, 'Your profile is being set up.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the join.');
    } finally {
      setBusy(false);
    }
  };

  if (scanning) {
    return (
      <QrScanner
        onCancel={() => setScanning(false)}
        onScanned={(value) => { setScanning(false); resolveCode(value); }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AnimatedPress
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </AnimatedPress>
        <Spacer size={14} />
        <Txt size={11} color={Colors.textMuted}>
          {preview ? preview.formatted_address : 'Use the code on your lobby poster'}
        </Txt>
        <Txt size={21} weight="700" color={Colors.textPrimary}>
          {preview ? preview.name : 'Join a PG'}
        </Txt>
      </View>

      {/* Was a plain `<View>`: five fields, a QR scanner and a password field with no scroll
          container at all. On an edge-to-edge Android window the IME does not resize the
          window, so focusing the password field covered the submit button with nothing to
          scroll — on the resident's first-run join flow. FormScroll reserves the covered
          space as content padding. */}
      <FormScroll contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* ── 1. The code ────────────────────────────────────────────────── */}
          {step === 'code' ? (
            <View style={styles.pad}>
              <Txt size={13} weight="700" color={Colors.textPrimary}>What is your PG code?</Txt>
              <Spacer size={12} />
              <OutlinedTextField
                label="PG code"
                placeholder="DZQP9899"
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                textContentType="oneTimeCode"
                autoComplete="off"
                testID="join_code"
              />
              <Spacer size={10} />
              <Btn onPress={() => setScanning(true)} containerColor={Colors.surfaceElevated} height={46} borderRadius={Radii.control}>
                <Row gap={7} align="center">
                  <Ionicons name="qr-code-outline" size={17} color={Colors.primary} />
                  <Txt size={13} weight="700" color={Colors.primary}>Scan the QR instead</Txt>
                </Row>
              </Btn>
            </View>
          ) : (
            <StepDone label="PG code" value={code} onChange={() => { setStep('code'); setPreview(null); }} />
          )}

          {/* ── 2. The room ────────────────────────────────────────────────── */}
          {preview && preview.rooms.length > 0 && (
            step === 'room' ? (
              <>
                <View style={styles.sep} />
                <View style={styles.pad}>
                  <Txt size={13} weight="700" color={Colors.textPrimary}>Which room are you in?</Txt>
                  <Spacer size={10} />
                  <Row gap={7} style={styles.wrap}>
                    {preview.rooms.map((r) => (
                      <AnimatedPress
                        key={r.room_number}
                        onPress={() => { setRoom(r.room_number); setStep('you'); }}
                        accessibilityLabel={`Room ${r.room_number}, ${r.sharing_type} sharing${r.has_vacancy ? '' : ', full'}`}
                        style={[styles.roomChip, !r.has_vacancy && styles.roomChipFull]}
                      >
                        <Txt size={12.5} weight="700" color={r.has_vacancy ? Colors.textPrimary : Colors.textMuted}>
                          {r.room_number}
                        </Txt>
                        <Txt size={9.5} color={Colors.textMuted}>
                          {r.has_vacancy ? `${r.sharing_type} sharing` : 'Full'}
                        </Txt>
                      </AnimatedPress>
                    ))}
                  </Row>
                </View>
              </>
            ) : room ? (
              <>
                <View style={styles.sep} />
                <StepDone label="Room" value={room} onChange={() => setStep('room')} />
              </>
            ) : null
          )}

          {/* ── 3. You ─────────────────────────────────────────────────────── */}
          {step === 'you' && (
            <>
              <View style={styles.sep} />
              <View style={styles.pad}>
                <Txt size={13} weight="700" color={Colors.textPrimary}>About you</Txt>
                <Spacer size={12} />
                <OutlinedTextField
                  label="Full name"
                  value={name}
                  onChangeText={setName}
                  textContentType="name"
                  autoComplete="name"
                  testID="join_name"
                />
                <Spacer size={10} />
                <OutlinedTextField
                  label="Phone number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  testID="join_phone"
                />
                <Spacer size={10} />
                <OutlinedTextField
                  label="Email (optional)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                />
                <Spacer size={10} />
                <OutlinedTextField
                  label="Password (min 8)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="newPassword"
                  autoComplete="new-password"
                  testID="join_password"
                />
              </View>
            </>
          )}
        </View>

        {error ? <Txt size={12} color={Colors.danger} style={{ marginTop: 10 }}>{error}</Txt> : null}

        <Spacer size={14} />
        {step === 'code' ? (
          <Btn onPress={() => resolveCode(code)} loading={busy} height={52} borderRadius={Radii.card} testID="join_continue">
            <Txt size={15} weight="700" color={Colors.textInverse}>Continue</Txt>
          </Btn>
        ) : step === 'you' ? (
          <Btn onPress={submit} loading={busy} height={52} borderRadius={Radii.card} testID="join_submit">
            <Txt size={15} weight="700" color={Colors.textInverse}>Join {preview?.name ?? 'this PG'}</Txt>
          </Btn>
        ) : null}
      </FormScroll>
    </View>
  );
}

/** An answered step: one line stating what was chosen, tappable to change it. */
function StepDone({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <AnimatedPress onPress={onChange} style={styles.doneRow} accessibilityLabel={`${label}: ${value}. Change`}>
      <StatusChip label="Done" tone="ok" variant="dot" />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Txt size={10} color={Colors.textMuted}>{label}</Txt>
        <Txt size={13} weight="700" color={Colors.textPrimary}>{value}</Txt>
      </View>
      <Txt size={11.5} weight="700" color={Colors.primary}>Change</Txt>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14 },
  // `flex: 1` here would pin the content to the viewport and defeat scrolling now that
  // this is a contentContainerStyle rather than a View's own style.
  body: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  pad: { padding: 14 },
  sep: { height: 1, backgroundColor: Colors.surfaceElevated },
  doneRow: { flexDirection: 'row', alignItems: 'center', padding: 14, minHeight: 56 },
  wrap: { flexWrap: 'wrap' },
  roomChip: {
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radii.control,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
  },
  roomChipFull: { opacity: 0.45 },
});
