// HAKO — Hook événements sur place : lit le cache, le rafraîchit au besoin

import { useCallback, useEffect, useState } from 'react';

import { getTripEvents, refreshTripEvents } from '@/services/eventsService';
import { TripEvent } from '@/types/events';

interface UseTripEventsResult {
  events: TripEvent[];
  loading: boolean;
  /** Message affichable si la récupération serveur a échoué (clé absente, réseau…). */
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

export function useTripEvents(tripId: string | undefined): UseTripEventsResult {
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    const { data } = await getTripEvents(tripId);
    if (data) setEvents(data);
  }, [tripId]);

  const refresh = useCallback(async (force = false) => {
    if (!tripId) return;
    const { error: fetchError } = await refreshTripEvents(tripId, force);
    setError(fetchError);
    await load();
    setLoading(false);
  }, [tripId, load]);

  // Cache d'abord (instantané), puis rafraîchissement serveur (no-op si < 24 h)
  useEffect(() => {
    void load().then(() => refresh());
  }, [load, refresh]);

  return { events, loading, error, refresh };
}
