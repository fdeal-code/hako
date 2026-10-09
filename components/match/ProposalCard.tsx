// HAKO — Carte proposition de destination (Trip Match)
// Cover gradient + badge "Match XX%", argument, budget, dates,
// avatars des votants (temps réel via l'écran) et toggle de vote.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';
import { Avatar } from '@/components/ui/Avatar';
import { ProposalCover } from '@/components/match/ProposalCover';
import { DestinationPhoto } from '@/services/unsplashService';
import { MatchParticipant, MatchProposal } from '@/types/tripMatch';

const AVATAR_SIZE = 28;
const AVATAR_OVERLAP = -10;
const WINNER_LABEL = 'Choix du groupe 🏆';

/** Covers gradient des 3 propositions (cyclées par position). */
export const PROPOSAL_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#4A9FD8', '#1F5E8C'],
  ['#D8A855', '#8C6A1F'],
  ['#8B7BB8', '#4A3E6B'],
];

/** Gagnante = plus de votes, égalité départagée par la position IA. */
export function pickWinner(proposals: readonly MatchProposal[]): MatchProposal | null {
  let best: MatchProposal | null = null;
  for (const proposal of proposals) {
    const count = proposal.votes?.length ?? 0;
    const bestCount = best?.votes?.length ?? -1;
    if (best === null || count > bestCount || (count === bestCount && proposal.position < best.position)) {
      best = proposal;
    }
  }
  return best;
}

interface ProposalCardProps {
  proposal: MatchProposal;
  gradient: readonly [string, string];
  photo: DestinationPhoto | null;
  voters: MatchParticipant[];
  voted: boolean;
  isWinner: boolean;
  voteDisabled?: boolean;
  onToggleVote: () => void;
}

export function ProposalCard({
  proposal, gradient, photo, voters, voted, isWinner, voteDisabled = false, onToggleVote,
}: ProposalCardProps) {
  return (
    <View style={[styles.card, isWinner && styles.cardWinner]}>
      {isWinner && (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>{WINNER_LABEL}</Text>
        </View>
      )}

      <ProposalCover proposal={proposal} gradient={gradient} photo={photo} />

      <View style={styles.body}>
        <Text style={styles.argument}>{proposal.argument}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="wallet-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.metaText}>≈ {proposal.budget_estimate} € / pers</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{proposal.best_dates}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.voters}>
            {voters.map((voter, i) => (
              <Avatar
                key={voter.user_id}
                name={voter.user?.nickname}
                uri={voter.user?.avatar_url}
                size={AVATAR_SIZE}
                style={i > 0 ? styles.voterOverlap : undefined}
              />
            ))}
            {voters.length === 0 && (
              <Text style={styles.noVotes}>Aucun vote pour l’instant</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.voteBtn, voted && styles.voteBtnActive, voteDisabled && styles.voteBtnDisabled]}
            onPress={onToggleVote}
            disabled={voteDisabled}
            activeOpacity={0.8}
          >
            <Ionicons
              name={voted ? 'heart' : 'heart-outline'}
              size={22}
              color={voted ? Colors.textInverted : Colors.vote.love}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  cardWinner: { borderWidth: 2, borderColor: Colors.primary },
  winnerBanner: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  winnerText: { color: Colors.textInverted, fontSize: 13, fontWeight: '700' },
  body: { padding: Spacing.md, gap: Spacing.sm },
  argument: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  metaText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  voters: { flexDirection: 'row', alignItems: 'center' },
  voterOverlap: { marginLeft: AVATAR_OVERLAP },
  noVotes: { fontSize: 12, fontWeight: '500', color: Colors.textTertiary },
  voteBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  voteBtnActive: { backgroundColor: Colors.vote.love, borderColor: Colors.vote.love },
  voteBtnDisabled: { opacity: 0.4 },
});
