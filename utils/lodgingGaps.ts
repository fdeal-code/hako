// HAKO — Étapes sans logement (fonctions pures)
// Une étape est couverte si l'une de ses nuits a un logement : document de
// catégorie « hotel », envie logement marquée réservée, ou créneau
// « Check-in » au planning. Sert à proposer les logements au bon moment.
// Aucun import local : testable avec node --test.

export interface StopLike { id: string; place_name: string; start_date: string; end_date: string }

export interface LodgingCoverage {
  /** Dates des documents de logement (billet d'hôtel, réservation importée…) */
  hotelDays: readonly string[];
  /** Étapes où une envie logement est marquée « J'ai réservé » */
  bookedStopIds: readonly string[];
  /** Jours des créneaux « Check-in · … » du planning */
  checkInDays: readonly string[];
}

/** L'étape où l'on dort la nuit de `day` (arrivée incluse, départ exclu). */
export function stopForNight<T extends StopLike>(stops: readonly T[], day: string): T | null {
  return stops.find(s => s.start_date <= day && day < s.end_date) ?? null;
}

function isCovered(stop: StopLike, c: LodgingCoverage): boolean {
  if (c.bookedStopIds.includes(stop.id)) return true;
  const inStop = (d: string) => stop.start_date <= d.slice(0, 10) && d.slice(0, 10) < stop.end_date;
  return c.hotelDays.some(inStop) || c.checkInDays.some(inStop);
}

/** Étapes à venir, avec au moins une nuit, sans aucun logement trouvé. */
export function stopsWithoutLodging<T extends StopLike>(stops: readonly T[], coverage: LodgingCoverage, today: string): T[] {
  return stops.filter(s => s.end_date > s.start_date && s.end_date > today && !isCovered(s, coverage));
}
