// HAKO — Voyages multi-étapes : fonctions pures (dates, nuits, libellés)
// Aucun accès réseau/état → testables unitairement.
// Les dates sont manipulées en "YYYY-MM-DD" et calculées en UTC pour ne
// jamais décaler d'un jour selon le fuseau du téléphone.

import type { NewTripStop, StopDraft, TripStop } from '@/types/tripStops';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_NIGHTS_PER_STOP = 1;
const LABEL_MAX_NAMES = 2;

function parseDay(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Date locale → "YYYY-MM-DD" sans passer par l'UTC. */
export function localDayIso(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function addDays(day: string, days: number): string {
  return formatDay(parseDay(day) + days * MS_PER_DAY);
}

/** Nombre de nuits entre deux dates (02 → 05 juin = 3 nuits). */
export function nightsBetween(startDate: string, endDate: string): number {
  return Math.max(0, Math.round((parseDay(endDate) - parseDay(startDate)) / MS_PER_DAY));
}

/**
 * Répartit `totalNights` le plus équitablement possible entre `stopCount`
 * étapes, les nuits en trop allant aux premières (7 nuits / 3 → [3, 2, 2]).
 */
export function distributeNights(totalNights: number, stopCount: number): number[] {
  if (stopCount <= 0) return [];
  const base = Math.floor(totalNights / stopCount);
  const extra = totalNights % stopCount;
  return Array.from({ length: stopCount }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Ajoute (+1) ou retire (-1) une nuit à l'étape `index` en gardant le total
 * constant : la nuit est prise / rendue à une autre étape (la plus proche
 * qui peut céder). Chaque étape garde au moins une nuit. Retourne le
 * tableau inchangé si l'opération est impossible.
 */
export function adjustNights(nights: readonly number[], index: number, delta: 1 | -1): number[] {
  const current = nights[index];
  if (current === undefined) return [...nights];
  const next = [...nights];
  // Candidats triés par proximité (voisin suivant d'abord)
  const others = next
    .map((_, i) => i)
    .filter(i => i !== index)
    .sort((a, b) => Math.abs(a - index) - Math.abs(b - index) || b - a);
  if (delta === 1) {
    const donor = others.find(i => (next[i] ?? 0) > MIN_NIGHTS_PER_STOP);
    if (donor === undefined) return next;
    next[donor] = (next[donor] ?? 0) - 1;
    next[index] = current + 1;
  } else {
    const receiver = others[0];
    if (current <= MIN_NIGHTS_PER_STOP || receiver === undefined) return next;
    next[receiver] = (next[receiver] ?? 0) + 1;
    next[index] = current - 1;
  }
  return next;
}

/**
 * Nuits rendues quand on retire l'étape `index` : elles vont à l'étape
 * précédente (ou à la suivante si c'est la première). Retourne les nuits
 * des étapes restantes, dans l'ordre.
 */
export function nightsAfterRemoval(nights: readonly number[], index: number): number[] {
  const removed = nights[index];
  if (removed === undefined) return [...nights];
  const rest = nights.filter((_, i) => i !== index);
  const receiver = index > 0 ? index - 1 : 0;
  if (rest[receiver] !== undefined) rest[receiver] = (rest[receiver] ?? 0) + removed;
  return rest;
}

/**
 * Nuits après l'ajout d'une ville en fin de voyage : la dernière étape lui
 * cède une nuit. null si impossible (la dernière étape n'a qu'une nuit).
 */
export function nightsAfterAppend(nights: readonly number[]): number[] | null {
  const lastIndex = nights.length - 1;
  const last = nights[lastIndex];
  if (last === undefined || last <= MIN_NIGHTS_PER_STOP) return null;
  const next = [...nights];
  next[lastIndex] = last - 1;
  next.push(1);
  return next;
}

/** Somme des nuits des brouillons — à comparer au total du voyage. */
export function sumNights(drafts: readonly StopDraft[]): number {
  return drafts.reduce((total, draft) => total + draft.nights, 0);
}

/** Vrai si chaque étape a au moins une nuit et que le total tombe juste. */
export function isNightSplitValid(drafts: readonly StopDraft[], totalNights: number): boolean {
  return drafts.length > 0
    && drafts.every(d => d.nights >= MIN_NIGHTS_PER_STOP)
    && sumNights(drafts) === totalNights;
}

/**
 * Transforme les brouillons (nuits) en étapes datées. Le jour de transfert
 * appartient aux deux étapes : end_date(n) === start_date(n + 1).
 */
export function splitDatesIntoStops(
  tripStartDate: string,
  drafts: readonly StopDraft[],
): Omit<NewTripStop, 'lat' | 'lng'>[] {
  let cursor = tripStartDate;
  return drafts.map(draft => {
    const start = cursor;
    const end = addDays(start, draft.nights);
    cursor = end;
    return {
      place_name: draft.place_name,
      place_id: draft.place_id,
      country_code: draft.country_code,
      start_date: start,
      end_date: end,
    };
  });
}

/** Libellé court pour `trips.destination` : "Rome", "Rome, Florence", "Rome, Florence +1". */
export function buildDestinationLabel(placeNames: readonly string[]): string {
  const shown = placeNames.slice(0, LABEL_MAX_NAMES).join(', ');
  const hidden = placeNames.length - LABEL_MAX_NAMES;
  return hidden > 0 ? `${shown} +${hidden}` : shown;
}

/** Couleur d'une étape selon sa position (palette reprise en boucle). */
export function stopColor(position: number, palette: readonly string[]): string {
  if (palette.length === 0) return '';
  return palette[((position % palette.length) + palette.length) % palette.length] ?? '';
}

/**
 * Pour chaque nuit du voyage, l'index de l'étape où l'on dort
 * (nuits [3, 2, 2] → [0, 0, 0, 1, 1, 2, 2]).
 */
export function nightOwners(nights: readonly number[]): number[] {
  return nights.flatMap((count, stopIndex) => Array.from({ length: Math.max(0, count) }, () => stopIndex));
}

/** Toutes les étapes qui couvrent un jour (2 le jour de transfert : départ puis arrivée). */
export function stopsForDay<T extends { start_date: string; end_date: string }>(stops: readonly T[], day: string): T[] {
  const target = parseDay(day);
  return stops.filter(s => parseDay(s.start_date) <= target && target <= parseDay(s.end_date));
}

/** Jours du voyage, bornes incluses ("2026-06-02" → "2026-06-09" = 8 jours). */
export function tripDays(startDate: string, endDate: string): string[] {
  const count = nightsBetween(startDate, endDate) + 1;
  return Array.from({ length: count }, (_, i) => addDays(startDate, i));
}

/**
 * Étape géolocalisée la plus proche d'un point (distance équirectangulaire,
 * largement suffisante pour départager des villes). null si aucune étape
 * n'a de coordonnées.
 */
export function nearestStop<T extends { lat: number | null; lng: number | null }>(
  stops: readonly T[],
  lat: number,
  lng: number,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const stop of stops) {
    if (stop.lat === null || stop.lng === null) continue;
    const x = (stop.lng - lng) * Math.cos(((stop.lat + lat) / 2) * (Math.PI / 180));
    const y = stop.lat - lat;
    const distance = x * x + y * y;
    if (distance < bestDistance) { bestDistance = distance; best = stop; }
  }
  return best;
}

/** Étape où l'on se trouve un jour donné (le jour de transfert renvoie l'étape d'arrivée). */
export function stopForDay(stops: readonly TripStop[], day: string): TripStop | null {
  const target = parseDay(day);
  let match: TripStop | null = null;
  for (const stop of stops) {
    if (parseDay(stop.start_date) <= target && target <= parseDay(stop.end_date)) match = stop;
  }
  return match;
}
