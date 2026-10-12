// HAKO — Étapes sans logement (dashboard, planning, Préparatifs)
// Rechargé au retour sur l'écran et quand le voyage change (tripEvents).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useTripStops } from '@/hooks/useTripStops';
import { getLodgingCoverage } from '@/services/lodgingService';
import { TripStop } from '@/types/tripStops';
import { tripEvents } from '@/utils/events';
import { LodgingCoverage, stopsWithoutLodging } from '@/utils/lodgingGaps';
import { localDayIso } from '@/utils/tripStops';

export function useLodgingGaps(tripId: string): { gaps: TripStop[]; stops: readonly TripStop[] } {
  const { stops } = useTripStops(tripId);
  const [coverage, setCoverage] = useState<LodgingCoverage | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    void getLodgingCoverage(tripId).then(({ data }) => { if (data) setCoverage(data); });
  }, [tripId]);

  useFocusEffect(load);
  useEffect(() => tripEvents.subscribe(load), [load]);

  const gaps = useMemo(
    () => (coverage ? stopsWithoutLodging(stops, coverage, localDayIso(new Date())) : []),
    [stops, coverage],
  );
  return { gaps, stops };
}
