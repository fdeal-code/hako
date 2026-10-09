// HAKO — Planning : calculs purs d'une journée (maquette « Planning · Jour de transfert »)
// En-tête du jour, pastilles de ville, type de créneau, bandeau « Arrivée à … ».
// Testés dans tests/planningDay.test.ts.

export interface DayStop {
  id: string;
  position: number;
  place_name: string;
  start_date: string;
  end_date: string;
}

export interface DayEntry {
  id: string;
  title: string;
  start_time: string | null;
  stop_id: string | null;
  wish: { category: string | null } | null;
}

export type EntryKind = 'transport' | 'lodging' | 'food' | 'activity' | 'other';

const WEEKDAYS = ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'];
const MONTHS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];
const TRANSPORT_WORDS = ['→', 'train', 'shinkansen', 'vol ', 'bus', 'ferry', 'transfert'];
const MS_PER_DAY = 86_400_000;

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

function dayNumber(iso: string): number {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** « VEN. 05 JUIN » */
export function longDayLabel(iso: string): string {
  const { y, m, d } = parts(iso);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
  return `${weekday} ${String(d).padStart(2, '0')} ${MONTHS[m - 1] ?? ''}`;
}

/** Étapes présentes un jour donné (2 le jour d'un transfert : celle qu'on quitte, puis celle où on arrive). */
export function stopsOnDay<T extends DayStop>(stops: readonly T[], day: string): T[] {
  const n = dayNumber(day);
  return stops
    .filter(s => dayNumber(s.start_date) <= n && n <= dayNumber(s.end_date))
    .sort((a, b) => a.position - b.position);
}

/**
 * En-tête du jour : « ROME · VEN. 05 JUIN · DERNIER JOUR ».
 * Jour de transfert → l'étape qu'on quitte ; sinon l'étape du jour avec
 * « JOUR n » (ou « ARRIVÉE » le premier jour).
 */
export function dayHeader<T extends DayStop>(stops: readonly T[], day: string): string {
  const present = stopsOnDay(stops, day);
  const date = longDayLabel(day);
  const leaving = present.find(s => s.end_date.slice(0, 10) === day.slice(0, 10) && present.length > 1)
    ?? (present.length === 1 && present[0]?.end_date.slice(0, 10) === day.slice(0, 10) && present[0] !== stops[stops.length - 1] ? present[0] : undefined);
  if (leaving) return `${leaving.place_name.toUpperCase()} · ${date} · DERNIER JOUR`;
  const stop = present[present.length - 1];
  if (!stop) return date;
  const index = dayNumber(day) - dayNumber(stop.start_date) + 1;
  const suffix = index === 1 ? 'ARRIVÉE' : `JOUR ${index}`;
  return `${stop.place_name.toUpperCase()} · ${date} · ${suffix}`;
}

/** Type d'un créneau, pour l'icône et la couleur de la carte. */
export function entryKind(entry: DayEntry, hasTicket: boolean): EntryKind {
  const title = entry.title.toLowerCase();
  if (hasTicket || TRANSPORT_WORDS.some(w => title.includes(w))) return 'transport';
  if (title.startsWith('check-in') || title.startsWith('check-out') || entry.wish?.category === 'hotel') return 'lodging';
  if (entry.wish?.category === 'restaurant' || entry.wish?.category === 'cafe' || entry.wish?.category === 'bar') return 'food';
  if (entry.wish) return 'activity';
  return 'other';
}

/**
 * Jour de transfert : position du bandeau « Arrivée à … » dans la liste
 * (avant le premier créneau rattaché à l'étape d'arrivée). -1 si pas de transfert.
 */
export function arrivalIndex<T extends DayEntry, S extends DayStop>(entries: readonly T[], stops: readonly S[], day: string): number {
  const present = stopsOnDay(stops, day);
  const arriving = present.length > 1 ? present[present.length - 1] : undefined;
  if (!arriving) return -1;
  const idx = entries.findIndex(e => e.stop_id === arriving.id);
  return idx === -1 ? entries.length : idx;
}
