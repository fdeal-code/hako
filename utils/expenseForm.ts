// HAKO — Ajout d'une dépense : fonctions pures (montant, partage, jours)
// Aucun import local : testable avec node --test.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAY_OPTIONS = 60;

/** « 12,50 » / « 12.5 » / « 1 200 » → 12.5 ; null si invalide ou ≤ 0. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 ? n : null;
}

/**
 * Partage en parts égales au centime près ; les centimes en trop vont aux
 * premières personnes pour que la somme des parts = le total exact
 * (10 € / 3 → 3,34 + 3,33 + 3,33).
 */
export function splitEqually(total: number, userIds: readonly string[]): { user_id: string; amount: number }[] {
  if (userIds.length === 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / userIds.length);
  const extra = cents - base * userIds.length;
  return userIds.map((user_id, i) => ({ user_id, amount: (base + (i < extra ? 1 : 0)) / 100 }));
}

function parseDay(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/**
 * Jours proposés pour la dépense : les jours du voyage jusqu'à aujourd'hui
 * (du plus récent au plus ancien), sinon aujourd'hui seul (voyage à venir).
 */
export function expenseDayOptions(startDate: string | null, endDate: string | null, today: string): string[] {
  if (!startDate || !endDate || startDate > today) return [today];
  const last = endDate < today ? endDate : today;
  const days: string[] = [];
  for (let ms = parseDay(last); ms >= parseDay(startDate) && days.length < MAX_DAY_OPTIONS; ms -= MS_PER_DAY) {
    days.push(new Date(ms).toISOString().slice(0, 10));
  }
  return days;
}
