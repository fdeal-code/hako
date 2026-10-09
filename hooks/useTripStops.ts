// HAKO — Hook étapes d'un voyage (liste ordonnée + temps réel)

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/services/supabase';
import {
  appendTripStop,
  deleteTripStop,
  getTripStops,
  reorderTripStops,
  saveStopLayout,
  StopLayoutEntry,
  syncTripDestinationLabel,
  updateTripStop,
} from '@/services/tripStopService';
import { NewTripStop, TripStop, TripStopUpdate } from '@/types/tripStops';

const CHANNEL_PREFIX = 'trip-stops';

interface UseTripStopsResult {
  stops: TripStop[];
  /** Vrai dès 2 étapes : l'UI multi-étapes ne s'affiche qu'à partir de là. */
  isMultiStop: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addStop: (stop: NewTripStop) => Promise<string | null>;
  editStop: (stopId: string, update: TripStopUpdate) => Promise<string | null>;
  removeStop: (stopId: string) => Promise<string | null>;
  reorder: (orderedStopIds: string[]) => Promise<string | null>;
  /** Nouvel ordre + nuits → positions et dates recalculées depuis le début du voyage. */
  saveLayout: (tripStartDate: string, layout: StopLayoutEntry[]) => Promise<string | null>;
  /** Met à jour le libellé `trips.destination` après un changement d'étapes. */
  syncLabel: (placeNames: string[]) => Promise<string | null>;
}

/** Les actions renvoient un message d'erreur affichable, ou null si OK. */
export function useTripStops(tripId: string | undefined): UseTripStopsResult {
  const [stops, setStops] = useState<TripStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const { data, error: serviceError } = await getTripStops(tripId);
    if (serviceError !== null) {
      setError(serviceError);
    } else {
      setStops(data);
      setError(null);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => { void refresh(); }, [refresh]);

  /* Realtime : un membre ajoute / déplace une étape → tout le monde est à jour */
  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`${CHANNEL_PREFIX}-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_stops', filter: `trip_id=eq.${tripId}` },
        () => { void refresh(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tripId, refresh]);

  const addStop = useCallback(async (stop: NewTripStop) => {
    if (!tripId) return 'Voyage introuvable.';
    const { error: serviceError } = await appendTripStop(tripId, stop, stops.length);
    if (serviceError === null) void refresh();
    return serviceError;
  }, [tripId, stops.length, refresh]);

  const editStop = useCallback(async (stopId: string, update: TripStopUpdate) => {
    const { error: serviceError } = await updateTripStop(stopId, update);
    if (serviceError === null) void refresh();
    return serviceError;
  }, [refresh]);

  const removeStop = useCallback(async (stopId: string) => {
    const { error: serviceError } = await deleteTripStop(stopId);
    if (serviceError !== null) return serviceError;
    // Recompacte les positions restantes (0..n-1)
    const remaining = stops.filter(s => s.id !== stopId).map(s => s.id);
    const { error: reorderError } = await reorderTripStops(remaining);
    void refresh();
    return reorderError;
  }, [stops, refresh]);

  const reorder = useCallback(async (orderedStopIds: string[]) => {
    // Optimiste : l'UI suit le doigt, la base suit derrière
    setStops(prev => orderedStopIds
      .map(id => prev.find(s => s.id === id))
      .filter((s): s is TripStop => s !== undefined)
      .map((s, position) => ({ ...s, position })));
    const { error: serviceError } = await reorderTripStops(orderedStopIds);
    void refresh();
    return serviceError;
  }, [refresh]);

  const saveLayout = useCallback(async (tripStartDate: string, layout: StopLayoutEntry[]) => {
    const { error: serviceError } = await saveStopLayout(tripStartDate, layout);
    void refresh();
    return serviceError;
  }, [refresh]);

  const syncLabel = useCallback(async (placeNames: string[]) => {
    if (!tripId) return 'Voyage introuvable.';
    const { error: serviceError } = await syncTripDestinationLabel(tripId, placeNames);
    return serviceError;
  }, [tripId]);

  return {
    stops,
    isMultiStop: stops.length > 1,
    loading,
    error,
    refresh,
    addStop,
    editStop,
    removeStop,
    reorder,
    saveLayout,
    syncLabel,
  };
}
