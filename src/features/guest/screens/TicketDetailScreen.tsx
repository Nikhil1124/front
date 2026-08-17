/**
 * TicketDetailScreen — Resident drill-down for a maintenance/support ticket.
 *
 * Hub-and-Spoke:
 *   Reached from the Guest dashboard's "🛠️ Maintenance Support" tile when a
 *   resident taps an existing ticket in the tracker list.
 *
 *   Renders the four-stage status tracker the spec calls out:
 *     Submitted → Assigned → In Progress → Resolved
 *
 * Cyber Mint:
 *   - HubScreenWrapper for the sticky back header.
 *   - Status tracker is a horizontal stepper with colour-coded dots.
 *   - The complaint body, photo attachment, and admin response are each in
 *     their own surface card so the page reads like an inbox thread rather
 *     than a wall of text.
 */
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Row, Col, Spacer, Pill } from '@/components/ui';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Layout } from '@/theme';
import { formatDateTime } from '@/utils/format';
import type { FeedbackComplaintEntity } from '@/types';

interface Props {
  ticket: FeedbackComplaintEntity;
}

type Stage = 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED';

function stageFromStatus(status: string): Stage {
  const s = (status ?? '').toUpperCase();
  if (s.includes('RESOLV') || s.includes('CLOSE')) return 'RESOLVED';
  if (s.includes('PROGRESS') || s.includes('WORK')) return 'IN_PROGRESS';
  if (s.includes('ASSIGN')) return 'ASSIGNED';
  return 'SUBMITTED';
}

const STAGES: { key: Stage; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'SUBMITTED', label: 'Submitted', icon: 'paper-plane' },
  { key: 'ASSIGNED', label: 'Assigned', icon: 'person-add' },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: 'construct' },
  { key: 'RESOLVED', label: 'Resolved', icon: 'checkmark-circle' },
];

export function TicketDetailScreen({ ticket }: Props) {
  const currentStage = stageFromStatus(ticket.status);
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <HubScreenWrapper
      title={ticket.title || 'Support Ticket'}
      subtitle={`Opened ${formatDateTime(ticket.timestamp)}`}
      icon="arrow-back"
    >
      {/* Status tracker — horizontal stepper */}
      <Card
        containerColor={Colors.surface}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[16, 14]}
      >
        <Txt variant="caption" weight="800" color={Colors.textPrimary} style={{ letterSpacing: 0.5 }}>
          STATUS TRACKER
        </Txt>
        <Spacer size={12} />
        <Row align="flex-start" gap={2}>
          {STAGES.map((stage, idx) => {
            const done = idx <= currentIdx;
            const active = idx === currentIdx;
            const tint = done ? Colors.primary : Colors.textMuted;
            return (
              <View key={stage.key} style={styles.stageWrap}>
                <View style={[styles.stageDot, {
                  backgroundColor: done ? Colors.primary : Colors.surfaceMuted,
                  borderColor: done ? Colors.primary : Colors.borderMuted,
                  transform: [{ scale: active ? 1.15 : 1 }],
                }]}>
                  <Ionicons name={stage.icon} size={14} color={done ? Colors.textInverse : Colors.textMuted} />
                </View>
                <Txt
                  size={9}
                  weight={active ? '800' : '700'}
                  color={tint}
                  align="center"
                  style={{ marginTop: 4, lineHeight: 12 }}
                  numberOfLines={2}
                >
                  {stage.label}
                </Txt>
                {idx < STAGES.length - 1 ? (
                  <View style={[styles.stageConnector, {
                    backgroundColor: idx < currentIdx ? Colors.primary : Colors.borderMuted,
                  }]} />
                ) : null}
              </View>
            );
          })}
        </Row>
      </Card>

      <Spacer size={14} />

      {/* Ticket body */}
      <Card
        containerColor={Colors.surface}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[16, 16]}
      >
        <Row justify="space-between" align="center">
          <Txt variant="body" weight="800" color={Colors.textPrimary}>Ticket Details</Txt>
          <Pill
            label={ticket.category || 'General'}
            color={Colors.primaryDark}
            bg={Colors.surfaceElevated}
          />
        </Row>
        <Spacer size={10} />
        <Txt variant="body" color={Colors.textSecondary} style={{ lineHeight: 19 }}>
          {ticket.description || 'No description provided.'}
        </Txt>
        <Spacer size={10} />
        <Row gap={16}>
          <Row gap={6} align="center">
            <Ionicons name="person" size={12} color={Colors.textMuted} />
            <Txt variant="caption" color={Colors.textMuted}>{ticket.guestName || 'You'}</Txt>
          </Row>
          <Row gap={6} align="center">
            <Ionicons name="time" size={12} color={Colors.textMuted} />
            <Txt variant="caption" color={Colors.textMuted}>{formatDateTime(ticket.timestamp)}</Txt>
          </Row>
        </Row>
      </Card>

      {/* Photo attachment — when present */}
      {ticket.mediaUri ? (
        <>
          <Spacer size={14} />
          <Card containerColor={Colors.surface} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Row gap={8} align="center">
              <Ionicons name="attach" size={16} color={Colors.primary} />
              <Txt variant="body" weight="700" color={Colors.textPrimary}>Photo attachment</Txt>
            </Row>
            <Spacer size={8} />
            <View style={styles.attachmentBox}>
              <Ionicons name="image" size={32} color={Colors.textMuted} />
              <Txt variant="caption" color={Colors.textMuted} style={{ marginTop: 6 }}>Attachment on file</Txt>
            </View>
          </Card>
        </>
      ) : null}

      {/* Admin response — when present */}
      {ticket.adminResponse ? (
        <>
          <Spacer size={14} />
          <Card containerColor={Colors.surfaceElevated} borderRadius={Layout.borderRadiusCard} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Row gap={8} align="center">
              <Ionicons name="chatbubble-ellipses" size={16} color={Colors.primary} />
              <Txt variant="body" weight="700" color={Colors.textPrimary}>Manager response</Txt>
            </Row>
            <Spacer size={8} />
            <Txt variant="caption" color={Colors.textSecondary} style={{ lineHeight: 17 }}>
              {ticket.adminResponse}
            </Txt>
          </Card>
        </>
      ) : null}

      {/* Help / what next */}
      <Spacer size={14} />
      <Card
        containerColor={Colors.surfaceMuted}
        borderRadius={Layout.borderRadiusCard}
        borderWidth={1}
        borderColor={Colors.borderMuted}
        padding={[14, 14]}
      >
        <Row gap={10} align="flex-start">
          <Ionicons name="information-circle" size={18} color={Colors.info} />
          <Col style={{ flex: 1 }}>
            <Txt variant="caption" weight="700" color={Colors.textPrimary}>What happens next?</Txt>
            <Txt variant="caption" color={Colors.textMuted} style={{ lineHeight: 16, marginTop: 2 }}>
              Your ticket has been routed to the property manager. You will receive a notification when a staff member is assigned and again when the issue is resolved.
            </Txt>
          </Col>
        </Row>
      </Card>
    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  stageWrap: {
    flex: 1, alignItems: 'center', position: 'relative',
  },
  stageDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  stageConnector: {
    position: 'absolute',
    top: 13, // centres on the 28px dot
    left: '50%',
    width: '100%', // stretches to the next dot
    height: 2,
    zIndex: 1,
  },
  attachmentBox: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Layout.borderRadiusCard,
    borderWidth: 1, borderColor: Colors.borderMuted, borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});
