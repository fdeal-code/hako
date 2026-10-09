// HAKO — Ajout au planning : créneau libre, chevauchements, jours possibles
// Fonctions pures, testées dans tests/planSlot.test.ts.

const MINUTES_PER_HOUR = 60;
const STEP = 15;
const DEFAULT_FROM = 9 * MINUTES_PER_HOUR;
const DEFAULT_UNTIL = 23 * MINUTES_PER_HOUR;

export interface Slot { start_time: string | null; end_time: string | null }

export function toMin(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return Number.isFinite(h) ? (h ?? 0) * MINUTES_PER_HOUR + (m ?? 0) : null;
}

export function toTime(total: number): string {
  const t = Math.min(Math.max(Math.round(total), 0), 24 * MINUTES_PER_HOUR - STEP);
  return `${String(Math.floor(t / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(t % MINUTES_PER_HOUR).padStart(2, '0')}`;
}

/** Intervalle [début, fin) d'un créneau ; sans fin, 1 h. */
function range(slot: Slot): [number, number] | null {
  const s = toMin(slot.start_time);
  if (s === null) return null;
  return [s, toMin(slot.end_time) ?? s + MINUTES_PER_HOUR];
}

/** Créneaux de la journée qui chevauchent [start, end). */
export function overlapping<T extends Slot>(day: readonly T[], start: string, end: string): T[] {
  const a = toMin(start) ?? 0;
  const b = toMin(end) ?? a + MINUTES_PER_HOUR;
  return day.filter(slot => {
    const r = range(slot);
    return r !== null && r[0] < b && a < r[1];
  });
}

/**
 * Premier début libre (par pas de 15 min, à partir de 9 h) pour une durée
 * donnée ; null si la journée est pleine jusqu'à 23 h.
 */
export function firstFreeStart(day: readonly Slot[], durationMinutes: number, from = DEFAULT_FROM): string | null {
  const busy = day.map(range).filter((r): r is [number, number] => r !== null).sort((x, y) => x[0] - y[0]);
  for (let t = Math.ceil(from / STEP) * STEP; t + durationMinutes <= DEFAULT_UNTIL; t += STEP) {
    if (!busy.some(([s, e]) => s < t + durationMinutes && t < e)) return toTime(t);
  }
  return null;
}

/** Fin = début + durée (bornée à 23:45). */
export function endFor(start: string, durationMinutes: number): string {
  return toTime((toMin(start) ?? DEFAULT_FROM) + durationMinutes);
}

/** Décale une heure de ±15 min (bornée à la journée). */
export function nudge(time: string, delta: number): string {
  return toTime((toMin(time) ?? DEFAULT_FROM) + delta);
}
