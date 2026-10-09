// HAKO — Filtres des envies partagés entre la liste (envies.tsx) et la page
// « Filtres » : un petit magasin en mémoire par voyage, la liste se met à
// jour en direct pendant qu'on coche.

import { useCallback, useSyncExternalStore } from 'react';

import { DEFAULT_WISH_FILTERS, WishFilters } from '@/utils/wishFilters';

const store = new Map<string, WishFilters>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useWishFilters(tripId: string) {
  const filters = useSyncExternalStore(subscribe, () => store.get(tripId) ?? DEFAULT_WISH_FILTERS);

  const update = useCallback((patch: Partial<WishFilters>) => {
    store.set(tripId, { ...(store.get(tripId) ?? DEFAULT_WISH_FILTERS), ...patch });
    listeners.forEach(l => l());
  }, [tripId]);

  const reset = useCallback(() => {
    store.delete(tripId);
    listeners.forEach(l => l());
  }, [tripId]);

  return { filters, update, reset };
}
