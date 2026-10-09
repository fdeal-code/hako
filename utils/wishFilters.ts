// HAKO — Filtres des envies (page app/trip/[id]/envies-filters.tsx)
// Fonctions pures : aucun import local, testable avec node --test.

export type WishSort = 'recent' | 'oldest' | 'most_voted';

export interface WishFilters {
  types: string[];       // place | inspiration | orga
  categories: string[];  // restaurant, bar…
  vibes: string[];       // chill, foodie… (tags d'ambiance)
  sort: WishSort;
}

export const DEFAULT_WISH_FILTERS: WishFilters = { types: [], categories: [], vibes: [], sort: 'recent' };

export function toggleValue(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
}

/** Nombre de critères actifs (le tri par défaut ne compte pas). */
export function activeFilterCount(f: WishFilters): number {
  return f.types.length + f.categories.length + f.vibes.length + (f.sort === 'recent' ? 0 : 1);
}

export interface FilterableWish {
  type?: string | null;
  category?: string | null;
  vibes?: readonly string[] | null;
  created_at: string;
  upVotes: number;
}

export function matchesWishFilters(w: FilterableWish, f: WishFilters): boolean {
  if (f.types.length > 0 && !f.types.includes(w.type ?? 'inspiration')) return false;
  if (f.categories.length > 0 && !(w.category && f.categories.includes(w.category))) return false;
  if (f.vibes.length > 0 && !(w.vibes ?? []).some(v => f.vibes.includes(v))) return false;
  return true;
}

export function compareWishes(a: FilterableWish, b: FilterableWish, sort: WishSort): number {
  if (sort === 'oldest') return a.created_at.localeCompare(b.created_at);
  if (sort === 'most_voted' && b.upVotes !== a.upVotes) return b.upVotes - a.upVotes;
  return b.created_at.localeCompare(a.created_at);
}
