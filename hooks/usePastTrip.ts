// HAKO — Hook Après le voyage (dashboard passé, album, avis, récap)
// Charge tout en une fois puis dérive avis, stats, podium et trophées.
// Toujours à jour : retour sur l'écran, ajouts dans l'app, ajouts des autres
// membres (Realtime sur trip_photos et activity_reviews).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { usePhotoImport } from '@/hooks/usePhotoImport';
import { useTripStops } from '@/hooks/useTripStops';
import { deleteTripPhoto, getPastTrip, saveReview } from '@/services/pastTripService';
import { supabase } from '@/services/supabase';
import { PastTripData, TripPhoto } from '@/types/pastTrip';
import { summarizeBudget } from '@/utils/dashboardSummary';
import { tripEvents } from '@/utils/events';
import { buildRecapMessage, buildReviewables, podium, recapBadges, recapStats } from '@/utils/pastRecap';
import { formatStopRange } from '@/utils/wishLinks';

const CHANNEL_PREFIX = 'past-trip';
const REALTIME_DEBOUNCE_MS = 500;

export function usePastTrip(tripId: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { stops } = useTripStops(tripId);
  const [data, setData] = useState<PastTripData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!tripId) return;
    void getPastTrip(tripId).then(result => {
      if (result.error !== null) { console.log('[PAST] chargement', result.error); setError(result.error); }
      else { setData(result.data); setError(null); }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_photos', filter: `trip_id=eq.${tripId}` }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_reviews' }, later)
      .subscribe();
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      void supabase.removeChannel(channel);
    };
  }, [tripId, refresh]);

  /* ── Dérivés ── */
  const reviewables = useMemo(
    () => (data ? buildReviewables(data.wishes, data.reviews, userId) : []),
    [data, userId],
  );
  const toRateCount = reviewables.filter(r => r.myRating === null).length;
  const groupAverage = useMemo(() => {
    const rated = reviewables.filter(r => r.avgRating !== null);
    return rated.length > 0 ? rated.reduce((s, r) => s + (r.avgRating ?? 0), 0) / rated.length : null;
  }, [reviewables]);
  const stats = useMemo(() => (data ? recapStats({
    startDate: data.trip.startDate,
    endDate: data.trip.endDate,
    cityCount: stops.length,
    placeCount: data.wishes.length,
    photoCount: data.photos.length,
    expenses: data.expenses,
    memberCount: data.members.length,
  }) : null), [data, stops.length]);
  const top = useMemo(() => podium(reviewables), [reviewables]);
  const badges = useMemo(() => (data ? recapBadges(data) : []), [data]);
  const budget = useMemo(() => summarizeBudget(data?.expenses ?? [], userId), [data, userId]);

  /* ── Actions ── */
  /** Ouvre la galerie (choix multiple) puis envoie les photos. */
  const { importPhotos, uploading } = usePhotoImport(tripId, refresh);

  const removePhoto = useCallback(async (photo: TripPhoto): Promise<string | null> => {
    setData(prev => (prev ? { ...prev, photos: prev.photos.filter(p => p.id !== photo.id) } : prev));
    const { error: deleteError } = await deleteTripPhoto(photo);
    if (deleteError !== null) refresh();
    return deleteError;
  }, [refresh]);

  /** Enregistre ma note (mise à jour immédiate à l'écran). */
  const rate = useCallback(async (wishId: string, rating: number, comment: string | null): Promise<string | null> => {
    if (!userId) return 'Connecte-toi pour noter.';
    setData(prev => {
      if (!prev) return prev;
      const others = prev.reviews.filter(r => !(r.wish_id === wishId && r.user_id === userId));
      return { ...prev, reviews: [...others, { wish_id: wishId, user_id: userId, rating, comment }] };
    });
    const { error: saveError } = await saveReview(wishId, userId, rating, comment);
    if (saveError !== null) refresh();
    return saveError;
  }, [userId, refresh]);

  /** Partage le récap (WhatsApp, Messages…). */
  const share = useCallback(() => {
    if (!data || !stats) return;
    void Share.share({
      message: buildRecapMessage({
        name: data.trip.name,
        dates: formatStopRange(data.trip.startDate, data.trip.endDate),
        stats,
        top,
      }),
    });
  }, [data, stats, top]);

  return {
    share,
    data, error, userId, stops, uploading,
    reviewables, toRateCount, groupAverage, stats, top, badges, budget,
    importPhotos, removePhoto, rate, refresh,
  };
}

export type PastTripState = ReturnType<typeof usePastTrip>;
