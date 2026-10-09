// HAKO — Hook Carte du voyage
// Étapes + trajets (avec leur billet) + lieux du groupe, filtre par ville.
// Pendant le voyage, la ville du jour est sélectionnée d'emblée.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useTripStops } from '@/hooks/useTripStops';
import { getTripMap } from '@/services/tripMapService';
import { MapPlace, MapTicket } from '@/types/tripMap';
import { regionForPoints, stopPoints } from '@/utils/mapRegion';
import { buildLegs, placesForStop } from '@/utils/tripMap';
import { localDayIso, stopForDay } from '@/utils/tripStops';

export function useTripMap(tripId: string | undefined) {
  const { stops, loading: stopsLoading } = useTripStops(tripId);
  const [tickets, setTickets] = useState<MapTicket[]>([]);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** null = « Tout le voyage » ; undefined = pas encore choisi (ville du jour par défaut) */
  const [picked, setPicked] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(() => {
    if (!tripId) return;
    void getTripMap(tripId).then(({ data, error }) => {
      if (error !== null) console.log('[CARTE] chargement', error);
      if (data) { setTickets(data.tickets); setPlaces(data.places); }
      setLoaded(true);
    });
  }, [tripId]);

  useFocusEffect(refresh);

  const todayStop = useMemo(() => stopForDay(stops, localDayIso(new Date())), [stops]);
  const selectedStopId = picked === undefined ? todayStop?.id ?? null : picked;
  const selectedStop = stops.find(s => s.id === selectedStopId) ?? null;

  const legs = useMemo(() => buildLegs(stops, tickets), [stops, tickets]);
  const visiblePlaces = useMemo(() => placesForStop(places, selectedStopId), [places, selectedStopId]);

  /** Cadrage : tout le trajet, ou la ville choisie avec ses lieux. */
  const region = useMemo(() => {
    if (!selectedStop) return regionForPoints(stopPoints(stops));
    const pts = visiblePlaces.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
    if (selectedStop.lat !== null && selectedStop.lng !== null) pts.push({ latitude: selectedStop.lat, longitude: selectedStop.lng });
    return regionForPoints(pts);
  }, [selectedStop, stops, visiblePlaces]);

  return {
    stops, legs, places: visiblePlaces, todayStop, selectedStop, selectedStopId,
    selectStop: setPicked, region, loaded: loaded && !stopsLoading, refresh,
  };
}
