// HAKO — Résumé Préparatifs (bande du dashboard et de Documents)

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { getPrepSummary } from '@/services/preparationService';
import { PrepSummary } from '@/types/preparation';
import { tripEvents } from '@/utils/events';

export function usePrepSummary(tripId: string): PrepSummary | null {
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';
  const [summary, setSummary] = useState<PrepSummary | null>(null);

  const load = useCallback(() => {
    if (!tripId || !userId) return;
    void getPrepSummary(tripId, userId).then(({ data }) => { if (data) setSummary(data); });
  }, [tripId, userId]);

  useFocusEffect(load);
  useEffect(() => tripEvents.subscribe(load), [load]);
  return summary;
}
