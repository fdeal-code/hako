// HAKO — Hook Partage vers Hako (écran app/share.tsx)
// Lit le contenu partagé (TikTok, Reel, Safari…), en tire le lien, charge
// l'aperçu et la liste des voyages (en cours d'abord).

import { useEffect, useMemo, useState } from 'react';
import { useShareIntentContext } from 'expo-share-intent';

import { useAuth } from '@/contexts/AuthContext';
import { getMyTrips, MyTrip } from '@/services/myTripsService';
import { fetchLinkPreview } from '@/services/wishService';
import { LinkPreview } from '@/types/wishDraft';
import { sharedLink, tripMoment, tripsForShare, TripMoment } from '@/utils/shareIntake';
import { localDayIso } from '@/utils/tripStops';

export function useShareIntake() {
  const { session } = useAuth();
  const { shareIntent, hasShareIntent, resetShareIntent, isReady } = useShareIntentContext();
  const [trips, setTrips] = useState<MyTrip[] | null>(null);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const link = useMemo(() => (hasShareIntent ? sharedLink(shareIntent) : null), [hasShareIntent, shareIntent]);
  const today = localDayIso(new Date());

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    void getMyTrips(userId).then(({ data, error: e }) => {
      if (e !== null) setError(e);
      else setTrips(tripsForShare(data, today));
    });
  }, [session?.user?.id, today]);

  useEffect(() => {
    if (!link) return;
    void fetchLinkPreview(link).then(setPreview);
  }, [link]);

  const momentOf = (trip: MyTrip): TripMoment => tripMoment(trip, today);

  return {
    isReady, hasShareIntent, link, preview, trips, error, momentOf,
    title: shareIntent.meta?.title ?? null,
    hasFiles: (shareIntent.files?.length ?? 0) > 0,
    done: () => resetShareIntent(),
  };
}
