// HAKO — Trip Match : score de compatibilité + insights du groupe
// Fonctions pures (aucun accès réseau/état) → testables unitairement.

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { MatchDateRange, MatchResponsePreview, MatchScope } from '@/types/tripMatch';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface MatchInsight {
  kind: 'convergence' | 'friction';
  icon: IoniconName;
  text: string;
}

// ─── Réglages du score ────────────────────────────────────────────────────────
const WEIGHTS = {
  dates: 0.3,
  budget: 0.2,
  scope: 0.15,
  environments: 0.175,
  moods: 0.175,
} as const;
const SCORE_FLOOR = 35;   // un groupe qui joue le jeu ne descend jamais sous ce score
const SCORE_MAX = 100;
const SOLO_SCORE = 100;   // seul avec soi-même, le match est parfait
const NEUTRAL = 0.5;      // sous-score quand une dimension est sans donnée

const SCOPE_ORDER: readonly MatchScope[] = ['region', 'pays', 'europe', 'monde'];

// Libellés fun par valeur de carte (environnements + moods)
const CARD_LABELS: Record<string, string> = {
  mer:      'la mer 🌊',
  montagne: 'la montagne ⛰️',
  ville:    'la ville 🏙️',
  campagne: 'la campagne 🌾',
  chill:    'le chill 🧘',
  'fête':   'la fête 🪩',
  culture:  'la culture 🏛️',
  food:     'la food 🍜',
};

// ─── Helpers plages de dates ──────────────────────────────────────────────────
const DAY_MS = 86_400_000;

function intersectRangePair(
  a: readonly MatchDateRange[],
  b: readonly MatchDateRange[],
): MatchDateRange[] {
  const out: MatchDateRange[] = [];
  for (const ra of a) {
    for (const rb of b) {
      const start = ra.start > rb.start ? ra.start : rb.start;
      const end = ra.end < rb.end ? ra.end : rb.end;
      if (start <= end) out.push({ start, end });
    }
  }
  return out;
}

/** Plages communes à tous ceux qui ont donné des dates. */
function intersectAllRanges(lists: readonly MatchDateRange[][]): MatchDateRange[] {
  const filled = lists.filter(l => l.length > 0);
  const first = filled[0];
  if (!first) return [];
  return filled.slice(1).reduce<MatchDateRange[]>(
    (acc, list) => intersectRangePair(acc, list),
    [...first],
  );
}

function daysInRanges(ranges: readonly MatchDateRange[]): number {
  return ranges.reduce(
    (sum, r) =>
      sum + Math.round((Date.parse(`${r.end}T00:00:00Z`) - Date.parse(`${r.start}T00:00:00Z`)) / DAY_MS) + 1,
    0,
  );
}

// ─── Helpers ensembles ────────────────────────────────────────────────────────
function intersectAll(lists: readonly string[][]): string[] {
  const first = lists[0];
  if (!first) return [];
  return lists.slice(1).reduce<string[]>(
    (acc, list) => acc.filter(v => list.includes(v)),
    [...first],
  );
}

function jaccard(lists: readonly string[][]): number {
  const union = new Set(lists.flat());
  if (union.size === 0) return NEUTRAL;
  return intersectAll(lists).length / union.size;
}

// ─── Sous-scores (0 → 1) ──────────────────────────────────────────────────────
function datesScore(lists: readonly MatchDateRange[][]): number {
  const filled = lists.filter(l => l.length > 0);
  if (filled.length === 0) return NEUTRAL;
  const commonDays = daysInRanges(intersectAllRanges(filled));
  const smallest = Math.min(...filled.map(daysInRanges));
  return smallest > 0 ? Math.min(1, commonDays / smallest) : NEUTRAL;
}

function budgetScore(budgets: readonly number[]): number {
  const valid = budgets.filter(b => b > 0);
  if (valid.length === 0) return NEUTRAL;
  return Math.min(...valid) / Math.max(...valid);
}

function scopeScore(scopes: readonly (MatchScope | undefined)[]): number {
  const idx = scopes
    .map(s => (s ? SCOPE_ORDER.indexOf(s) : -1))
    .filter(i => i >= 0);
  if (idx.length === 0) return NEUTRAL;
  return 1 - (Math.max(...idx) - Math.min(...idx)) / (SCOPE_ORDER.length - 1);
}

// ─── API publique ─────────────────────────────────────────────────────────────
/** Score de compatibilité du groupe, entier entre SCORE_FLOOR et 100. */
export function computeCompatibility(responses: readonly MatchResponsePreview[]): number {
  if (responses.length <= 1) return SOLO_SCORE;
  const answers = responses.map(r => r.answers);

  const weighted =
    WEIGHTS.dates        * datesScore(answers.map(a => a.dates ?? [])) +
    WEIGHTS.budget       * budgetScore(answers.map(a => a.budget ?? 0)) +
    WEIGHTS.scope        * scopeScore(answers.map(a => a.scope)) +
    WEIGHTS.environments * jaccard(answers.map(a => a.environments ?? [])) +
    WEIGHTS.moods        * jaccard(answers.map(a => a.moods ?? []));

  return Math.round(SCORE_FLOOR + weighted * (SCORE_MAX - SCORE_FLOOR));
}

/** 2-3 insights : convergences d'abord, puis un point de friction s'il y en a un. */
export function computeInsights(responses: readonly MatchResponsePreview[]): MatchInsight[] {
  const answers = responses.map(r => r.answers);
  const convergences: MatchInsight[] = [];

  // Envies partagées par TOUT le monde (environnements puis moods)
  for (const key of ['environments', 'moods'] as const) {
    const shared = intersectAll(answers.map(a => a[key] ?? []));
    const first = shared[0];
    if (first !== undefined) {
      convergences.push({
        kind: 'convergence',
        icon: key === 'environments' ? 'earth-outline' : 'sparkles-outline',
        text: `Unanimité sur ${CARD_LABELS[first] ?? first} — même pas eu besoin de débattre.`,
      });
    }
  }

  // Agendas alignés
  const commonRanges = intersectAllRanges(answers.map(a => a.dates ?? []));
  if (commonRanges.length > 0 && convergences.length < 2) {
    convergences.push({
      kind: 'convergence',
      icon: 'calendar-outline',
      text: `${commonRanges.length} créneau${commonRanges.length > 1 ? 'x' : ''} où tout le monde est dispo. Miracle.`,
    });
  }
  if (convergences.length === 0) {
    convergences.push({
      kind: 'convergence',
      icon: 'people-outline',
      text: 'Vous êtes chauds pour partir ensemble — c’est déjà une base solide.',
    });
  }

  // Point de friction (un seul, le plus parlant)
  const frictions: MatchInsight[] = [];
  const budgets = answers.map(a => a.budget ?? 0).filter(b => b > 0);
  if (budgets.length > 1 && budgetScore(budgets) < 0.6) {
    frictions.push({
      kind: 'friction',
      icon: 'wallet-outline',
      text: `Les budgets vont de ${Math.min(...budgets)} € à ${Math.max(...budgets)} € — l’IA va devoir ruser.`,
    });
  } else if (scopeScore(answers.map(a => a.scope)) < 0.67) {
    frictions.push({
      kind: 'friction',
      icon: 'compass-outline',
      text: 'Entre « tout près » et « le monde entier », il va falloir trancher.',
    });
  } else if (commonRanges.length === 0 && answers.some(a => (a.dates ?? []).length > 0)) {
    frictions.push({
      kind: 'friction',
      icon: 'calendar-outline',
      text: 'Vos agendas jouent à cache-cache — aucun créneau commun pour l’instant.',
    });
  }

  return [...convergences.slice(0, 2), ...frictions.slice(0, 1)];
}
