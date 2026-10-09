// HAKO — Après le voyage : calculs purs (avis, stats, podium, trophées, partage)
// Sans dépendance React Native → testés dans tests/pastRecap.test.ts.

import type {
  PastExpense, PastMember, RecapBadge, RecapStats, ReviewableItem, ReviewableWish, ReviewRow, TripPhoto,
} from '../types/pastTrip';

const LODGING_CATEGORIES = ['hotel', 'lodging'];
const MS_PER_DAY = 86_400_000;
const PODIUM_SIZE = 3;

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / MS_PER_DAY;
}

/** Nombre de jours du voyage, départ et retour inclus (12 → 19 juin = 8 jours). */
export function tripDayCount(startDate: string, endDate: string): number {
  return Math.max(1, dayNumber(endDate) - dayNumber(startDate) + 1);
}

/** Envies à noter, avec ma note et la moyenne du groupe. Logements d'abord. */
export function buildReviewables(
  wishes: readonly ReviewableWish[],
  reviews: readonly ReviewRow[],
  userId: string | null,
): ReviewableItem[] {
  return wishes
    .map(w => {
      const mine = reviews.filter(r => r.wish_id === w.id);
      const my = userId ? mine.find(r => r.user_id === userId) : undefined;
      const avg = mine.length > 0 ? mine.reduce((s, r) => s + r.rating, 0) / mine.length : null;
      const lodging = !!w.booked_at || LODGING_CATEGORIES.includes(w.category ?? '');
      return {
        wishId: w.id,
        title: w.title,
        imageUrl: w.image_url,
        address: w.address,
        stopId: w.stop_id,
        kind: lodging ? 'lodging' as const : 'activity' as const,
        myRating: my?.rating ?? null,
        myComment: my?.comment ?? null,
        avgRating: avg,
        reviewCount: mine.length,
      };
    })
    .sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === 'lodging' ? -1 : 1));
}

export function recapStats(input: {
  startDate: string;
  endDate: string;
  cityCount: number;
  placeCount: number;
  photoCount: number;
  expenses: readonly PastExpense[];
  memberCount: number;
}): RecapStats {
  const total = input.expenses.reduce((s, e) => s + e.amount, 0);
  return {
    days: tripDayCount(input.startDate, input.endDate),
    cities: Math.max(1, input.cityCount),
    places: input.placeCount,
    photos: input.photoCount,
    total,
    perPerson: input.memberCount > 0 ? total / input.memberCount : total,
  };
}

/** Les mieux notés par le groupe (au moins un avis). */
export function podium(items: readonly ReviewableItem[]): ReviewableItem[] {
  return items
    .filter(i => i.avgRating !== null)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.reviewCount - a.reviewCount)
    .slice(0, PODIUM_SIZE);
}

function topBy(counts: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null;
  for (const entry of counts) if (entry[1] > 0 && (!best || entry[1] > best[1])) best = entry;
  return best;
}

function tally<T>(rows: readonly T[], key: (row: T) => string, weight: (row: T) => number = () => 1): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + weight(row));
  return counts;
}

/** Trophées humoristiques : qui a le plus photographié, payé, noté, proposé. */
export function recapBadges(input: {
  members: readonly PastMember[];
  photos: readonly TripPhoto[];
  expenses: readonly PastExpense[];
  reviews: readonly ReviewRow[];
  wishAuthors: Readonly<Record<string, string>>;
}): RecapBadge[] {
  const byId = new Map(input.members.map(m => [m.userId, m]));
  const badges: RecapBadge[] = [];
  const add = (id: RecapBadge['id'], icon: RecapBadge['icon'], title: string, top: [string, number] | null, detail: (n: number) => string) => {
    const winner = top ? byId.get(top[0]) : undefined;
    if (top && winner) badges.push({ id, icon, title, winner, detail: detail(top[1]) });
  };
  add('photographer', 'camera', 'Le photographe', topBy(tally(input.photos, p => p.uploadedBy)),
    n => `${n} photo${n > 1 ? 's' : ''}`);
  add('banker', 'wallet', 'Le banquier', topBy(tally(input.expenses, e => e.paid_by, e => e.amount)),
    n => `a avancé ${Math.round(n)} €`);
  add('critic', 'star', 'Le critique', topBy(tally(input.reviews, r => r.user_id)),
    n => `${n} avis`);
  add('explorer', 'compass', 'L’explorateur', topBy(tally(Object.values(input.wishAuthors), a => a)),
    n => `${n} idée${n > 1 ? 's' : ''} validée${n > 1 ? 's' : ''}`);
  return badges;
}

/** Texte partagé (WhatsApp, Messages…) depuis le récap. */
export function buildRecapMessage(input: {
  name: string;
  dates: string;
  stats: RecapStats;
  top: readonly ReviewableItem[];
}): string {
  const lines = [
    `🌍 ${input.name} — ${input.dates}`,
    `${input.stats.days} jours · ${input.stats.cities} ville${input.stats.cities > 1 ? 's' : ''} · ${input.stats.places} lieux · ${input.stats.photos} photos`,
  ];
  if (input.top.length > 0) {
    lines.push('', 'Notre podium :');
    input.top.forEach((item, i) => lines.push(`${i + 1}. ${item.title} (${(item.avgRating ?? 0).toFixed(1)}/5)`));
  }
  lines.push('', 'Organisé avec Hako ✈️');
  return lines.join('\n');
}
