// HAKO — Trip Match : types & interfaces

// ─── Status ───────────────────────────────────────────────────────────────────
export type MatchStatus = 'collecting' | 'proposing' | 'voting' | 'completed';

// ─── Questionnaire ────────────────────────────────────────────────────────────
// Du plus restrictif au plus large — l'agrégation retient le plus restrictif.
export type MatchScope = 'region' | 'pays' | 'europe' | 'monde';

/** Plage de dates inclusives, bornes ISO "YYYY-MM-DD". */
export interface MatchDateRange {
  start: string;
  end: string;
}

export interface MatchAnswers {
  dates: MatchDateRange[]; // plages possibles (multi-périodes)
  duration: string;        // ex. "weekend", "1 semaine"
  budget: number;          // €/personne
  scope: MatchScope;
  environments: string[];  // ex. "mer", "montagne", "ville"
  moods: string[];         // ex. "chill", "fête", "culture"
}

// ─── Trip Match ───────────────────────────────────────────────────────────────
export interface TripMatch {
  id: string;
  creator_id: string;
  trip_id: string | null; // null tant que le match n'est pas complété
  title: string | null;
  status: MatchStatus;
  created_at: string;
}

export interface MatchParticipantProfile {
  id: string;
  nickname?: string;
  avatar_url?: string;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  user_id: string;
  created_at: string;
  user?: MatchParticipantProfile;
}

export interface MatchResponse {
  id: string;
  match_id: string;
  user_id: string;
  answers: MatchAnswers;
  created_at: string;
}

export interface MatchProposal {
  id: string;
  match_id: string;
  destination: string;
  country_code: string;
  argument: string;
  budget_estimate: number;
  best_dates: string;         // libellé d'affichage (ex. "12–15 juin")
  start_date: string | null;  // ISO "YYYY-MM-DD" (null sur les anciennes générations)
  end_date: string | null;    // ISO "YYYY-MM-DD" (null sur les anciennes générations)
  match_score: number;
  position: number;
  created_at: string;
  votes?: MatchProposalVote[];
}

export interface MatchProposalVote {
  id: string;
  proposal_id: string;
  user_id: string;
  created_at: string;
}

// ─── Vue agrégée (getMatch) ───────────────────────────────────────────────────
/** Réponse allégée embarquée dans le détail (qui a répondu + answers pour le reveal). */
export type MatchResponsePreview = Pick<MatchResponse, 'user_id' | 'answers'>;

export interface TripMatchDetail extends TripMatch {
  participants: MatchParticipant[];
  responses: MatchResponsePreview[];
  responses_count: number; // réponses reçues (attendu : participants.length)
  proposals: MatchProposal[];
}
