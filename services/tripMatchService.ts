// HAKO — Service Trip Match
//
// Pattern service : Screen → Hook → Service → Supabase.
// Chaque fonction retourne un ServiceResult<T> (voir tripService.ts).
//
// Le RLS fait déjà le gros du contrôle d'accès (participants only) ;
// les vérifications ici servent à produire des messages d'erreur clairs.

import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/services/supabase';
import { geocodeDestination } from '@/services/placesService';
import { notifyMatchInvite } from '@/services/notificationService';
import { createTrip, serviceError, ServiceResult, TripRow } from '@/services/tripService';
import { UserRole } from '@/constants/types';
import {
  MatchAnswers,
  MatchProposal,
  MatchProposalVote,
  MatchResponse,
  MatchStatus,
  TripMatch,
  TripMatchDetail,
} from '@/types/tripMatch';

// ─── Constantes ───────────────────────────────────────────────────────────────
const FN_GENERATE_PROPOSALS = 'generate-match-proposals';
const STATUS_VOTING: MatchStatus = 'voting';
const STATUS_COMPLETED: MatchStatus = 'completed';
const ROLE_MEMBER: UserRole = 'member';
const PG_UNIQUE_VIOLATION = '23505';
const ERR_NOT_AUTHENTICATED = 'Utilisateur non connecté.';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ─── createMatch ──────────────────────────────────────────────────────────────
/**
 * Crée un match. Le creator devient participant automatiquement (trigger DB
 * on_trip_match_created) ; les autres participants sont insérés ensuite.
 */
export async function createMatch(
  title: string,
  participantIds: string[],
): Promise<ServiceResult<TripMatch>> {
  const userId = await getCurrentUserId();
  if (!userId) return serviceError(ERR_NOT_AUTHENTICATED);

  const { data, error } = await supabase
    .from('trip_matches')
    .insert({ creator_id: userId, title: title.trim() })
    .select()
    .single();
  if (error || !data) {
    return serviceError(error?.message ?? 'Création du match impossible.');
  }
  const match = data as TripMatch;

  const others = [...new Set(participantIds)].filter(id => id !== userId);
  if (others.length > 0) {
    const { error: participantsError } = await supabase
      .from('match_participants')
      .insert(others.map(id => ({ match_id: match.id, user_id: id })));
    if (participantsError) {
      return serviceError(
        `Match créé mais ajout des participants impossible : ${participantsError.message}`,
      );
    }
    // Notification in-app 'match_invite' pour chaque invité — best effort,
    // un échec ne doit jamais invalider la création du match.
    void notifyMatchInvite(match.id, title.trim(), others, userId);
  }

  return { data: match, error: null };
}

// ─── getMatch ─────────────────────────────────────────────────────────────────
interface RawMatchDetail extends TripMatch {
  participants: TripMatchDetail['participants'];
  responses: TripMatchDetail['responses'];
  proposals: MatchProposal[];
}

/** Match complet (participants + profils, compte de réponses, propositions + votes) en 1 requête. */
export async function getMatch(matchId: string): Promise<ServiceResult<TripMatchDetail>> {
  const { data, error } = await supabase
    .from('trip_matches')
    .select(`
      *,
      participants:match_participants(
        id, match_id, user_id, created_at,
        user:profiles(id, nickname, avatar_url)
      ),
      responses:match_responses(user_id, answers),
      proposals:match_proposals(*, votes:match_proposal_votes(*))
    `)
    .eq('id', matchId)
    .single();
  if (error || !data) {
    return serviceError(error?.message ?? 'Match introuvable.');
  }

  const raw = data as unknown as RawMatchDetail;
  const { responses, proposals, ...match } = raw;
  const detail: TripMatchDetail = {
    ...match,
    responses,
    responses_count: responses.length,
    proposals: [...proposals].sort((a, b) => a.position - b.position),
  };
  return { data: detail, error: null };
}

// ─── getMyMatches ─────────────────────────────────────────────────────────────
/** Matchs où je suis participant, hors 'completed', du plus récent au plus ancien. */
export async function getMyMatches(): Promise<ServiceResult<TripMatch[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return serviceError(ERR_NOT_AUTHENTICATED);

  const { data, error } = await supabase
    .from('trip_matches')
    .select('*, match_participants!inner(user_id)')
    .eq('match_participants.user_id', userId)
    .neq('status', STATUS_COMPLETED)
    .order('created_at', { ascending: false });
  if (error) return serviceError(error.message);

  return { data: (data ?? []) as TripMatch[], error: null };
}

// ─── submitResponse ───────────────────────────────────────────────────────────
/** Une seule réponse par participant (UNIQUE match_id/user_id, pas d'UPDATE en RLS). */
export async function submitResponse(
  matchId: string,
  answers: MatchAnswers,
): Promise<ServiceResult<MatchResponse>> {
  const userId = await getCurrentUserId();
  if (!userId) return serviceError(ERR_NOT_AUTHENTICATED);

  const { data, error } = await supabase
    .from('match_responses')
    .insert({ match_id: matchId, user_id: userId, answers })
    .select()
    .single();
  if (error || !data) {
    if (error?.code === PG_UNIQUE_VIOLATION) {
      return serviceError('Tu as déjà répondu à ce match.');
    }
    return serviceError(error?.message ?? 'Envoi de la réponse impossible.');
  }
  return { data: data as MatchResponse, error: null };
}

// ─── generateProposals ────────────────────────────────────────────────────────
interface GenerateProposalsResult {
  match_id: string;
  status: MatchStatus;
  proposals: MatchProposal[];
}

/** Appelle la Edge Function (vérifs + IA + insertion côté serveur). */
export async function generateProposals(
  matchId: string,
): Promise<ServiceResult<GenerateProposalsResult>> {
  const { data, error } = await supabase.functions.invoke<GenerateProposalsResult>(
    FN_GENERATE_PROPOSALS,
    { body: { match_id: matchId } },
  );
  if (error) {
    // La fonction renvoie { error, message } exploitables sur les 4xx/5xx
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as { message?: string; error?: string };
        return serviceError(body.message ?? body.error ?? error.message);
      } catch {
        return serviceError(error.message);
      }
    }
    return serviceError(error.message);
  }
  if (!data) return serviceError('Réponse vide de la fonction de génération.');
  return { data, error: null };
}

// ─── voteProposal / unvoteProposal ────────────────────────────────────────────
export async function voteProposal(
  proposalId: string,
): Promise<ServiceResult<MatchProposalVote>> {
  const userId = await getCurrentUserId();
  if (!userId) return serviceError(ERR_NOT_AUTHENTICATED);

  const { data, error } = await supabase
    .from('match_proposal_votes')
    .insert({ proposal_id: proposalId, user_id: userId })
    .select()
    .single();
  if (error || !data) {
    if (error?.code === PG_UNIQUE_VIOLATION) {
      return serviceError('Tu as déjà voté pour cette proposition.');
    }
    return serviceError(error?.message ?? 'Vote impossible.');
  }
  return { data: data as MatchProposalVote, error: null };
}

export async function unvoteProposal(proposalId: string): Promise<ServiceResult<true>> {
  const userId = await getCurrentUserId();
  if (!userId) return serviceError(ERR_NOT_AUTHENTICATED);

  const { data, error } = await supabase
    .from('match_proposal_votes')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('user_id', userId)
    .select();
  if (error) return serviceError(error.message);
  if (!data || data.length === 0) {
    // Aucun vote supprimé : pas de vote existant, ou policy DELETE absente
    // (migration 20260707110000_trip_match_unvote.sql requise)
    return serviceError('Aucun vote à retirer.');
  }
  return { data: true, error: null };
}

// ─── completeMatch ────────────────────────────────────────────────────────────
/**
 * Clôture le match : crée le trip depuis la proposition gagnante (via
 * tripService.createTrip — source unique), lie trip_id, passe en 'completed',
 * et ajoute tous les participants du match comme trip_members.
 * Réservé au creator (RLS UPDATE sur trip_matches).
 * `coverImageUrl` : photo Unsplash de la proposition gagnante — URL directe,
 * même pattern que les covers suggérées de trip/create.tsx.
 */
export async function completeMatch(
  matchId: string,
  winningProposalId: string,
  coverImageUrl: string | null = null,
): Promise<ServiceResult<TripRow>> {
  const userId = await getCurrentUserId();
  if (!userId) return serviceError(ERR_NOT_AUTHENTICATED);

  const { data: matchData, error: matchError } = await supabase
    .from('trip_matches')
    .select('id, creator_id, title, status')
    .eq('id', matchId)
    .single();
  if (matchError || !matchData) {
    return serviceError(matchError?.message ?? 'Match introuvable.');
  }
  const match = matchData as Pick<TripMatch, 'id' | 'creator_id' | 'title' | 'status'>;
  if (match.creator_id !== userId) {
    return serviceError('Seul le créateur du match peut le clôturer.');
  }
  if (match.status !== STATUS_VOTING) {
    return serviceError(`Le match est en "${match.status}" — clôture possible uniquement en "${STATUS_VOTING}".`);
  }

  const { data: proposalData, error: proposalError } = await supabase
    .from('match_proposals')
    .select('id, destination, country_code, start_date, end_date')
    .eq('id', winningProposalId)
    .eq('match_id', matchId)
    .single();
  if (proposalError || !proposalData) {
    return serviceError(proposalError?.message ?? 'Proposition gagnante introuvable dans ce match.');
  }
  const proposal = proposalData as Pick<
    MatchProposal,
    'id' | 'destination' | 'country_code' | 'start_date' | 'end_date'
  >;
  // trips.start_date / end_date sont NOT NULL : anciennes propositions
  // (générées avant la migration des dates) → message clair plutôt
  // qu'une erreur SQL brute.
  if (proposal.start_date === null || proposal.end_date === null) {
    return serviceError(
      'Cette proposition date d’une ancienne version et n’a pas de dates exploitables — relancez un Trip Match pour générer de nouvelles propositions.',
    );
  }

  const { data: participantsData, error: participantsError } = await supabase
    .from('match_participants')
    .select('user_id')
    .eq('match_id', matchId);
  if (participantsError || !participantsData) {
    return serviceError(participantsError?.message ?? 'Lecture des participants impossible.');
  }
  const participantIds = participantsData.map((p: { user_id: string }) => p.user_id);

  // 1. Résoudre les coordonnées de la destination (la destination IA est un
  // texte, sans lat/lng contrairement au flow Google Places). Best effort :
  // en cas d'échec (réseau, quota) le trip se crée sans coordonnées et la
  // carte affiche son état vide.
  const coords = await geocodeDestination(proposal.destination, proposal.country_code);

  // 2. Créer le trip aux dates de la proposition gagnante
  const tripResult = await createTrip({
    name:            match.title ?? proposal.destination,
    destination:     proposal.destination,
    start_date:      proposal.start_date,
    end_date:        proposal.end_date,
    cover_image_url: coverImageUrl,
    owner_id:        userId,
    destination_lat:      coords?.lat ?? null,
    destination_lng:      coords?.lng ?? null,
    destination_place_id: coords?.placeId ?? null,
  });
  if (tripResult.error !== null) return serviceError(tripResult.error);
  const trip = tripResult.data;

  // 2. Lier le trip et clôturer le match (RLS : creator uniquement)
  const { data: updated, error: updateError } = await supabase
    .from('trip_matches')
    .update({ trip_id: trip.id, status: STATUS_COMPLETED })
    .eq('id', matchId)
    .eq('status', STATUS_VOTING)
    .select('id');
  if (updateError) {
    return serviceError(`Voyage créé mais clôture du match impossible : ${updateError.message}`);
  }
  if (!updated || updated.length === 0) {
    return serviceError('Voyage créé mais match déjà clôturé par ailleurs.');
  }

  // 3. Ajouter les participants (le creator est déjà owner via createTrip)
  const members = participantIds.filter(id => id !== userId);
  if (members.length > 0) {
    const { error: membersError } = await supabase
      .from('trip_members')
      .insert(members.map(id => ({ trip_id: trip.id, user_id: id, role: ROLE_MEMBER })));
    if (membersError) {
      return serviceError(
        `Voyage créé mais ajout des membres impossible : ${membersError.message}`,
      );
    }
  }

  return { data: trip, error: null };
}
