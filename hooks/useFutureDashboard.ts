// HAKO — Contenu des tuiles du dashboard « avant le départ »
// Partagé par app/trip/[id]/dashboard.tsx et components/home/ExpandedDashboard.tsx.
// Toujours à jour :
//  - au retour sur le dashboard (ex. après avoir ajouté une dépense) ;
//  - après un ajout dans l'app (tripEvents) ;
//  - en direct quand un membre du groupe ajoute quelque chose (Realtime).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { DashboardSummary, getDashboardSummary } from '@/services/dashboardService';
import { supabase } from '@/services/supabase';
import { tripEvents } from '@/utils/events';

const CHANNEL_PREFIX = 'dashboard';
const WATCHED_TABLES = ['documents', 'wishes', 'expenses', 'planning_items'] as const;
const REALTIME_DEBOUNCE_MS = 500;

const EMPTY: DashboardSummary = {
  recentDocTitles: [],
  docCount: 0,
  wishCount: 0,
  toVoteCount: 0,
  budget: { total: 0, expenseCount: 0, myBalance: 0 },
  plannedCount: 0,
};

export function useFutureDashboard(tripId: string | undefined): DashboardSummary {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!tripId) return;
    void getDashboardSummary(tripId, userId).then(({ data }) => { if (data) setSummary(data); });
  }, [tripId, userId]);

  // Au montage et à chaque retour sur l'écran
  useFocusEffect(refresh);

  // Ajout fait dans l'app (envie, document…)
  useEffect(() => tripEvents.subscribe(refresh), [refresh]);

  // Ajout fait par un autre membre
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

  return summary;
}
