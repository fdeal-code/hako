// HAKO — Accueil : répartition des voyages (fonction pure, testable)
// En vedette : le voyage en cours, sinon le prochain départ. Tous les autres
// dans une seule liste : d'abord ceux à venir (du plus proche au plus
// lointain), puis les terminés (du plus récent au plus ancien).

export interface HomeTripLike { start_date: string; end_date: string }

export function splitHomeTrips<T extends HomeTripLike>(trips: readonly T[], today: string): { featured: T | null; others: T[] } {
  const upcoming = trips.filter(t => t.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = trips.filter(t => t.end_date < today).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const featured = upcoming[0] ?? null;
  return { featured, others: [...upcoming.slice(1), ...past] };
}
