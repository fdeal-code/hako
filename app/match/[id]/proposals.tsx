// HAKO — Trip Match : vote sur les 3 propositions
// Un vote par personne (toggle, déplaçable). Gagnante affichée quand
// tout le monde a voté ou quand le creator clôt. completeMatch → trip.

import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { CreateTripHeader, StepTitle } from '@/components/createTrip/CreateTripChrome';
import { CelebrationOverlay } from '@/components/match/CelebrationOverlay';
import { PROPOSAL_GRADIENTS, ProposalCard, pickWinner } from '@/components/match/ProposalCard';
import { ProposalsFooter } from '@/components/match/ProposalsFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useDestinationPhotos } from '@/hooks/useDestinationPhotos';
import { useTripMatch } from '@/hooks/useTripMatch';
import { completeMatch, unvoteProposal, voteProposal } from '@/services/tripMatchService';
import { triggerUnsplashDownload } from '@/services/unsplashService';

const CELEBRATION_MS = 1400;

export default function MatchProposalsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { match, participants, proposals, votes, loading, refresh } = useTripMatch(id);
  const photos = useDestinationPhotos(proposals);

  const [closedByCreator, setClosedByCreator] = useState(false);
  const [creating, setCreating] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;
  const isCreator = userId !== null && match?.creator_id === userId;
  const isCompleted = match?.status === 'completed';
  const tripId = match?.trip_id ?? null;
  const myVote = votes.find(v => v.user_id === userId) ?? null;
  const allVoted =
    participants.length > 0 &&
    participants.every(p => votes.some(v => v.user_id === p.user_id));
  const votingDone = isCompleted || allVoted || closedByCreator;
  const winner = useMemo(
    () => (votingDone ? pickWinner(proposals) : null),
    [votingDone, proposals],
  );

  const toggleVote = async (proposalId: string) => {
    if (votingDone) return; // votes gelés une fois le verdict rendu
    setActionError(null);
    if (myVote?.proposal_id === proposalId) {
      await unvoteProposal(proposalId);
    } else {
      if (myVote) await unvoteProposal(myVote.proposal_id);
      const { error } = await voteProposal(proposalId);
      if (error !== null) setActionError(error);
    }
    void refresh();
  };

  const handleCreateTrip = async () => {
    if (!id || !winner || creating) return;
    setCreating(true);
    setActionError(null);
    // Photo gagnante → cover du trip + ping du download endpoint (guideline Unsplash)
    const winnerPhoto = photos[winner.id] ?? null;
    if (winnerPhoto) triggerUnsplashDownload(winnerPhoto.downloadLocation);
    const { data: trip, error } = await completeMatch(id, winner.id, winnerPhoto?.url ?? null);
    if (error !== null || !trip) {
      setActionError(error ?? 'Création du voyage impossible.');
      setCreating(false);
      return;
    }
    setCelebrating(true);
    setTimeout(() => router.replace(`/trip/${trip.id}/dashboard`), CELEBRATION_MS);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <CreateTripHeader title="Trip Match" onClose={() => router.back()} />

      <View style={styles.head}>
        <View style={styles.flex}>
          <StepTitle
            title="Les propositions"
            subtitle={isCompleted
              ? 'Ce match est terminé, le voyage est créé.'
              : votingDone
                ? 'Les votes sont clos, voici le verdict !'
                : `Un seul vote chacun · ${votes.length}/${participants.length} ont voté`}
          />
        </View>
        {isCreator && !votingDone && proposals.length > 0 && (
          <TouchableOpacity onPress={() => setClosedByCreator(true)} activeOpacity={0.7} style={styles.closeVotesBtn}>
            <Text style={styles.closeVotes}>Clore les votes</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && proposals.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {proposals.length === 0 && (
            <Text style={styles.emptyText}>
              Pas encore de propositions : repasse quand l’IA aura fini de plancher.
            </Text>
          )}
          {proposals.map((proposal, i) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              gradient={PROPOSAL_GRADIENTS[i % PROPOSAL_GRADIENTS.length] ?? PROPOSAL_GRADIENTS[0]!}
              photo={photos[proposal.id] ?? null}
              voters={participants.filter(p =>
                proposal.votes?.some(v => v.user_id === p.user_id) ?? false,
              )}
              voted={myVote?.proposal_id === proposal.id}
              isWinner={winner?.id === proposal.id}
              voteDisabled={votingDone}
              onToggleVote={() => { void toggleVote(proposal.id); }}
            />
          ))}
        </ScrollView>
      )}

      {actionError !== null && <Text style={styles.error}>{actionError}</Text>}

      {votingDone && winner && (
        <ProposalsFooter
          isCompleted={isCompleted}
          tripId={tripId}
          isCreator={isCreator}
          creating={creating}
          winnerDestination={winner.destination}
          bottomPadding={insets.bottom + Spacing.md}
          onCreateTrip={() => { void handleCreateTrip(); }}
        />
      )}

      {celebrating && <CelebrationOverlay />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingHorizontal: Spacing.md2, paddingTop: Spacing.xl },
  closeVotesBtn: {
    marginTop: Spacing.sm, paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary,
  },
  closeVotes: { ...Typography.chip, color: Colors.textPrimary },
  loader: { marginTop: Spacing.xxl },
  list: { paddingHorizontal: Spacing.md2, paddingBottom: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl },
  error: { ...Typography.body, color: Colors.negative, textAlign: 'center' },
});
