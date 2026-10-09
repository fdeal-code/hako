// ═════════════════════════════════════════════════════════════
// HAKO — Edge Function : generate-match-proposals
//
// POST { match_id } + JWT utilisateur (header Authorization)
// 1. Vérifie : participant du match, status 'collecting', toutes
//    les réponses présentes.
// 2. Agrège les answers du groupe (dates communes, budget MIN,
//    périmètre le plus restrictif, envies comptées).
// 3. Demande 3 propositions de destinations à Claude (JSON strict,
//    1 retry si invalide).
// 4. Insère les propositions (service_role, bypass RLS) et passe
//    le match en 'voting'.
//
// Statuts : collecting → proposing (verrou pendant la génération)
//           → voting (succès) ou retour à collecting (échec).
// ═════════════════════════════════════════════════════════════

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// ─────────────────────────────────────────────
// CONSTANTES — zéro valeur hardcodée plus bas
// ─────────────────────────────────────────────
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_MAX_TOKENS = 2000;
const PROPOSALS_COUNT = 3;
const MATCH_SCORE_MIN = 60;
const MATCH_SCORE_MAX = 100;
const LLM_MAX_ATTEMPTS = 2; // 1 tentative + 1 retry si JSON invalide

// Ordre du plus restrictif au plus large (périmètre du groupe = le plus restrictif)
const SCOPE_ORDER = ["region", "pays", "europe", "monde"] as const;

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

/** Plage de dates inclusives, bornes ISO "YYYY-MM-DD". */
interface DateRange {
  start: string;
  end: string;
}

/**
 * Forme attendue du jsonb `answers` de match_responses.
 * ⚠️ Source de vérité côté app : types/tripMatch.ts (MatchAnswers).
 * Tous les champs sont optionnels ici : l'agrégation tolère les réponses partielles.
 */
interface MatchAnswers {
  dates?: DateRange[];    // plages possibles (multi-périodes)
  duration?: string;      // ex. "weekend", "1 semaine"
  budget?: number;        // €/personne
  scope?: (typeof SCOPE_ORDER)[number];
  environments?: string[]; // ex. "mer", "montagne", "ville"
  moods?: string[];        // ex. "chill", "fête", "culture"
}

interface GroupProfile {
  participants_count: number;
  common_ranges: DateRange[]; // plages OK pour tous ceux qui ont donné des dates
  target_month: string | null;
  durations: Record<string, number>; // durée → nombre de votes
  budget_min: number | null;
  scope: string | null;
  environments: Record<string, number>; // nom → nombre de "oui"
  moods: Record<string, number>;
}

interface Proposal {
  destination: string;
  country_code: string;
  argument: string;
  budget_estimate: number;
  best_dates: string;   // libellé d'affichage (ex. "12–15 juin")
  start_date: string;   // ISO "YYYY-MM-DD" — alimente trips.start_date
  end_date: string;     // ISO "YYYY-MM-DD" — alimente trips.end_date
  match_score: number;
}

type ValidationResult =
  | { ok: true; proposals: Proposal[] }
  | { ok: false; error: string };

// ─────────────────────────────────────────────
// HELPERS HTTP
// ─────────────────────────────────────────────

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: code, message });
}

// ─────────────────────────────────────────────
// AGRÉGATION DES RÉPONSES
// ─────────────────────────────────────────────

/** Intersection de deux listes de plages (bornes ISO comparables lexicalement). */
function intersectRanges(a: DateRange[], b: DateRange[]): DateRange[] {
  const out: DateRange[] = [];
  for (const ra of a) {
    for (const rb of b) {
      const start = ra.start > rb.start ? ra.start : rb.start;
      const end = ra.end < rb.end ? ra.end : rb.end;
      if (start <= end) out.push({ start, end });
    }
  }
  return out;
}

function aggregateAnswers(allAnswers: MatchAnswers[]): GroupProfile {
  // Dates : intersection des plages de tous ceux qui en ont donné
  const withDates = allAnswers
    .map((a) => a.dates)
    .filter((d): d is DateRange[] => Array.isArray(d) && d.length > 0);
  let commonRanges: DateRange[] = withDates[0] ?? [];
  for (const ranges of withDates.slice(1)) {
    commonRanges = intersectRanges(commonRanges, ranges);
  }
  commonRanges = [...commonRanges].sort((x, y) => x.start.localeCompare(y.start));

  // Mois de départ visé = mois du début de la première plage commune
  let targetMonth: string | null = null;
  const firstStart = commonRanges[0]?.start;
  if (firstStart) {
    const monthIdx = new Date(firstStart).getMonth();
    targetMonth = MONTHS_FR[monthIdx] ?? null;
  }

  // Budget : MIN du groupe (on s'aligne sur le plus petit budget)
  const budgets = allAnswers
    .map((a) => a.budget)
    .filter((b): b is number => typeof b === "number" && b > 0);
  const budgetMin = budgets.length > 0 ? Math.min(...budgets) : null;

  // Périmètre : le plus restrictif exprimé
  const scopeIdx = allAnswers
    .map((a) => (a.scope ? SCOPE_ORDER.indexOf(a.scope) : -1))
    .filter((i) => i >= 0);
  const scope = scopeIdx.length > 0 ? SCOPE_ORDER[Math.min(...scopeIdx)] ?? null : null;

  // Valeurs multi-choix : nombre de "oui" par valeur
  const countValues = (extract: (a: MatchAnswers) => string[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const answers of allAnswers) {
      for (const value of extract(answers)) {
        counts[value] = (counts[value] ?? 0) + 1;
      }
    }
    return counts;
  };

  return {
    participants_count: allAnswers.length,
    common_ranges: commonRanges,
    target_month: targetMonth,
    durations: countValues((a) => (a.duration ? [a.duration] : [])),
    budget_min: budgetMin,
    scope,
    environments: countValues((a) => a.environments ?? []),
    moods: countValues((a) => a.moods ?? []),
  };
}

// ─────────────────────────────────────────────
// APPEL ANTHROPIC + VALIDATION
// ─────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Date valide au format strict "YYYY-MM-DD" (rejette 2026-02-31, etc.). */
function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function buildSystemPrompt(profile: GroupProfile, todayIso: string): string {
  const budgetRule =
    profile.budget_min !== null
      ? `"budget_estimate" est un nombre en euros PAR PERSONNE et DOIT être inférieur ou égal à ${profile.budget_min} (le plus petit budget du groupe — on s'aligne sur lui, pas sur la moyenne).`
      : `"budget_estimate" est un nombre en euros PAR PERSONNE, raisonnable pour le groupe.`;
  const monthRule = profile.target_month
    ? `Le départ visé est en ${profile.target_month} : les propositions doivent être pertinentes pour ce mois (météo, saison, affluence), et le créneau choisi doit être inclus dans l'une des plages communes du groupe ("common_ranges", bornes ISO).`
    : `Aucune plage commune n'a été identifiée : propose des destinations flexibles et signale-le dans "best_dates".`;

  return [
    `Tu es l'assistant voyage de HAKO, une app où un groupe d'amis organise un voyage ensemble.`,
    `À partir du profil agrégé du groupe fourni par l'utilisateur, tu proposes EXACTEMENT ${PROPOSALS_COUNT} destinations.`,
    ``,
    `RÈGLES DE SORTIE — STRICTES :`,
    `- Réponds UNIQUEMENT avec un tableau JSON valide. Aucun texte avant ou après, aucun markdown, aucun bloc de code.`,
    `- Le tableau contient EXACTEMENT ${PROPOSALS_COUNT} objets, du meilleur match au moins bon.`,
    `- Chaque objet a EXACTEMENT ces clés :`,
    `  "destination" (string — ville ou région, ex. "Lisbonne"),`,
    `  "country_code" (string — code pays ISO 3166-1 alpha-2, ex. "PT"),`,
    `  "argument" (string — 2 phrases MAXIMUM, ton fun et léger, qui cite les compromis du groupe, ex. "les fans de rando et les accros au rosé y trouvent leur compte"),`,
    `  "budget_estimate" (number),`,
    `  "best_dates" (string — créneau conseillé, lisible, ex. "10–17 juillet"),`,
    `  "start_date" (string — début du créneau, format ISO "YYYY-MM-DD"),`,
    `  "end_date" (string — fin du créneau, format ISO "YYYY-MM-DD"),`,
    `  "match_score" (integer entre ${MATCH_SCORE_MIN} et ${MATCH_SCORE_MAX}).`,
    `- Nous sommes le ${todayIso} : "start_date" et "end_date" doivent être STRICTEMENT postérieures à cette date, avec start_date <= end_date, incluses dans une plage commune du groupe ("common_ranges") quand il y en a, et "best_dates" doit être le libellé lisible de ce même créneau.`,
    `- ${budgetRule}`,
    `- ${monthRule}`,
    `- Respecte le périmètre géographique du groupe s'il est indiqué ("scope").`,
    `- Tiens compte des durées souhaitées ("durations", avec leur nombre de votes) pour formuler "best_dates".`,
    `- Les environnements et ambiances ("moods") sont donnés avec leur nombre de votes "oui" : privilégie les plus demandés, et utilise les minoritaires comme compromis à citer dans "argument".`,
  ].join("\n");
}

/** Retire d'éventuels fences ```json ... ``` avant parsing. */
function stripCodeFences(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function validateProposals(
  value: unknown,
  budgetMax: number | null,
  todayIso: string,
): ValidationResult {
  if (!Array.isArray(value)) {
    return { ok: false, error: "la réponse n'est pas un tableau JSON" };
  }
  if (value.length !== PROPOSALS_COUNT) {
    return { ok: false, error: `${value.length} propositions au lieu de ${PROPOSALS_COUNT}` };
  }
  const proposals: Proposal[] = [];
  for (const [i, item] of value.entries()) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, error: `l'élément ${i} n'est pas un objet` };
    }
    const p = item as Record<string, unknown>;
    if (typeof p.destination !== "string" || p.destination.length === 0) {
      return { ok: false, error: `"destination" manquante ou invalide (élément ${i})` };
    }
    if (typeof p.country_code !== "string" || p.country_code.length === 0) {
      return { ok: false, error: `"country_code" manquant ou invalide (élément ${i})` };
    }
    if (typeof p.argument !== "string" || p.argument.length === 0) {
      return { ok: false, error: `"argument" manquant ou invalide (élément ${i})` };
    }
    if (typeof p.budget_estimate !== "number" || !Number.isFinite(p.budget_estimate)) {
      return { ok: false, error: `"budget_estimate" manquant ou invalide (élément ${i})` };
    }
    if (budgetMax !== null && p.budget_estimate > budgetMax) {
      return {
        ok: false,
        error: `"budget_estimate" (${p.budget_estimate}) dépasse le budget min du groupe (${budgetMax}) (élément ${i})`,
      };
    }
    if (typeof p.best_dates !== "string" || p.best_dates.length === 0) {
      return { ok: false, error: `"best_dates" manquant ou invalide (élément ${i})` };
    }
    if (typeof p.start_date !== "string" || !isValidIsoDate(p.start_date)) {
      return { ok: false, error: `"start_date" manquant ou hors format YYYY-MM-DD (élément ${i})` };
    }
    if (typeof p.end_date !== "string" || !isValidIsoDate(p.end_date)) {
      return { ok: false, error: `"end_date" manquant ou hors format YYYY-MM-DD (élément ${i})` };
    }
    if (p.start_date > p.end_date) {
      return { ok: false, error: `"start_date" (${p.start_date}) postérieure à "end_date" (${p.end_date}) (élément ${i})` };
    }
    if (p.start_date <= todayIso) {
      return { ok: false, error: `"start_date" (${p.start_date}) doit être postérieure à aujourd'hui (${todayIso}) (élément ${i})` };
    }
    if (
      typeof p.match_score !== "number" ||
      !Number.isInteger(p.match_score) ||
      p.match_score < MATCH_SCORE_MIN ||
      p.match_score > MATCH_SCORE_MAX
    ) {
      return {
        ok: false,
        error: `"match_score" hors bornes ${MATCH_SCORE_MIN}-${MATCH_SCORE_MAX} (élément ${i})`,
      };
    }
    proposals.push({
      destination: p.destination,
      country_code: p.country_code.toUpperCase(),
      argument: p.argument,
      budget_estimate: p.budget_estimate,
      best_dates: p.best_dates,
      start_date: p.start_date,
      end_date: p.end_date,
      match_score: p.match_score,
    });
  }
  return { ok: true, proposals };
}

async function generateProposals(
  anthropic: Anthropic,
  profile: GroupProfile,
): Promise<Proposal[]> {
  const todayIso = new Date().toISOString().split("T")[0] ?? "";
  const systemPrompt = buildSystemPrompt(profile, todayIso);
  const basePrompt = `Profil agrégé du groupe :\n${JSON.stringify(profile, null, 2)}`;

  let lastError = "";
  for (let attempt = 1; attempt <= LLM_MAX_ATTEMPTS; attempt++) {
    const userPrompt =
      attempt === 1
        ? basePrompt
        : `${basePrompt}\n\nATTENTION : ta réponse précédente était invalide (${lastError}). Renvoie UNIQUEMENT le tableau JSON valide, rien d'autre.`;

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(text));
    } catch {
      lastError = "JSON non parsable";
      continue;
    }

    const result = validateProposals(parsed, profile.budget_min, todayIso);
    if (result.ok) return result.proposals;
    lastError = result.error;
  }
  throw new Error(`Réponse IA invalide après ${LLM_MAX_ATTEMPTS} tentatives : ${lastError}`);
}

// ─────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Utiliser POST.");
  }

  // ── Config ──
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(500, "config_error", "Variables Supabase manquantes dans l'environnement.");
  }
  if (!anthropicApiKey) {
    return errorResponse(
      500,
      "config_error",
      "ANTHROPIC_API_KEY non configurée. Exécuter : supabase secrets set ANTHROPIC_API_KEY=...",
    );
  }

  // ── Body ──
  let matchId: string;
  try {
    const body: unknown = await req.json();
    const id = (body as Record<string, unknown>)?.match_id;
    if (typeof id !== "string" || id.length === 0) {
      return errorResponse(400, "invalid_body", 'Body attendu : { "match_id": "<uuid>" }.');
    }
    matchId = id;
  } catch {
    return errorResponse(400, "invalid_body", "Body JSON invalide.");
  }

  // ── Auth : résoudre l'utilisateur depuis le JWT ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse(401, "unauthorized", "Header Authorization manquant.");
  }
  const userClient: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse(401, "unauthorized", "JWT invalide ou expiré.");
  }
  const userId = userData.user.id;

  // Client service_role : lectures/écritures qui bypass le RLS
  // (les contrôles d'accès sont faits explicitement ci-dessous)
  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── Vérifications ──
  const { data: match, error: matchError } = await admin
    .from("trip_matches")
    .select("id, status")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) {
    return errorResponse(500, "db_error", `Lecture du match impossible : ${matchError.message}`);
  }
  if (!match) {
    return errorResponse(404, "match_not_found", "Ce match n'existe pas.");
  }

  const { data: participants, error: participantsError } = await admin
    .from("match_participants")
    .select("user_id")
    .eq("match_id", matchId);
  if (participantsError || !participants) {
    return errorResponse(500, "db_error", "Lecture des participants impossible.");
  }
  if (!participants.some((p: { user_id: string }) => p.user_id === userId)) {
    return errorResponse(403, "not_participant", "Vous ne participez pas à ce match.");
  }

  if (match.status !== "collecting") {
    return errorResponse(
      409,
      "invalid_status",
      `Le match est en status "${match.status}" — la génération n'est possible qu'en "collecting".`,
    );
  }

  const { data: responses, error: responsesError } = await admin
    .from("match_responses")
    .select("user_id, answers")
    .eq("match_id", matchId);
  if (responsesError || !responses) {
    return errorResponse(500, "db_error", "Lecture des réponses impossible.");
  }
  const respondedIds = new Set(responses.map((r: { user_id: string }) => r.user_id));
  const missingCount = participants.filter(
    (p: { user_id: string }) => !respondedIds.has(p.user_id),
  ).length;
  if (missingCount > 0) {
    return errorResponse(
      409,
      "responses_incomplete",
      `${missingCount} participant(s) n'ont pas encore répondu au questionnaire (${respondedIds.size}/${participants.length} réponses).`,
    );
  }

  // ── Verrou optimiste : collecting → proposing ──
  // Protège contre deux appels simultanés (un seul gagne la transition).
  const { data: locked, error: lockError } = await admin
    .from("trip_matches")
    .update({ status: "proposing" })
    .eq("id", matchId)
    .eq("status", "collecting")
    .select("id");
  if (lockError || !locked || locked.length === 0) {
    return errorResponse(409, "already_generating", "Une génération est déjà en cours pour ce match.");
  }

  try {
    // ── Agrégation + IA ──
    const allAnswers = responses.map((r: { answers: unknown }) => (r.answers ?? {}) as MatchAnswers);
    const profile = aggregateAnswers(allAnswers);

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const proposals = await generateProposals(anthropic, profile);

    // ── Insertion + passage en voting ──
    const rows = proposals.map((p, i) => ({
      match_id: matchId,
      destination: p.destination,
      country_code: p.country_code,
      argument: p.argument,
      budget_estimate: p.budget_estimate,
      best_dates: p.best_dates,
      start_date: p.start_date,
      end_date: p.end_date,
      match_score: p.match_score,
      position: i + 1,
    }));
    const { data: inserted, error: insertError } = await admin
      .from("match_proposals")
      .insert(rows)
      .select();
    if (insertError) {
      throw new Error(`Insertion des propositions impossible : ${insertError.message}`);
    }

    const { error: statusError } = await admin
      .from("trip_matches")
      .update({ status: "voting" })
      .eq("id", matchId);
    if (statusError) {
      throw new Error(`Passage en "voting" impossible : ${statusError.message}`);
    }

    return jsonResponse(200, { match_id: matchId, status: "voting", proposals: inserted });
  } catch (err) {
    // Échec après le verrou → on rend le match ré-exécutable
    await admin
      .from("trip_matches")
      .update({ status: "collecting" })
      .eq("id", matchId)
      .eq("status", "proposing");

    if (err instanceof Anthropic.APIError) {
      return errorResponse(
        502,
        "anthropic_error",
        `Erreur API Anthropic (${err.status ?? "réseau"}) : ${err.message}`,
      );
    }
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return errorResponse(502, "generation_failed", message);
  }
});
