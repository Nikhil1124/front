/**
 * The laundry provider's job list — their whole working screen.
 *
 * One card per pickup, each showing the property to go to, what is being collected, and the
 * single button for whatever comes next: picked up -> laundry done -> delivered. Order is the
 * server's to enforce, so the card only ever offers one action and never a choice of three.
 *
 * Built on the same primitives as every other staff dashboard — `Card`, `StatusChip`,
 * `FormScroll`, `EmptyState` — rather than a layout of its own, so a provider's screen and a
 * chef's read as the same app.
 */
import { useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/components/EmptyState';
import { FormScroll } from '@/components/ui/FormScroll';
import { useDockScroll } from '@/components/HeadlessDockTabButton';
import { AnimatedPress, Btn, Card, Col, Row, Spacer, StatusChip, Txt, toneFor } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { Colors, Radii } from '@/theme';
import { formatINR } from '@/utils/format';
import { openInMaps } from '@/utils/maps';
import type { RequestRecord } from '@/features/requests/useComplaints';
import {
  NEXT_STAGE_LABEL,
  STAGE_LABEL,
  nextStageAfter,
  stageOf,
  useAdvanceLaundryStage,
  useLaundryJobsQuery,
  type LaundryStage,
} from './useLaundryProvider';

/**
 * Theirs to work on.
 *
 * `GET /v1/requests/escalated` returns everything in the provider's AREA, which includes
 * bookings still sitting with the area manager waiting to be handed out — those are not this
 * provider's, and showing them would offer a "Mark picked up" the server would refuse.
 * `assigned_role` is what distinguishes the two; it reads `area_manager` until a provider is
 * picked.
 */
function isMine(job: RequestRecord): boolean {
  return job.assigned_role === 'laundry_provider';
}

function isOpen(job: RequestRecord): boolean {
  return job.status !== 'resolved' && job.status !== 'cancelled';
}

export function LaundryProviderJobsScreen({ history = false }: { history?: boolean }) {
  const dockScroll = useDockScroll();
  const toast = useToast();
  const { data: jobs = [], isLoading, error, refetch, isRefetching } = useLaundryJobsQuery();
  const advance = useAdvanceLaundryStage();

  const shown = useMemo(
    () => jobs.filter((j) => isMine(j) && (history ? !isOpen(j) : isOpen(j))),
    [jobs, history],
  );

  const run = (job: RequestRecord, stage: LaundryStage) => {
    advance.mutate(
      { requestId: job.id, stage },
      {
        onSuccess: () => toast('success', STAGE_LABEL[stage], job.title),
        onError: (err) =>
          toast('error', 'Could not update', err instanceof Error ? err.message : 'Please try again.'),
      },
    );
  };

  return (
    <FormScroll
      {...dockScroll}
      contentContainerStyle={styles.body}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
    >
      {shown.length === 0 ? (
        <EmptyState
          icon="shirt-outline"
          title={history ? 'Nothing finished yet' : 'No pickups assigned'}
          subtitle={
            history
              ? 'Jobs you have delivered will be listed here.'
              : 'When your area manager assigns you a laundry pickup it appears here.'
          }
          accent={Colors.primary}
          loading={isLoading}
          error={error}
          onRetry={refetch}
        />
      ) : (
        shown.map((job) => {
          const stage = stageOf(job);
          const next = nextStageAfter(stage);
          const label = NEXT_STAGE_LABEL[stage];
          return (
            <Card
              key={job.id}
              containerColor={Colors.surface}
              borderRadius={Radii.card}
              borderWidth={1}
              borderColor={Colors.borderSubtle}
              padding={[14, 14]}
              style={styles.card}
            >
              <Row justify="space-between" align="flex-start" gap={10}>
                <Col style={{ flex: 1 }}>
                  {/* The property leads: a provider works across every PG in their area, so
                      "where" is the first thing they need, not what is in the bag. */}
                  <Txt variant="cardTitle" color={Colors.textPrimary} numberOfLines={2}>
                    {job.pg_name || 'Property'}
                  </Txt>
                  <Spacer size={2} />
                  <Txt variant="meta" color={Colors.textMuted} numberOfLines={1}>
                    {[job.resident_name, job.room_no ? `Room ${job.room_no}` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Resident'}
                  </Txt>
                </Col>
                <StatusChip
                  label={stage === 'none' ? 'To collect' : STAGE_LABEL[stage]}
                  tone={toneFor(job.status)}
                />
              </Row>

              <Spacer size={8} />
              <Txt variant="body" weight="600" color={Colors.textSecondary} numberOfLines={2}>
                {job.title}
              </Txt>
              {job.pg_address ? (
                <Row gap={5} align="flex-start" style={{ marginTop: 6 }}>
                  <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                  <Txt variant="meta" color={Colors.textMuted} numberOfLines={2} style={{ flex: 1 }}>
                    {job.pg_address}
                  </Txt>
                </Row>
              ) : null}
              {job.description ? (
                <>
                  <Spacer size={6} />
                  <Txt variant="meta" color={Colors.textMuted} numberOfLines={2}>{job.description}</Txt>
                </>
              ) : null}

              <Spacer size={10} />
              <Row gap={14} align="center">
                {job.amount != null ? (
                  <Row gap={5} align="center">
                    <Ionicons name="pricetag-outline" size={14} color={Colors.textMuted} />
                    <Txt variant="meta" color={Colors.textPrimary} tabular>{formatINR(Number(job.amount))}</Txt>
                  </Row>
                ) : null}
                {job.phone ? (
                  <Row gap={5} align="center">
                    <Ionicons name="call-outline" size={14} color={Colors.textMuted} />
                    <Txt variant="meta" color={Colors.textMuted} tabular>{job.phone}</Txt>
                  </Row>
                ) : null}
              </Row>

              {!history ? (
                <>
                  <Spacer size={12} />
                  {/* Same control the delivery agent gets on a stop: they are handed an
                      address and have to drive to it. Secondary weight — getting there comes
                      before the job, but the stage button is the one that records work. */}
                  <Btn
                    onPress={() => openInMaps(job.pg_address || job.pg_name || '')}
                    containerColor={Colors.surfaceElevated}
                    textColor={Colors.primary}
                    borderRadius={Radii.control}
                    height={40}
                    testID={`laundry_navigate_${job.id}`}
                  >
                    <Ionicons name="navigate" size={15} color={Colors.primary} />
                    <Txt variant="button" color={Colors.primary} style={{ marginLeft: 6 }}>
                      Open in Google Maps
                    </Txt>
                  </Btn>
                </>
              ) : null}

              {next && label ? (
                <>
                  <Spacer size={8} />
                  <Btn
                    onPress={() => run(job, next)}
                    disabled={advance.isPending}
                    loading={advance.isPending}
                    containerColor={Colors.primary}
                    textColor={Colors.textInverse}
                    borderRadius={Radii.control}
                    height={44}
                    testID={`laundry_${next}_${job.id}`}
                  >
                    <Txt variant="button" color={Colors.textInverse}>{label}</Txt>
                  </Btn>
                </>
              ) : null}
            </Card>
          );
        })
      )}
    </FormScroll>
  );
}

/**
 * The profile tab for both PGow-side roles — identity and sign-out, same shape the other
 * staff roles use. Shared rather than duplicated: a provider and an area manager differ only
 * in what the two lines say and which glyph sits above them.
 */
export function LaundryProviderProfileScreen({
  onSignOut,
  name,
  role = 'Laundry provider',
  icon = 'shirt',
}: {
  onSignOut: () => void;
  name: string;
  role?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <FormScroll contentContainerStyle={styles.body}>
      <Col align="center" style={{ marginTop: 20 }}>
        <View style={styles.avatar}>
          <Ionicons name={icon} size={30} color={Colors.primary} />
        </View>
        <Spacer size={10} />
        <Txt variant="screenTitle" color={Colors.textPrimary}>{name}</Txt>
        <Txt variant="meta" color={Colors.textMuted}>{role}</Txt>
      </Col>
      <Spacer size={28} />
      <AnimatedPress accessibilityRole="button" onPress={onSignOut} style={styles.signOut}>
        <Ionicons name="exit" size={18} color={Colors.textInverse} />
        <Txt variant="button" color={Colors.textInverse} style={{ marginLeft: 8 }}>Sign out</Txt>
      </AnimatedPress>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, gap: 14, paddingBottom: 100 },
  card: { marginBottom: 0 },
  avatar: {
    width: 80, height: 80, borderRadius: Radii.pill,
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center' },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, borderRadius: Radii.control, backgroundColor: Colors.danger },
});
