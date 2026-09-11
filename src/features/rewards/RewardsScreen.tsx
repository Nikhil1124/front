/**
 * Points — where a resident finds out what answering about meals has been worth.
 *
 * The ledger has been running the whole time: every meal RSVP pays 15 and every verified rent
 * payment pays 50, both idempotent. None of it was visible. The balance rendered as one line
 * inside a sheet on the payments tab, the leaderboard endpoint had no caller at all, and the
 * champion reward — the only thing points can be spent on — had no UI, so points accrued and
 * could never be used. This screen is that system made visible, not a new one.
 *
 * ── Why the podium and not the board ────────────────────────────────────────────────────────
 * `GET /v1/rewards` is staff-only by deliberate design: a ranked list of every neighbour's
 * score is the sort of thing that makes a shared kitchen unpleasant. But the champion reward
 * is guest-initiated and pays only whoever is actually first, so a resident who cannot see the
 * standings cannot know they have won it. `GET /v1/rewards/standings` is the narrow answer —
 * own rank, the size of the field, and the top three. Nothing else about anybody else.
 */
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/components/EmptyState';
import { FormScroll } from '@/components/ui/FormScroll';
import { AnimatedPress, Card, Col, Row, Spacer, Txt } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { Colors, Radii } from '@/theme';
import {
  useClaimChampionMutation,
  useMyRewardsQuery,
  useMyStandingsQuery,
  type RewardEntry,
  type StandingsRow,
} from './useRewards';

/** "1st", "2nd", "3rd", "11th". Ordinals are what a standing is read as out loud. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

function movementLabel(entry: RewardEntry): string {
  // The ledger stores a written reason for every movement — the whole point of it being a
  // ledger rather than a counter. Rendering it beats re-deriving a label from `ref_type`.
  return entry.reason;
}

export function RewardsScreen() {
  const toast = useToast();
  const pgId = useAuthStore((s) => s.activePgId) ?? undefined;

  const rewards = useMyRewardsQuery(pgId);
  const standings = useMyStandingsQuery(pgId);
  const claim = useClaimChampionMutation(pgId);

  const balance = standings.data?.balance ?? rewards.data?.balance ?? 0;
  const recent = rewards.data?.recent ?? [];
  const isLoading = rewards.isLoading || standings.isLoading;
  const error = rewards.error ?? standings.error;

  const refetch = () => {
    rewards.refetch();
    standings.refetch();
  };

  const onClaim = () => {
    claim.mutate(undefined, {
      onSuccess: (r) =>
        toast(
          'success',
          `₹${Number(r.discount_amount)} off your rent`,
          `${r.points_spent} points spent. You have ${r.balance} left.`,
        ),
      // The server re-checks eligibility at the moment of claiming and 409s with a sentence
      // that says which check failed — surfacing it beats inventing our own guess.
      onError: (e) => toast('error', 'Could not claim', e.message || 'Please try again.'),
    });
  };

  if (!pgId || (isLoading && !rewards.data)) {
    return (
      <FormScroll contentContainerStyle={styles.body}>
        <EmptyState
          icon="star-outline"
          title="Points"
          subtitle="Answering about meals and paying rent on time both earn points."
          accent={Colors.primary}
          loading={isLoading}
          error={error}
          onRetry={refetch}
        />
      </FormScroll>
    );
  }

  return (
    <FormScroll
      contentContainerStyle={styles.body}
      refreshControl={
        <RefreshControl
          refreshing={rewards.isRefetching || standings.isRefetching}
          onRefresh={refetch}
          tintColor={Colors.primary}
        />
      }
    >
      {/* The balance leads: it is the number the resident came for, and the one the meal
          notification has just quoted at them. */}
      <Card
        containerColor={Colors.primaryDark}
        borderRadius={Radii.card}
        padding={[20, 18]}
        style={styles.hero}
      >
        <Row justify="space-between" align="center">
          <Col>
            <Txt variant="meta" color="rgba(255,255,255,0.7)">YOUR POINTS</Txt>
            <Spacer size={4} />
            <Txt variant="screenTitle" weight="800" color={Colors.textInverse} tabular>
              {balance}
            </Txt>
          </Col>
          {standings.data ? (
            <Col align="flex-end">
              <Txt variant="meta" color="rgba(255,255,255,0.7)">YOUR RANK</Txt>
              <Spacer size={4} />
              <Txt variant="cardTitle" weight="700" color={Colors.textInverse}>
                {ordinal(standings.data.rank)} of {standings.data.total}
              </Txt>
            </Col>
          ) : null}
        </Row>
      </Card>

      {/* The champion reward. Only offered when the server says it would pay out — and it
          re-checks anyway, so this is a courtesy, not the gate. */}
      {standings.data?.can_claim_champion ? (
        <Card
          containerColor={Colors.surface}
          borderRadius={Radii.card}
          borderWidth={1}
          borderColor={Colors.primary}
          padding={[16, 16]}
        >
          <Row gap={10} align="center">
            <Ionicons name="trophy" size={20} color={Colors.primary} />
            <Col style={{ flex: 1 }}>
              <Txt variant="cardTitle" color={Colors.textPrimary}>You're this cycle's top earner</Txt>
              <Txt variant="meta" color={Colors.textMuted}>
                Spend {standings.data.champion_cost} points for ₹{Number(standings.data.champion_discount)} off your rent.
              </Txt>
            </Col>
          </Row>
          <Spacer size={12} />
          <AnimatedPress
            accessibilityRole="button"
            onPress={onClaim}
            disabled={claim.isPending}
            style={[styles.claim, claim.isPending && { opacity: 0.6 }]}
            testID="rewards_claim_champion"
          >
            <Txt variant="button" color={Colors.textInverse}>
              {claim.isPending ? 'Claiming…' : `Claim ₹${Number(standings.data.champion_discount)} off`}
            </Txt>
          </AnimatedPress>
        </Card>
      ) : null}

      {/* The podium — three names, not the board. See the header on why. */}
      {standings.data && standings.data.top.length > 0 ? (
        <Card
          containerColor={Colors.surface}
          borderRadius={Radii.card}
          borderWidth={1}
          borderColor={Colors.borderSubtle}
          padding={[16, 16]}
        >
          <Txt variant="cardTitle" color={Colors.textPrimary}>Top earners</Txt>
          <Spacer size={10} />
          {standings.data.top.map((row: StandingsRow, i: number) => (
            <Row key={`${row.name}-${i}`} align="center" gap={10} style={styles.podiumRow}>
              <View style={[styles.medal, i === 0 && styles.medalGold]}>
                <Txt variant="meta" weight="700" color={i === 0 ? Colors.primaryDark : Colors.textMuted} tabular>
                  {i + 1}
                </Txt>
              </View>
              <Col style={{ flex: 1 }}>
                <Txt variant="body" weight="600" color={Colors.textPrimary} numberOfLines={1}>
                  {row.name}
                </Txt>
                {row.room_no ? (
                  <Txt variant="meta" color={Colors.textMuted}>Room {row.room_no}</Txt>
                ) : null}
              </Col>
              <Txt variant="body" weight="700" color={Colors.primary} tabular>{row.balance}</Txt>
            </Row>
          ))}
        </Card>
      ) : null}

      {/* Every movement, with the reason the ledger recorded — which is the thing a stored
          counter could never answer. */}
      <Card
        containerColor={Colors.surface}
        borderRadius={Radii.card}
        borderWidth={1}
        borderColor={Colors.borderSubtle}
        padding={[16, 16]}
      >
        <Txt variant="cardTitle" color={Colors.textPrimary}>Recent activity</Txt>
        <Spacer size={10} />
        {recent.length === 0 ? (
          <Txt variant="meta" color={Colors.textMuted}>
            Answer a meal notification to earn your first points.
          </Txt>
        ) : (
          recent.map((entry) => (
            <Row key={entry.id} align="center" gap={10} style={styles.entryRow}>
              <Ionicons
                name={entry.delta > 0 ? 'add-circle' : 'remove-circle'}
                size={17}
                color={entry.delta > 0 ? Colors.success : Colors.terracotta}
              />
              <Txt variant="body" color={Colors.textSecondary} style={{ flex: 1 }} numberOfLines={2}>
                {movementLabel(entry)}
              </Txt>
              <Txt
                variant="body"
                weight="700"
                color={entry.delta > 0 ? Colors.success : Colors.terracotta}
                tabular
              >
                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
              </Txt>
            </Row>
          ))
        )}
      </Card>

      <Txt variant="meta" color={Colors.textMuted} style={{ textAlign: 'center' }}>
        15 points for answering about a meal · 50 for rent paid and verified
      </Txt>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, gap: 14, paddingBottom: 100 },
  hero: { marginBottom: 0 },
  claim: {
    height: 46, borderRadius: Radii.control, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center' },
  podiumRow: { paddingVertical: 7 },
  medal: {
    width: 26, height: 26, borderRadius: Radii.pill, backgroundColor: Colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center' },
  medalGold: { backgroundColor: Colors.primaryGlow },
  entryRow: { paddingVertical: 7 },
});
