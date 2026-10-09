// HAKO — Partage depuis TikTok / Instagram / Safari vers Hako
// Fonctions pures : lien partagé, ordre des voyages proposés.
// Testées dans tests/shareIntake.test.ts.

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

/** Premier lien http(s) d'un texte (même règle que extractUrl dans wishLinks.ts). */
function extractUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);
  return match ? match[0].replace(/[).,;!?]+$/, '') : null;
}

export interface SharedContent { webUrl?: string | null; text?: string | null }

export interface ShareTrip { id: string; name: string; start_date: string; end_date: string }

/** Le lien partagé : l'URL détectée, sinon la première URL du texte (« Regarde ! https://… »). */
export function sharedLink(content: SharedContent): string | null {
  return content.webUrl?.trim() || (content.text ? extractUrl(content.text) : null);
}

export type TripMoment = 'now' | 'soon' | 'past';

export function tripMoment(trip: ShareTrip, today: string): TripMoment {
  if (trip.start_date <= today && today <= trip.end_date) return 'now';
  return trip.end_date < today ? 'past' : 'soon';
}

/** Voyages proposés : en cours, puis à venir (le plus proche d'abord), puis passés (le plus récent d'abord). */
export function tripsForShare<T extends ShareTrip>(trips: readonly T[], today: string): T[] {
  const rank = { now: 0, soon: 1, past: 2 } as const;
  return [...trips].sort((a, b) => {
    const ma = tripMoment(a, today);
    const mb = tripMoment(b, today);
    if (ma !== mb) return rank[ma] - rank[mb];
    return ma === 'past' ? b.start_date.localeCompare(a.start_date) : a.start_date.localeCompare(b.start_date);
  });
}
