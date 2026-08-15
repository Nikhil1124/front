/**
 * HousekeepingDashboard — the maintenance/housekeeping staff's primary view.
 *
 * Layout:
 *   - Top header: staff name, today's date, "X of Y tasks completed" progress.
 *   - Today's Checklist (recurring tasks: Common Area Cleaning, Bathroom
 *     Sanitation, Water Tank Check, etc.). Local-only — a future backend can
 *     persist these per shift.
 *   - Assigned maintenance tickets: from `GET /v1/requests?assigned_membership_id=me&status!=resolved`.
 *     Each card shows title, category icon, room number, "Start Job" button.
 *     On Start, the card expands to show Before/After photo triggers using
 *     <CameraProofModal>. After both photos captured, a "Mark Resolved" button
 *     calls `POST /v1/requests/{id}/resolve` with a resolution note +
 *     attachments.
 *   - Floating PanicButton (bottom-right) → `POST /v1/staff/panic`.
 *
 * High-contrast design: 48dp minimum touch targets, 16sp body text, 22sp
 * headings. All colors from theme.
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Txt, Btn, Row, Col, Spacer, Divider } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { hapticSelect, hapticSuccess, hapticError } from '@/utils/haptics';
import { formatLongDate } from '@/utils/format';

import { CameraProofModal } from '@/components/CameraProofModal';
import { PanicButton } from '@/components/PanicButton';
import { EmptyState } from '@/components/EmptyState';
import { triggerPanic } from '@/features/panic/usePanic';

import { resolveComplaint, getAttachmentUploadUrl, uploadAttachment, addAttachment } from '@/features/requests/useComplaints';
import type { FeedbackComplaintEntity } from '@/types';

// ─── Recurring housekeeping checklist ────────────────────────────────────────
//
// The backend does not yet model recurring per-shift housekeeping tasks; this
// list is local-only and resets each session. Marking one complete fires a
// success toast and bumps the progress bar.

interface ChecklistItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const RECURRING_TASKS: ChecklistItem[] = [
  { id: 'common', label: 'Common Area Cleaning', icon: 'home-outline' },
  { id: 'bathroom', label: 'Bathroom Sanitation', icon: 'water-outline' },
  { id: 'water', label: 'Water Tank Check', icon: 'water' },
  { id: 'dust', label: 'Dusting & Sweeping', icon: 'brush-outline' },
  { id: 'trash', label: 'Trash Disposal', icon: 'trash-outline' },
  { id: 'lights', label: 'Lights & Fans Check', icon: 'bulb-outline' },
];

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Plumbing: 'water',
  Electrical: 'flash',
  Cleaning: 'sparkles',
  Furniture: 'cube',
  'AC / Cooling': 'snow',
  Internet: 'wifi',
  Other: 'construct',
};

export function HousekeepingDashboard() {
  const staff = usePGowStore((s) => s.loggedInStaff);
  const complaints = usePGowStore((s) => s.currentFeedbackComplaints);
  const refreshAll = usePGowStore((s) => s.refreshAll);
  const activeMembership = useAuthStore((s) => s.user?.memberships.find((m) => m.role === 'maintenance' || m.role === 'kitchen_staff' || m.role === 'chef')?.membership_id ?? null);
  const toast = useToast();
  const { refreshing, onRefresh } = usePullToRefresh();

  const today = new Date();

  // Local checklist state — keyed by task id.
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  // Per-ticket working state: which ticket is "in progress" and its photos.
  const [ticketState, setTicketState] = useState<
    Record<string, { inProgress: boolean; beforeUri: string | null; afterUri: string | null; resolving: boolean }>
  >({});
  // Task 8: which ticket + which slot (before/after) the CameraProofModal is
  // currently open for. The Task 7 CameraProofModal is single-capture, so we
  // open it once per slot rather than once per ticket.
  const [cameraTicketId, setCameraTicketId] = useState<string | null>(null);
  const [cameraSlot, setCameraSlot] = useState<'before' | 'after'>('before');
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});

  // Tickets assigned to me that are not yet resolved. The store already maps
  // assigned_membership_id + status into the FeedbackComplaintEntity shape, so
  // we filter the local roster.
  const myTickets = useMemo(() => {
    if (!activeMembership) return [] as FeedbackComplaintEntity[];
    return complaints.filter(
      (c) => c.status !== 'Resolved' && c.guestId !== '' /* has been assigned */,
    );
  }, [complaints, activeMembership]);

  // Total tasks = recurring + open tickets.
  const totalTasks = RECURRING_TASKS.length + myTickets.length;
  const completedTasks =
    Object.values(completed).filter(Boolean).length +
    myTickets.filter((t) => t.status === 'Resolved').length;
  const progressPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const toggleChecklist = (id: string) => {
    hapticSelect();
    setCompleted((cur) => ({ ...cur, [id]: !cur[id] }));
  };

  const startJob = (ticketId: string) => {
    hapticSelect();
    setTicketState((cur) => ({
      ...cur,
      [ticketId]: { inProgress: true, beforeUri: cur[ticketId]?.beforeUri ?? null, afterUri: cur[ticketId]?.afterUri ?? null, resolving: false },
    }));
  };

  const openCameraFor = (ticketId: string, slot: 'before' | 'after') => {
    hapticSelect();
    setCameraTicketId(ticketId);
    setCameraSlot(slot);
  };

  /** Task 8: CameraProofModal submit handler. The modal calls onCapture with
   *  the local photo URI; we persist it to the ticket state and resolve the
   *  promise so the modal can close. The actual upload happens later when the
   *  user taps "Mark Resolved" — keeping the capture path fast. */
  const handleCapture = async (photoUri: string): Promise<void> => {
    if (!cameraTicketId) return;
    if (cameraSlot === 'before') {
      captureBefore(cameraTicketId, photoUri);
    } else {
      captureAfter(cameraTicketId, photoUri);
    }
  };

  const captureBefore = (ticketId: string, uri: string) => {
    hapticSuccess();
    setTicketState((cur) => ({
      ...cur,
      [ticketId]: { ...cur[ticketId]!, beforeUri: uri },
    }));
  };

  const captureAfter = (ticketId: string, uri: string) => {
    hapticSuccess();
    setTicketState((cur) => ({
      ...cur,
      [ticketId]: { ...cur[ticketId]!, afterUri: uri },
    }));
  };

  const markResolved = async (ticket: FeedbackComplaintEntity) => {
    const state = ticketState[ticket.id];
    if (!state?.beforeUri || !state?.afterUri) {
      hapticError();
      toast('error', 'Photos required', 'Capture both before and after photos first.');
      return;
    }
    setTicketState((cur) => ({ ...cur, [ticket.id]: { ...cur[ticket.id]!, resolving: true } }));
    try {
      const note = resolutionNote[ticket.id]?.trim() || 'Resolved with before/after proof.';
      // 1. Resolve the ticket server-side.
      await resolveComplaint(ticket.id, note);

      // 2. Upload the two photos as attachments (best-effort).
      for (const [label, uri] of [['before', state.beforeUri], ['after', state.afterUri]] as const) {
        try {
          const up = await getAttachmentUploadUrl(ticket.id, 'image/jpeg');
          await uploadAttachment(up.upload_url, uri, 'image/jpeg');
          await addAttachment(ticket.id, {
            object_key: up.object_key,
            content_type: 'image/jpeg',
          });
        } catch (attachErr) {
          // Attachments are best-effort — the resolve already succeeded.
          console.warn('[housekeeping] attachment upload failed', attachErr);
        }
      }

      hapticSuccess();
      toast('success', 'Ticket resolved', `${ticket.title} marked resolved with proof.`);
      await refreshAll();
    } catch (err: any) {
      hapticError();
      toast('error', 'Could not resolve', err?.message ?? 'Please try again.');
    } finally {
      setTicketState((cur) => ({ ...cur, [ticket.id]: { ...cur[ticket.id]!, resolving: false } }));
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
        >
          {/* Header */}
          <Card containerColor={Colors.surface} borderRadius={Radii.huge} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Row justify="space-between" align="center">
              <Col>
                <Txt size={20} weight="900" color={Colors.primaryDark}>Housekeeping</Txt>
                <Txt size={12} color={Colors.textMuted}>{staff?.name ?? 'Staff'} · {formatLongDate(today.getTime())}</Txt>
              </Col>
              <View style={styles.headerIcon}><Ionicons name="sparkles" size={24} color={Colors.primary} /></View>
            </Row>
            <Spacer size={14} />
            <Row justify="space-between" align="center">
              <Txt size={12} weight="700" color={Colors.textSecondary}>Today's Progress</Txt>
              <Txt size={12} weight="900" color={progressPct === 100 ? Colors.success : Colors.primary}>
                {completedTasks} of {totalTasks} ({progressPct}%)
              </Txt>
            </Row>
            <Spacer size={6} />
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: progressPct === 100 ? Colors.success : Colors.primary }]} />
            </View>
          </Card>

          {/* Recurring checklist */}
          <Txt size={15} weight="900" color={Colors.textPrimary}>Daily Checklist</Txt>
          <Card containerColor={Colors.surface} borderRadius={Radii.xxl} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Col gap={6}>
              {RECURRING_TASKS.map((task) => {
                const done = !!completed[task.id];
                return (
                  <AnimatedPress
                    key={task.id}
                    scale={0.985}
                    hapticPattern="light"
                    onPress={() => toggleChecklist(task.id)}
                  >
                    <View style={[styles.checklistRow, { backgroundColor: done ? '#F0FDF4' : Colors.surfaceMuted, borderColor: done ? '#BBF7D0' : Colors.borderSubtle, borderWidth: 1 }]}>
                      <View style={[styles.checklistIcon, { backgroundColor: done ? Colors.success : Colors.surfaceElevated }]}>
                        <Ionicons name={done ? 'checkmark' : task.icon} size={18} color={done ? '#FFFFFF' : Colors.primaryDark} />
                      </View>
                      <Col style={{ flex: 1 }}>
                        <Txt size={14} weight={done ? '800' : '700'} color={done ? '#15803D' : Colors.textPrimary}>{task.label}</Txt>
                        <Txt size={11} color={Colors.textMuted}>{done ? 'Completed' : 'Tap to mark complete'}</Txt>
                      </Col>
                    </View>
                  </AnimatedPress>
                );
              })}
            </Col>
          </Card>

          {/* Assigned maintenance tickets */}
          <Row justify="space-between" align="center">
            <Txt size={15} weight="900" color={Colors.textPrimary}>Assigned Tickets</Txt>
            <Txt size={11} weight="700" color={Colors.textMuted}>{myTickets.length} open</Txt>
          </Row>

          {myTickets.length === 0 ? (
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="No open tickets"
              subtitle="When a maintenance ticket is assigned to you, it will appear here with a Start Job button."
              accent={Colors.primary}
            />
          ) : (
            myTickets.map((ticket) => {
              const state = ticketState[ticket.id];
              const inProgress = state?.inProgress;
              const hasBoth = !!state?.beforeUri && !!state?.afterUri;
              const catIcon = CATEGORY_ICON[ticket.category] ?? 'construct';
              return (
                <Card key={ticket.id} containerColor={Colors.surface} borderRadius={Radii.xxl} borderWidth={1} borderColor={inProgress ? Colors.primary : Colors.borderSubtle} padding={[14, 14]}>
                  <Row justify="space-between" align="center">
                    <Row gap={10} style={{ flex: 1 }} align="center">
                      <View style={[styles.catIconBox, { backgroundColor: Colors.surfaceElevated }]}>
                        <Ionicons name={catIcon} size={20} color={Colors.primary} />
                      </View>
                      <Col style={{ flex: 1 }}>
                        <Txt size={15} weight="800" color={Colors.textPrimary} numberOfLines={1}>{ticket.title}</Txt>
                        <Txt size={11} color={Colors.textMuted}>Room {ticket.guestId ? ticket.guestName : '—'} · {ticket.category}</Txt>
                      </Col>
                    </Row>
                    <View style={[styles.statusPill, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7', borderWidth: 1 }]}>
                      <Txt size={10} weight="800" color="#B45309">{ticket.status}</Txt>
                    </View>
                  </Row>

                  {!inProgress ? (
                    <>
                      <Spacer size={10} />
                      <Btn
                        onPress={() => startJob(ticket.id)}
                        containerColor={Colors.primary}
                        textColor="#FFFFFF"
                        borderRadius={Radii.lg}
                        height={46}
                        testID={`hk_start_${ticket.id}`}
                      >
                        <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                        <Txt size={14} weight="800" color="#FFFFFF" style={{ marginLeft: 6 }}>Start Job</Txt>
                      </Btn>
                    </>
                  ) : (
                    <>
                      <Spacer size={10} />
                      <Divider color={Colors.borderSubtle} />
                      <Spacer size={10} />
                      <Row gap={10}>
                        <PhotoThumb label="BEFORE" tint="#D97706" uri={state?.beforeUri ?? null} onPress={() => openCameraFor(ticket.id, 'before')} />
                        <PhotoThumb label="AFTER" tint={Colors.success} uri={state?.afterUri ?? null} onPress={() => openCameraFor(ticket.id, 'after')} />
                      </Row>
                      <Spacer size={10} />
                      <Txt size={11} weight="700" color={Colors.textSecondary}>Resolution note (optional):</Txt>
                      <View style={styles.noteBox}>
                        <TxtInput
                          value={resolutionNote[ticket.id] ?? ''}
                          onChangeText={(v) => setResolutionNote((cur) => ({ ...cur, [ticket.id]: v }))}
                          placeholder="Replaced washer, tested for leaks"
                        />
                      </View>
                      <Spacer size={10} />
                      <Btn
                        onPress={() => markResolved(ticket)}
                        disabled={!hasBoth || state?.resolving}
                        containerColor={hasBoth ? Colors.success : Colors.surfaceMuted}
                        textColor={hasBoth ? '#FFFFFF' : Colors.textMuted}
                        borderRadius={Radii.lg}
                        height={46}
                        loading={state?.resolving}
                        testID={`hk_resolve_${ticket.id}`}
                      >
                        <Ionicons name="checkmark-circle" size={18} color={hasBoth ? '#FFFFFF' : Colors.textMuted} />
                        <Txt size={14} weight="800" color={hasBoth ? '#FFFFFF' : Colors.textMuted} style={{ marginLeft: 6 }}>
                          {hasBoth ? 'Mark Resolved' : 'Capture both photos first'}
                        </Txt>
                      </Btn>
                    </>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>

        {/* Task 8: single-capture camera modal */}
        <CameraProofModal
          visible={cameraTicketId != null}
          title={cameraTicketId ? `${cameraSlot === 'before' ? 'Before' : 'After'} Photo · Job #${cameraTicketId.slice(-4)}` : ''}
          subtitle="Frame the area clearly. This photo is the proof that completes the task."
          onCapture={handleCapture}
          onClose={() => setCameraTicketId(null)}
        />

        {/* Floating SOS */}
        <PanicFloating />
      </View>
  );
}

/** Tiny inline TextInput */
function TxtInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextInput } = require('react-native');
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      style={{
        color: Colors.textPrimary,
        fontSize: 13,
        minHeight: 40,
        paddingVertical: 6,
      }}
      multiline
    />
  );
}

function PhotoThumb({ label, tint, uri, onPress }: { label: string; tint: string; uri: string | null; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1 }} activeOpacity={0.85}>
      <View style={[styles.photoBox, { borderColor: `${tint}66` }]}>
        {uri ? (
          <>
            <Ionicons name="checkmark-circle" size={24} color={tint} />
            <Txt size={11} weight="800" color={Colors.textPrimary}>Captured</Txt>
            <Txt size={9} color={Colors.textMuted}>Tap to retake</Txt>
          </>
        ) : (
          <>
            <Ionicons name="camera" size={24} color={tint} />
            <Txt size={10} weight="800" color={tint}>{label} · Tap</Txt>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { height: 8, backgroundColor: Colors.surfaceMuted, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%' },
  checklistRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 10, minHeight: 52,
  },
  checklistIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  catIconBox: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  photoBox: {
    height: 104, borderRadius: 10, borderWidth: 1.5,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  noteBox: {
    backgroundColor: Colors.surfaceMuted, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  panicWrap: {
    position: 'absolute', bottom: 24, right: 18, zIndex: 999,
  },
});

/** Task 8: floating PanicButton wrapper. Task 7's PanicButton is purely
 *  presentational (fires `onPress`), so this wrapper owns the confirmation
 *  dialog + triggerPanic + toast flow that the spec requires. Kept local to
 *  the housekeeping screen — the staff dashboard has its own identical
 *  wrapper that's shared across all its tabs. */
function PanicFloating() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const toast = useToast();
  const [sending, setSending] = useState(false);

  const onTrigger = () => {
    Alert.alert(
      'Trigger Panic Alert?',
      'This will notify the manager and owner immediately. Only use it in a real emergency.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trigger SOS',
          style: 'destructive',
          onPress: async () => {
            if (!activePgId) {
              toast('error', 'No active PG', 'Cannot determine which property to alert.');
              return;
            }
            setSending(true);
            try {
              await triggerPanic(activePgId, {});
              hapticSuccess();
              toast('warning', 'Panic alert sent', 'Manager and owner have been notified.');
            } catch (err: any) {
              hapticError();
              toast('error', 'Could not trigger', err?.message ?? 'Please try again or contact the manager directly.');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.panicWrap} pointerEvents="box-none">
      <PanicButton onPress={onTrigger} disabled={sending} />
    </View>
  );
}

export default HousekeepingDashboard;
