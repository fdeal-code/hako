// HAKO — Prix et durée d'une envie : formatage et lecture des anciennes
// valeurs (niveaux €/€€/€€€, durées fixes). Testés dans tests/wishPriceDuration.test.ts.

const MINUTES_PER_HOUR = 60;

/** Durées anciennes (colonne `duration`) → minutes. */
const LEGACY_DURATION: Record<string, number> = { '30min': 30, '1h': 60, '2h': 120, 'half-day': 240, day: 480 };
const LEGACY_BUDGET: Record<string, string> = { free: 'Gratuit', '€': '€', '€€': '€€', '€€€': '€€€' };

export const PRICE_PRESETS = [0, 10, 20, 50] as const;
export const DURATION_PRESETS: readonly { minutes: number; label: string }[] = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 90, label: '1 h 30' },
  { minutes: 120, label: '2 h' },
  { minutes: 180, label: '3 h' },
  { minutes: 240, label: 'Demi-journée' },
  { minutes: 480, label: 'Journée' },
];

/** « Gratuit », « 25 € », « 12,50 € ». */
export function formatPrice(price: number): string {
  if (price === 0) return 'Gratuit';
  const rounded = Math.round(price * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace('.', ',')} €`;
}

/** « 45 min », « 1 h 30 », « Demi-journée », « Journée ». */
export function formatMinutes(minutes: number): string {
  if (minutes === 240) return 'Demi-journée';
  if (minutes >= 480 && minutes % 480 === 0) return minutes === 480 ? 'Journée' : `${minutes / 480} jours`;
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** « 25 € » → 25 ; accepte « 12,5 », « 12.50 € » ; null si vide ou invalide. */
export function parsePrice(input: string): number | null {
  const cleaned = input.replace(/[€\s]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}

/** Prix affiché : le prix précis, sinon l'ancien niveau. */
export function priceLabel(price: number | null | undefined, legacyBudget?: string | null): string | null {
  if (price !== null && price !== undefined) return formatPrice(price);
  return legacyBudget ? LEGACY_BUDGET[legacyBudget] ?? null : null;
}

/** Durée en minutes : la durée précise, sinon l'ancienne valeur. */
export function durationMinutes(minutes: number | null | undefined, legacyDuration?: string | null): number | null {
  if (minutes !== null && minutes !== undefined) return minutes;
  return legacyDuration ? LEGACY_DURATION[legacyDuration] ?? null : null;
}

/** Nombre d'heures occupées au planning (réglage à l'heure près, 1 h minimum). */
export function spanHours(minutes: number | null | undefined): number {
  return minutes ? Math.max(1, Math.ceil(minutes / 60)) : 1;
}
