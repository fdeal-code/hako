// HAKO — Import de réservations : fonctions pures
// Réservation lue → catégorie de document, infos de billet, créneaux du
// planning, catégorie de dépense, alertes. Aucun import local (node --test).

export type Kind = 'flight' | 'train' | 'bus' | 'ferry' | 'hotel' | 'car' | 'activity' | 'restaurant' | 'other';

export interface BookingLike {
  kind: Kind;
  title: string;
  provider: string | null;
  reference: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  from_place: string | null;
  to_place: string | null;
  travelers: string[];
  total_price: number | null;
  currency: string | null;
}

export interface PlanningSlot { title: string; day: string; start: string | null; end: string | null; notes: string | null }

const TRANSPORT: readonly Kind[] = ['flight', 'train', 'bus', 'ferry'];
const HOTEL_CHECK_IN = '15:00';
const HOTEL_CHECK_OUT = '11:00';
export const HOME_CURRENCY = 'EUR';

export function isTransport(kind: Kind): boolean {
  return TRANSPORT.includes(kind);
}

/** Valeurs de la contrainte documents_category_check. */
export function docCategoryFor(kind: Kind): 'flight' | 'transport' | 'hotel' | 'activity' | 'restaurant' | 'other' {
  if (kind === 'flight') return 'flight';
  if (kind === 'train' || kind === 'bus' || kind === 'ferry' || kind === 'car') return 'transport';
  if (kind === 'hotel') return 'hotel';
  if (kind === 'activity') return 'activity';
  if (kind === 'restaurant') return 'restaurant';
  return 'other';
}

/** Valeurs de la contrainte expenses_category_check. */
export function expenseCategoryFor(kind: Kind): 'transport' | 'accommodation' | 'activity' | 'food' | 'other' {
  if (isTransport(kind) || kind === 'car') return 'transport';
  if (kind === 'hotel') return 'accommodation';
  if (kind === 'activity') return 'activity';
  if (kind === 'restaurant') return 'food';
  return 'other';
}

/** Infos de billet (documents.details) — seulement les champs connus. */
export function ticketDetailsFor(b: BookingLike): Record<string, string> {
  const details: Record<string, string> = {};
  const set = (key: string, value: string | null) => { if (value) details[key] = value; };
  set('from', b.from_place);
  set('to', b.to_place);
  if (isTransport(b.kind) || b.kind === 'activity') {
    set('departure', b.start_time);
    set('arrival', b.end_time);
  }
  set('reference', b.reference);
  if (b.travelers.length > 0) details.passenger = b.travelers.join(', ');
  return details;
}

/**
 * Créneaux du planning. Le titre d'un trajet reprend celui du document :
 * le planning relie ainsi le créneau au billet (tap → billet).
 */
export function planningSlotsFor(b: BookingLike): PlanningSlot[] {
  const ref = b.reference ? `Réf. ${b.reference}` : null;
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' · ') || null;
  const name = b.provider && !b.title.includes(b.provider) ? `${b.title} (${b.provider})` : b.title;

  if (isTransport(b.kind)) {
    if (!b.start_date) return [];
    const route = b.from_place && b.to_place ? `${b.from_place} → ${b.to_place}` : null;
    const sameDay = !b.end_date || b.end_date === b.start_date;
    return [{ title: b.title, day: b.start_date, start: b.start_time, end: sameDay ? b.end_time : null, notes: join(route, ref) }];
  }
  if (b.kind === 'hotel') {
    const slots: PlanningSlot[] = [];
    if (b.start_date) slots.push({ title: `Check-in · ${b.title}`, day: b.start_date, start: b.start_time ?? HOTEL_CHECK_IN, end: null, notes: ref });
    if (b.end_date && b.end_date !== b.start_date) slots.push({ title: `Check-out · ${b.title}`, day: b.end_date, start: b.end_time ?? HOTEL_CHECK_OUT, end: null, notes: ref });
    return slots;
  }
  if (b.kind === 'car') {
    const slots: PlanningSlot[] = [];
    if (b.start_date) slots.push({ title: `Prise du véhicule · ${name}`, day: b.start_date, start: b.start_time, end: null, notes: join(b.from_place, ref) });
    if (b.end_date) slots.push({ title: `Retour du véhicule · ${name}`, day: b.end_date, start: b.end_time, end: null, notes: join(b.to_place ?? b.from_place, ref) });
    return slots;
  }
  if (!b.start_date) return [];
  const sameDay = !b.end_date || b.end_date === b.start_date;
  return [{ title: b.title, day: b.start_date, start: b.start_time, end: sameDay ? b.end_time : null, notes: ref }];
}

/** Jour de rattachement (document, dépense) : début, sinon fin. */
export function bookingDay(b: BookingLike): string | null {
  return b.start_date ?? b.end_date;
}

export type BookingWarning = 'no_date' | 'outside_trip' | 'foreign_currency' | 'no_price';

/** Ce qu'il faut vérifier avant d'ajouter. */
export function bookingWarnings(b: BookingLike, tripStart: string | null, tripEnd: string | null): BookingWarning[] {
  const warnings: BookingWarning[] = [];
  const day = bookingDay(b);
  if (!day) warnings.push('no_date');
  else if (tripStart && tripEnd) {
    const last = b.end_date ?? day;
    if (day < tripStart || last > tripEnd) warnings.push('outside_trip');
  }
  if (b.total_price === null) warnings.push('no_price');
  else if (b.currency && b.currency !== HOME_CURRENCY) warnings.push('foreign_currency');
  return warnings;
}

/** Réservation déjà importée ? (même référence et même jour) */
export function isDuplicate(b: BookingLike, existing: readonly { reference: string | null; day: string | null }[]): boolean {
  if (!b.reference) return false;
  const day = bookingDay(b);
  return existing.some(e => e.reference === b.reference && e.day === day);
}
