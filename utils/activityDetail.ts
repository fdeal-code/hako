// HAKO — Fiche d'une activité : calculs purs (grand mot du haut, durée,
// changement d'horaire). Testés dans tests/activityDetail.test.ts.

const MINUTES_PER_HOUR = 60;
const DAY_END = 23 * MINUTES_PER_HOUR + 45;
const MIN_DURATION = 15;

/** Grand mot affiché sur la photo (maquette : « KAYAK », « DODO »…). */
const BIG_WORDS: Record<string, string> = {
  restaurant: 'MIAM', cafe: 'CAFÉ', bar: 'APÉRO', hotel: 'DODO', monument: 'VISITE',
  activity: 'GO', photo_spot: 'CLIC', transport: 'TRAJET',
};

export function bigWord(category: string | null, title: string, isTransport: boolean): string {
  if (isTransport) return BIG_WORDS.transport ?? 'TRAJET';
  if (category && BIG_WORDS[category]) return BIG_WORDS[category] ?? '';
  const first = title.split(/[\s'’-]+/)[0] ?? '';
  return first.length >= 3 && first.length <= 8 ? first.toUpperCase() : 'GO';
}

export function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return Number.isFinite(h) ? (h ?? 0) * MINUTES_PER_HOUR + (m ?? 0) : null;
}

export function fromMinutes(total: number): string {
  const clamped = Math.min(Math.max(total, 0), DAY_END);
  return `${String(Math.floor(clamped / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(clamped % MINUTES_PER_HOUR).padStart(2, '0')}`;
}

/** « 2 h 30 », « 45 min » ; null sans heure de fin. */
export function durationLabel(start: string | null, end: string | null): string | null {
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a === null || b === null || b <= a) return null;
  const d = b - a;
  const h = Math.floor(d / MINUTES_PER_HOUR);
  const m = d % MINUTES_PER_HOUR;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Décale le début ou la fin d'un créneau (pas de 15 min). Garde au moins
 * 15 min de durée : déplacer le début pousse la fin si besoin.
 */
export function shiftSlot(
  start: string,
  end: string | null,
  which: 'start' | 'end',
  deltaMinutes: number,
): { start: string; end: string } {
  const s = toMinutes(start) ?? 0;
  const e = toMinutes(end) ?? s + MINUTES_PER_HOUR;
  if (which === 'start') {
    const ns = Math.min(Math.max(s + deltaMinutes, 0), DAY_END - MIN_DURATION);
    const ne = Math.max(e + (ns - s), ns + MIN_DURATION);
    return { start: fromMinutes(ns), end: fromMinutes(ne) };
  }
  const ne = Math.min(Math.max(e + deltaMinutes, s + MIN_DURATION), DAY_END);
  return { start: fromMinutes(s), end: fromMinutes(ne) };
}
