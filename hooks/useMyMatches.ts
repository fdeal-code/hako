// HAKO — Hook liste de mes Trip Matches en cours (point d'entrée Dashboard)
//
// Pattern identique aux fetchs des écrans : refetch au focus
// (useFocusEffect, comme la liste des trips sur la Home).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';

import { getMyMatches } from '@/services/tripMatchService';
import { TripMatch } from '@/types/tripMatch';

interface UseMyMatchesResult {
  matches: TripMatch[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMyMatches(): UseMyMatchesResult {
  const [matches, setMatches] = useState<TripMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: serviceError } = await getMyMatches();
    if (serviceError !== null) {
      setError(serviceError);
    } else {
      setMatches(data);
      setError(null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { matches, loading, error, refresh };
}
