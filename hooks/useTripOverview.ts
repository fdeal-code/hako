// HAKO — Hook infos d'un voyage pour les suggestions (dates, style, budget, voyageurs)

import { useCallback, useEffect, useState } from 'react';

import { getTripOverview, TripOverview } from '@/services/tripService';

interface UseTripOverviewResult {
  overview: TripOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTripOverview(tripId: string | undefined): UseTripOverviewResult {
  const [overview, setOverview] = useState<TripOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const { data, error: serviceError } = await getTripOverview(tripId);
    if (serviceError !== null) setError(serviceError);
    else { setOverview(data); setError(null); }
    setLoading(false);
  }, [tripId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { overview, loading, error, refresh };
}
