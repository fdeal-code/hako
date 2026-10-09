// HAKO — Hook Planning : jours du voyage, journée choisie, créneaux, billets,
// envies à planifier. Jour par défaut : celui demandé (highlightDay), sinon
// aujourd'hui pendant le voyage, sinon le premier jour.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useTripStops } from '@/hooks/useTripStops';
import { deletePlanningEntry, getPlanning } from '@/services/planningService';
import { supabase } from '@/services/supabase';
import { PlanningData } from '@/types/planning';
import { tripEvents } from '@/utils/events';
import { arrivalIndex, dayHeader, stopsOnDay } from '@/utils/planningDay';
import { localDayIso, tripDays } from '@/utils/tripStops';

const CHANNEL_PREFIX = 'planning';
const REALTIME_DEBOUNCE_MS = 400;

export function usePlanning(tripId: string | undefined, requestedDay?: string) {
  const { stops } = useTripStops(tripId);
  const [data, setData] = useState<PlanningData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Jour choisi à la main, mémorisé avec le jour demandé du moment : si un nouveau
  // jour est demandé (retour d'un ajout), il reprend la main.
  const [picked, setPicked] = useState<{ day: string; forRequest: string | undefined } | null>(null);
  const selectDay = useCallback((d: string) => setPicked({ day: d, forRequest: requestedDay }), [requestedDay]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!tripId) return;
    void getPlanning(tripId).then(({ data: d, error }) => {
      if (error !== null) { console.log('[PLANNING] chargement', error); setError(error); }
      if (d) { setData(d); setError(null); }
    });
  }, [tripId]);

  useFocusEffect(refresh);
  useEffect(() => tripEvents.subscribe(refresh), [refresh]);

  useEffect(() => {
    if (!tripId) return;
    const later = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(refresh, REALTIME_DEBOUNCE_MS);
    };
    const channel = supabase
      .channel(`${CHANNEL_PREFIX}-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items', filter: `trip_id=eq.${tripId}` }, later)
      .subscribe();
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      void supabase.removeChannel(channel);
    };
  }, [tripId, refresh]);

  const days = useMemo(() => (data ? tripDays(data.startDate, data.endDate) : []), [data]);
  const today = localDayIso(new Date());
  const wanted = picked && picked.forRequest === requestedDay ? picked.day : requestedDay ?? null;
  const selectedDay = wanted && days.includes(wanted)
    ? wanted
    : days.includes(today) ? today : days[0] ?? today;

  const entries = useMemo(
    () => (data?.entries ?? []).filter(e => e.day_date === selectedDay),
    [data, selectedDay],
  );
  const header = useMemo(() => dayHeader(stops, selectedDay), [stops, selectedDay]);
  const dayStops = useMemo(() => stopsOnDay(stops, selectedDay), [stops, selectedDay]);
  const arrival = useMemo(() => {
    const idx = arrivalIndex(entries, stops, selectedDay);
    return idx === -1 ? null : { index: idx, stop: dayStops[dayStops.length - 1] ?? null };
  }, [entries, stops, selectedDay, dayStops]);
  /** Envies à planifier : celles de la ville du jour d'abord */
  const toPlan = useMemo(() => {
    const ids = new Set(dayStops.map(s => s.id));
    return [...(data?.toPlan ?? [])].sort((a, b) => Number(ids.has(b.stop_id ?? '')) - Number(ids.has(a.stop_id ?? '')));
  }, [data, dayStops]);

  const remove = useCallback(async (entryId: string): Promise<string | null> => {
    setData(prev => (prev ? { ...prev, entries: prev.entries.filter(e => e.id !== entryId) } : prev));
    const { error } = await deletePlanningEntry(entryId);
    if (error !== null) refresh();
    else tripEvents.emit();
    return error;
  }, [refresh]);

  return {
    data, error, stops, days, today, selectedDay, selectDay,
    entries, header, dayStops, arrival, toPlan, tickets: data?.tickets ?? [],
    remove, refresh,
  };
}
