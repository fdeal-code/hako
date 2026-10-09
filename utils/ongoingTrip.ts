// HAKO — Voyage en cours : calculs purs (jour du voyage, en cours / prochain,
// compte à rebours, billet du jour). Testés dans tests/ongoingTrip.test.ts.

const MS_PER_DAY = 86_400_000;
const MINUTES_PER_HOUR = 60;
const TICKET_CATEGORIES = ['flight', 'transport', 'activity'];

export interface TimedItem {
  start_time: string | null;   // "HH:MM" ou "HH:MM:SS"
  end_time: string | null;
}

export interface DatedDoc {
  category: string;
  event_date: string | null;
  details?: { departure?: string } | null;
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / MS_PER_DAY;
}

/** « J6 / 14 » : jour courant (1 = départ) et nombre de jours du voyage. */
export function tripDay(startDate: string, endDate: string, today: string): { day: number; total: number } {
  const total = dayNumber(endDate) - dayNumber(startDate) + 1;
  const day = Math.min(Math.max(dayNumber(today) - dayNumber(startDate) + 1, 1), total);
  return { day, total };
}

/** "08:30:00" → minutes depuis minuit (null si absent). */
export function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return Number.isFinite(h) ? (h ?? 0) * MINUTES_PER_HOUR + (m ?? 0) : null;
}

/** Activité en cours (début ≤ maintenant < fin) et prochaine à venir, dans une journée triée. */
export function nowAndNext<T extends TimedItem>(items: readonly T[], nowMinutes: number): { current: T | null; next: T | null; left: number } {
  const sorted = [...items].sort((a, b) => (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0));
  let current: T | null = null;
  let next: T | null = null;
  for (const item of sorted) {
    const start = toMinutes(item.start_time);
    const end = toMinutes(item.end_time) ?? (start !== null ? start + MINUTES_PER_HOUR : null);
    if (start === null) continue;
    if (start <= nowMinutes && end !== null && nowMinutes < end) current = current ?? item;
    else if (start > nowMinutes && !next) next = item;
  }
  const left = sorted.filter(i => (toMinutes(i.start_time) ?? 0) > nowMinutes).length;
  return { current, next, left };
}

/** « dans 25 min », « dans 2 h », « dans 1 h 10 ». */
export function countdown(fromMinutes: number, toMinutesValue: number): string {
  const diff = Math.max(toMinutesValue - fromMinutes, 0);
  if (diff < MINUTES_PER_HOUR) return `dans ${diff} min`;
  const h = Math.floor(diff / MINUTES_PER_HOUR);
  const m = diff % MINUTES_PER_HOUR;
  return m === 0 ? `dans ${h} h` : `dans ${h} h ${String(m).padStart(2, '0')}`;
}

/** "08:30:00" → "08:30". */
export function shortTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

/**
 * Billet du jour : un billet (vol, train, activité) daté d'aujourd'hui dont le
 * départ n'est pas passé ; sinon le premier document du jour.
 */
export function pickTodayDoc<T extends DatedDoc>(docs: readonly T[], today: string, nowMinutes: number): T | null {
  const todays = docs.filter(d => d.event_date?.slice(0, 10) === today);
  const upcomingTickets = todays
    .filter(d => TICKET_CATEGORIES.includes(d.category))
    .filter(d => (toMinutes(d.details?.departure) ?? Infinity) >= nowMinutes)
    .sort((a, b) => (toMinutes(a.details?.departure) ?? Infinity) - (toMinutes(b.details?.departure) ?? Infinity));
  return upcomingTickets[0] ?? todays[0] ?? null;
}

// ─── Accès direct : itinéraire, billet lié, idées dans le coin ───────────────
export interface Destination {
  label: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Lien « Y aller » : Plans sur iPhone, Google Maps ailleurs. null si aucune position. */
export function directionsUrl(dest: Destination, os: 'ios' | 'android' | 'other'): string | null {
  const target = dest.latitude !== null && dest.longitude !== null
    ? `${dest.latitude},${dest.longitude}`
    : dest.address ? encodeURIComponent(dest.address) : null;
  if (!target) return null;
  if (os === 'ios') return `https://maps.apple.com/?daddr=${target}&q=${encodeURIComponent(dest.label)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${target}`;
}

/** Billet du jour qui correspond à une activité (même titre, ou même heure de départ). */
export function ticketFor<T extends DatedDoc & { title: string }>(
  item: TimedItem & { title: string },
  docs: readonly T[],
  today: string,
): T | null {
  const todays = docs.filter(d => d.event_date?.slice(0, 10) === today);
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return todays.find(d => norm(d.title) === norm(item.title))
    ?? todays.find(d => d.details?.departure && toMinutes(d.details.departure) === toMinutes(item.start_time))
    ?? null;
}

/** Envies de l'étape du jour pas encore planifiées : validées d'abord. */
export function nearbyIdeas<T extends { status: string; stop_id: string | null; title: string }>(
  wishes: readonly T[],
  stopId: string | null,
): T[] {
  const rank = (s: string) => (s === 'validated' ? 0 : 1);
  return wishes
    .filter(w => stopId !== null && w.stop_id === stopId)
    .sort((a, b) => rank(a.status) - rank(b.status) || a.title.localeCompare(b.title));
}
