// HAKO — Hook Voyage en cours (dashboard « en cours »)
// Ce qu'il faut tout de suite : l'activité en cours ou la prochaine (adresse,
// itinéraire, billet lié), sinon les envies à faire dans la ville du jour ;
// le programme du jour, le billet du jour, les dépenses, demain. L'heure avance toute seule
// (tick chaque minute) ; données rechargées au retour sur l'écran, après un
// ajout dans l'app et quand un membre ajoute quelque chose (Realtime).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { useTripStops } from '@/hooks/useTripStops';
import { getOngoingTrip } from '@/services/ongoingTripService';
import { supabase } from '@/services/supabase';
import { OngoingData } from '@/types/ongoingTrip';
import { summarizeBudget } from '@/utils/dashboardSummary';
import { tripEvents } from '@/utils/events';
import { nearbyIdeas, nowAndNext, pickTodayDoc, ticketFor, tripDay } from '@/utils/ongoingTrip';
import { addDays, localDayIso, stopForDay } from '@/utils/tripStops';

const CHANNEL_PREFIX = 'ongoing-trip';
const WATCHED_TABLES = ['planning_items', 'expenses', 'documents', 'wishes'] as const;
const REALTIME_DEBOUNCE_MS = 500;
const CLOCK_TICK_MS = 60_000;
const MINUTES_PER_HOUR = 60;

function minutesNow(): number {
  const d = new Date();
  return d.getHours() * MINUTES_PER_HOUR + d.getMinutes();
}

export function useOngoingTrip(tripId: string | undefined, startDate: string, endDate: string) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { stops } = useTripStops(tripId);
  const [data, setData] = useState<OngoingData | null>(null);
  const [today, setToday] = useState(() => localDayIso(new Date()));
  const [now, setNow] = useState(minutesNow);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // L'horloge : compte à rebours et changement de jour à minuit
  useEffect(() => {
    const id = setInterval(() => {
      setNow(minutesNow());
      setToday(localDayIso(new Date()));
    }, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(() => {
    if (!tripId) return;
    void getOngoingTrip(tripId, today, addDays(today, 1)).then(result => {
      if (result.error !== null) console.log('[ONGOING] chargement', result.error);
      else setData(result.data);
    });
  }, [tripId, today]);

  useFocusEffect(refresh);
  useEffect(() => tripEvents.subscribe(refresh), [refresh]);

  useEffect(() => {
    if (!tripId) return;
    const later = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(refresh, REALTIME_DEBOUNCE_MS);
    };
    let channel = supabase.channel(`${CHANNEL_PREFIX}-${tripId}`);
    for (const table of WATCHED_TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` }, later);
    }
    channel.subscribe();
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      void supabase.removeChannel(channel);
    };
  }, [tripId, refresh]);

  const day = useMemo(() => tripDay(startDate, endDate, today), [startDate, endDate, today]);
  const stop = useMemo(() => stopForDay(stops, today), [stops, today]);
  const schedule = useMemo(() => nowAndNext(data?.today ?? [], now), [data, now]);
  const ticket = useMemo(() => pickTodayDoc(data?.docs ?? [], today, now), [data, today, now]);
  const nextDoc = useMemo(
    () => (data?.docs ?? []).find(d => d.event_date !== null && d.event_date.slice(0, 10) > today) ?? null,
    [data, today],
  );
  const todaySpent = useMemo(
    () => (data?.expenses ?? []).filter(e => e.date?.slice(0, 10) === today).reduce((s, e) => s + e.amount, 0),
    [data, today],
  );
  const budget = useMemo(() => summarizeBudget(data?.expenses ?? [], userId), [data, userId]);

  /* À la une : l'activité en cours, sinon la prochaine du jour */
  const focus = schedule.current ?? schedule.next;
  const focusTicket = useMemo(
    () => (focus ? ticketFor(focus, data?.docs ?? [], today) : null),
    [focus, data, today],
  );
  /* Plus rien de prévu : les envies de la ville du jour pas encore au planning */
  const ideas = useMemo(() => nearbyIdeas(data?.unplanned ?? [], stop?.id ?? null), [data, stop]);

  return {
    data, today, now, day, stop, stops, schedule, ticket, nextDoc, todaySpent, budget,
    focus, focusTicket, ideas, refresh,
  };
}

export type OngoingTripState = ReturnType<typeof useOngoingTrip>;
