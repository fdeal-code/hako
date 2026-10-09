// HAKO — Traduction d'un budget global en repères concrets
// Fonctions pures. Répartition indicative d'un budget hors transport :
// ~45 % logement, ~25 % activités, le reste pour manger / sortir.

const LODGING_SHARE = 0.45;
const ACTIVITIES_SHARE = 0.25;

export const BUDGET_STEP = 50;
export const BUDGET_MIN = 100;
export const BUDGET_MAX = 5000;

export function clampBudget(amount: number): number {
  return Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, Math.round(amount / BUDGET_STEP) * BUDGET_STEP));
}

/** Logement visé par nuit et par personne. */
export function lodgingPerNight(budgetPerPerson: number, nights: number): number {
  if (nights <= 0) return 0;
  return Math.round((budgetPerPerson * LODGING_SHARE) / nights);
}

/** Activités visées par jour et par personne (jours = nuits + 1). */
export function activitiesPerDay(budgetPerPerson: number, nights: number): number {
  return Math.round((budgetPerPerson * ACTIVITIES_SHARE) / (Math.max(0, nights) + 1));
}
