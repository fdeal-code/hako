// HAKO — Hook Partage vers Hako (écran app/share.tsx)
// Lit le contenu partagé : un lien (TikTok, Reel, Safari…) → nouvelle envie ;
// un PDF, une capture ou un e-mail de confirmation copié → import de
// réservation. Charge l'aperçu et la liste des voyages (en cours d'abord).

import { useEffect, useMemo, useState } from 'react';
import { useShareIntentContext } from 'expo-share-intent';

import { useAuth } from '@/contexts/AuthContext';
import { getMyTrips, MyTrip } from '@/services/myTripsService';
import { fetchLinkPreview } from '@/services/wishService';
import { LinkPreview } from '@/types/wishDraft';
import { ImportSource } from '@/types/bookingImport';
import { BOOKING_FILE_TYPES, fileUri, sharedLink, shareMode, ShareMode, tripMoment, tripsForShare, TripMoment } from '@/utils/shareIntake';
import { localDayIso } from '@/utils/tripStops';

export function useShareIntake() {
  const { session } = useAuth();
  const { shareIntent, hasShareIntent, resetShareIntent, isReady } = useShareIntentContext();
  const [trips, setTrips] = useState<MyTrip[] | null>(null);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mode: ShareMode = useMemo(
    () => (hasShareIntent ? shareMode(shareIntent, shareIntent.files) : 'none'),
    [hasShareIntent, shareIntent],
  );
  const link = useMemo(
    () => (hasShareIntent && mode === 'wish' ? sharedLink(shareIntent) : null),
    [hasShareIntent, mode, shareIntent],
  );
  // Ce qu'on donnera à la page d'import
  const bookingSource = useMemo<ImportSource | null>(() => {
    if (mode === 'booking-text') return { type: 'text', text: shareIntent.text?.trim() ?? '' };
    if (mode !== 'booking-file') return null;
    const f = (shareIntent.files ?? []).find(x => BOOKING_FILE_TYPES.includes(x.mimeType.toLowerCase()));
    if (!f) return null;
    return { type: 'file', uri: fileUri(f.path), name: f.fileName, mimeType: f.mimeType.toLowerCase() };
  }, [mode, shareIntent]);
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
    isReady, hasShareIntent, mode, link, bookingSource, preview, trips, error, momentOf,
    title: shareIntent.meta?.title ?? null,
    hasFiles: (shareIntent.files?.length ?? 0) > 0,
    done: () => resetShareIntent(),
  };
}
