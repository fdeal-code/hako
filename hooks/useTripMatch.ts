// HAKO — Hook Trip Match (détail d'un match, temps réel)
//
// Pattern : Screen → Hook → Service → Supabase.
// Realtime : refetch du match à chaque INSERT/UPDATE/DELETE sur
// match_responses (écran d'attente) et match_proposal_votes (votes),
// + sur la ligne trip_matches elle-même (changements de status
// déclenchés par la Edge Function).

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/services/supabase';
import { getMatch } from '@/services/tripMatchService';
import {
  MatchParticipant,
  MatchProposal,
  MatchProposalVote,
  MatchResponsePreview,
  TripMatch,
  TripMatchDetail,
} from '@/types/tripMatch';

const CHANNEL_PREFIX = 'trip-match';
const REALTIME_SCHEMA = 'public';
const REALTIME_ALL_EVENTS = '*';

interface UseTripMatchResult {
  match: TripMatch | null;
  participants: MatchParticipant[];
  responses: MatchResponsePreview[];
  responsesCount: number;
  proposals: MatchProposal[];
  votes: MatchProposalVote[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTripMatch(matchId: string | null | undefined): UseTripMatchResult {
  const [detail, setDetail] = useState<TripMatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    const { data, error: serviceError } = await getMatch(matchId);
    if (serviceError !== null) {
      setError(serviceError);
    } else {
      setDetail(data);
      setError(null);
    }
    setLoading(false);
  }, [matchId]);

  /* Chargement initial (et à chaque changement de match) */
  useEffect(() => {
    setLoading(true);
    setDetail(null);
    void refresh();
  }, [refresh]);

  /* Realtime — réponses au questionnaire + status du match */
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`${CHANNEL_PREFIX}-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: REALTIME_ALL_EVENTS,
          schema: REALTIME_SCHEMA,
          table: 'match_responses',
          filter: `match_id=eq.${matchId}`,
        },
        () => { void refresh(); },
      )
      .on(
        'postgres_changes',
        {
          event: REALTIME_ALL_EVENTS,
          schema: REALTIME_SCHEMA,
          table: 'trip_matches',
          filter: `id=eq.${matchId}`,
        },
        () => { void refresh(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, refresh]);

  /* Realtime — votes. match_proposal_votes n'a pas de colonne match_id :
     on filtre par proposal_id, en (re)souscrivant quand les propositions
     apparaissent (passage en 'voting'). */
  const proposalIdsKey = detail?.proposals.map(p => p.id).sort().join(',') ?? '';
  useEffect(() => {
    if (!matchId || proposalIdsKey.length === 0) return;

    const channel = supabase
      .channel(`${CHANNEL_PREFIX}-votes-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: REALTIME_ALL_EVENTS,
          schema: REALTIME_SCHEMA,
          table: 'match_proposal_votes',
          filter: `proposal_id=in.(${proposalIdsKey})`,
        },
        () => { void refresh(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, proposalIdsKey, refresh]);

  const proposals = detail?.proposals ?? [];
  return {
    match: detail,
    participants: detail?.participants ?? [],
    responses: detail?.responses ?? [],
    responsesCount: detail?.responses_count ?? 0,
    proposals,
    votes: proposals.flatMap(p => p.votes ?? []),
    loading,
    error,
    refresh,
  };
}
