// HAKO — Hook checklist « Prêt pour le départ ? » (partagée, temps réel)

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { getChecklist, setChecklistItem } from '@/services/checklistService';
import { supabase } from '@/services/supabase';
import { ChecklistItemKey } from '@/types/checklist';

const CHANNEL_PREFIX = 'trip-checklist';

interface UseTripChecklistResult {
  done: ReadonlySet<ChecklistItemKey>;
  loading: boolean;
  toggle: (item: ChecklistItemKey) => Promise<string | null>;
}

export function useTripChecklist(tripId: string | undefined): UseTripChecklistResult {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [done, setDone] = useState<Set<ChecklistItemKey>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const { data } = await getChecklist(tripId);
    if (data) setDone(new Set(data.map(r => r.item)));
    setLoading(false);
  }, [tripId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`${CHANNEL_PREFIX}-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_checklist', filter: `trip_id=eq.${tripId}` },
        () => { void refresh(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tripId, refresh]);

  const toggle = useCallback(async (item: ChecklistItemKey) => {
    if (!tripId) return 'Voyage introuvable.';
    const willBeDone = !done.has(item);
    // Optimiste
    setDone(prev => {
      const next = new Set(prev);
      if (willBeDone) next.add(item); else next.delete(item);
      return next;
    });
    const { error } = await setChecklistItem(tripId, item, willBeDone, userId);
    if (error !== null) void refresh();
    return error;
  }, [tripId, done, userId, refresh]);

  return { done, loading, toggle };
}
